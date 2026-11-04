// Google Business Profile: connect (Google sign-in) and publish "What's new" posts to one business location.
// Pure logic. Everything that touches the network comes in through GbpDeps so it can be tested.
// Google only lets an app use these APIs after it approves a "Business Profile API access" request.
import { CORS_HEADERS, STATE_TTL_MS, signState, verifyState } from "./youtube.ts";
import type { LiHttpRequest, LiHttpResult } from "./linkedin.ts";

export const GBP_SCOPE = "https://www.googleapis.com/auth/business.manage";
export const GBP_SUMMARY_LIMIT = 1500;

export type GbpHttpRequest = LiHttpRequest;
export type GbpHttpResult = LiHttpResult;

export interface GbpLocation {
  /** "accounts/123/locations/456" (the path the posts API wants). */
  path: string;
  title: string;
}

export interface GbpAccountRow {
  /** Same as the location path. */
  externalId: string;
  displayName: string;
  refreshToken: string;
  accessToken: string;
  expiresAt: string | null;
}

export interface GbpPost {
  caption: string;
  mediaUrl: string | null;
  mediaKind?: "image" | "video" | null;
}

export interface GbpDeps {
  configured: boolean;
  siteUrl: string;
  clientId: string;
  clientSecret: string;
  stateSecret: string;
  redirectUri: string;
  now: () => number;
  getUser: (authorization: string | null) => Promise<{ id: string } | null>;
  getWorkspaceId: (authorization: string) => Promise<string | null>;
  http: (req: GbpHttpRequest) => Promise<GbpHttpResult>;
  saveAccount: (workspaceId: string, row: GbpAccountRow) => Promise<void>;
  log?: (message: string) => void;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
const fail = (status: number, code: string, message: string) => json(status, { error: { code, message } });

const NOT_CONFIGURED =
  "Google Business is not set up yet. The site owner needs the Google secrets (same as YouTube) and the Business Profile API approval.";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function buildAuthUrl(input: { clientId: string; redirectUri: string; state: string }): string {
  const p = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: GBP_SCOPE,
    access_type: "offline",
    // Without this Google does not send a refresh token the second time.
    prompt: "consent",
    include_granted_scopes: "false",
    state: input.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** First usable account name ("accounts/123") from the account management API. */
export function parseAccountName(body: any): string | null {
  const list = Array.isArray(body?.accounts) ? body.accounts : [];
  for (const a of list) {
    const m = typeof a?.name === "string" ? /^accounts\/([A-Za-z0-9_-]{1,64})$/.exec(a.name) : null;
    if (m) return `accounts/${m[1]}`;
  }
  return null;
}

/** Locations of an account, as the path the posts API wants. */
export function parseLocations(accountName: string, body: any): GbpLocation[] {
  const list = Array.isArray(body?.locations) ? body.locations : [];
  const out: GbpLocation[] = [];
  for (const l of list) {
    const m = typeof l?.name === "string" ? /^locations\/([A-Za-z0-9_-]{1,64})$/.exec(l.name) : null;
    if (!m || !SAFE_ID.test(m[1])) continue;
    const title = typeof l.title === "string" && l.title.trim() ? l.title.trim().slice(0, 120) : "Business location";
    out.push({ path: `${accountName}/locations/${m[1]}`, title });
  }
  return out;
}

/** Google Business posts are plain text (no hashtags), at most 1500 characters. */
export function buildSummary(caption: string): string {
  const text = caption.replace(/\r\n/g, "\n").trim();
  return text.length <= GBP_SUMMARY_LIMIT ? text : text.slice(0, GBP_SUMMARY_LIMIT - 1).trimEnd() + "…";
}

export function buildLocalPost(post: GbpPost): Record<string, unknown> {
  const body: Record<string, unknown> = { languageCode: "en", summary: buildSummary(post.caption), topicType: "STANDARD" };
  if (post.mediaUrl && post.mediaKind !== "video") body.media = [{ mediaFormat: "PHOTO", sourceUrl: post.mediaUrl }];
  return body;
}

export function gbpError(res: GbpHttpResult): string {
  if (res.status === 401) return "The Google login was removed. Press Connect next to Google Business again.";
  if (res.status === 403) {
    return "Google refused the request. Your Google Cloud project needs approved Business Profile API access, and this Google account must manage the location.";
  }
  if (res.status === 429) return "Google's request limit is reached. Try again in a few minutes.";
  if (res.status === 400) {
    const m = typeof res.body?.error?.message === "string" ? res.body.error.message : "";
    return `Google did not accept the post${m ? `: ${m.slice(0, 200)}` : "."}`;
  }
  return `Google answered ${res.status}. Please try again later.`;
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

export interface GbpPublishDeps {
  http: GbpDeps["http"];
  clientId: string;
  clientSecret: string;
}

/** Google access tokens last one hour, so every publish first trades the refresh token for a fresh one. */
export async function publishToGbp(
  post: GbpPost,
  account: { externalId: string; refreshToken: string },
  deps: GbpPublishDeps,
): Promise<{ ok: boolean; id?: string; message?: string }> {
  if (post.mediaKind === "video") return { ok: false, message: "Google Business posts take pictures only. Remove the video or the Google Business target." };
  if (!buildSummary(post.caption)) return { ok: false, message: "The post text is empty." };
  if (!/^accounts\/[A-Za-z0-9_-]+\/locations\/[A-Za-z0-9_-]+$/.test(account.externalId)) {
    return { ok: false, message: "The saved Google Business location is invalid. Press Connect next to Google Business again." };
  }
  if (!account.refreshToken) return { ok: false, message: "The Google login is incomplete. Press Connect next to Google Business again." };
  try {
    const tok = await deps.http({
      method: "POST",
      url: "https://oauth2.googleapis.com/token",
      form: { grant_type: "refresh_token", refresh_token: account.refreshToken, client_id: deps.clientId, client_secret: deps.clientSecret },
    });
    const access = tok.body?.access_token;
    if (tok.status >= 400 || typeof access !== "string") {
      return { ok: false, message: "The Google login expired or was removed. Press Connect next to Google Business again." };
    }
    const res = await deps.http({
      method: "POST",
      url: `https://mybusiness.googleapis.com/v4/${account.externalId}/localPosts`,
      headers: { authorization: `Bearer ${access}` },
      json: buildLocalPost(post),
    });
    const id = res.body?.name;
    if (res.status >= 400 || typeof id !== "string") return { ok: false, message: gbpError(res) };
    return { ok: true, id };
  } catch {
    return { ok: false, message: "Could not reach Google. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Connect flow
// ---------------------------------------------------------------------------

export async function handleStart(req: Request, deps: GbpDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Use POST.");
  const authorization = req.headers.get("authorization");
  let user: { id: string } | null;
  try {
    user = await deps.getUser(authorization);
  } catch {
    return fail(502, "auth_unavailable", "Could not check your login. Please try again.");
  }
  if (!user || !authorization) return fail(401, "unauthorized", "Please sign in again.");
  if (!deps.configured) return fail(503, "gbp_not_configured", NOT_CONFIGURED);
  const workspaceId = await deps.getWorkspaceId(authorization).catch(() => null);
  if (!workspaceId) return fail(404, "no_workspace", "Your workspace was not found. Run the database setup first.");
  const state = await signState({ uid: user.id, ws: workspaceId, exp: deps.now() + STATE_TTL_MS }, deps.stateSecret);
  return json(200, { url: buildAuthUrl({ clientId: deps.clientId, redirectUri: deps.redirectUri, state }) });
}

function back(deps: GbpDeps, query: string): Response {
  const base = deps.siteUrl.replace(/\/+$/, "");
  return new Response(null, { status: 302, headers: { location: `${base}/?${query}`, "cache-control": "no-store" } });
}

/** GET: Google sends the browser here after the user approves. Connects the first business location of the account. */
export async function handleCallback(req: Request, deps: GbpDeps): Promise<Response> {
  if (req.method !== "GET") return fail(405, "method_not_allowed", "Use GET.");
  if (!deps.configured) return back(deps, "connect_error=not_configured&p=gbp");
  const url = new URL(req.url);
  if (url.searchParams.get("error")) return back(deps, "connect_error=denied&p=gbp");
  const code = url.searchParams.get("code");
  const state = await verifyState(url.searchParams.get("state"), deps.stateSecret, deps.now());
  if (!code || !state) return back(deps, "connect_error=bad_state&p=gbp");
  try {
    const tok = await deps.http({
      method: "POST",
      url: "https://oauth2.googleapis.com/token",
      form: { grant_type: "authorization_code", code, redirect_uri: deps.redirectUri, client_id: deps.clientId, client_secret: deps.clientSecret },
    });
    const access = tok.body?.access_token;
    const refresh = tok.body?.refresh_token;
    if (tok.status >= 400 || typeof access !== "string" || typeof refresh !== "string") {
      deps.log?.(`token exchange failed (${tok.status})`);
      return back(deps, "connect_error=token_failed&p=gbp");
    }
    const expiresIn = typeof tok.body.expires_in === "number" && tok.body.expires_in > 0 ? tok.body.expires_in : 3600;
    const auth = { authorization: `Bearer ${access}` };
    const accounts = await deps.http({ method: "GET", url: "https://mybusinessaccountmanagement.googleapis.com/v1/accounts", headers: auth });
    if (accounts.status === 403 || accounts.status === 429) {
      deps.log?.(`accounts lookup refused (${accounts.status})`);
      return back(deps, "connect_error=api_access&p=gbp");
    }
    const accountName = accounts.status < 400 ? parseAccountName(accounts.body) : null;
    if (!accountName) return back(deps, "connect_error=no_location&p=gbp");
    const locs = await deps.http({
      method: "GET",
      url: `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title&pageSize=20`,
      headers: auth,
    });
    if (locs.status === 403 || locs.status === 429) return back(deps, "connect_error=api_access&p=gbp");
    const location = locs.status < 400 ? parseLocations(accountName, locs.body)[0] : undefined;
    if (!location) return back(deps, "connect_error=no_location&p=gbp");
    try {
      await deps.saveAccount(state.ws, {
        externalId: location.path,
        displayName: location.title,
        refreshToken: refresh,
        accessToken: access,
        expiresAt: new Date(deps.now() + expiresIn * 1000).toISOString(),
      });
    } catch {
      return back(deps, "connect_error=save_failed&p=gbp");
    }
    return back(deps, "connected=gbp");
  } catch (e) {
    // Never log the error text: a failed request can contain secrets.
    deps.log?.(`gbp callback failed (${e instanceof Error ? e.name : "unknown"})`);
    return back(deps, "connect_error=google_unreachable&p=gbp");
  }
}
