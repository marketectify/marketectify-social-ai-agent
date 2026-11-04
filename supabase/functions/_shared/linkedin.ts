// LinkedIn (member profile) logic: login, saving the account and publishing a post. Import-free so it runs in Deno and in Node tests.
// Everything outside (LinkedIn, database, login check) is injected through `LiDeps`.
// Needs two products on the LinkedIn app: "Sign In with LinkedIn using OpenID Connect" and "Share on LinkedIn" (both self-serve).
import { CORS_HEADERS, STATE_TTL_MS, signState, verifyState } from "./youtube.ts";

export const LI_SCOPES = ["openid", "profile", "w_member_social"];
/** LinkedIn versions are months (YYYYMM) and each is supported for about a year. Override with the LINKEDIN_API_VERSION secret. */
export const DEFAULT_LI_VERSION = "202610";
export const LI_POST_LIMIT = 3000;
export const LI_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export interface LiAccountRow {
  externalId: string;
  displayName: string;
  avatarUrl: string;
  token: string;
  /** ISO time the login stops working (LinkedIn logins last 60 days). */
  expiresAt: string | null;
}

export interface LiPost {
  caption: string;
  hashtags: string[];
  mediaUrl: string | null;
  mediaKind?: "image" | "video" | null;
}

export interface LiHttpRequest {
  method: "GET" | "POST" | "PUT";
  url: string;
  headers?: Record<string, string>;
  form?: Record<string, string>;
  json?: unknown;
  bytes?: Uint8Array;
}
export interface LiHttpResult {
  status: number;
  body: any;
  headers: Record<string, string>;
}

export interface LiDeps {
  configured: boolean;
  siteUrl: string;
  clientId: string;
  clientSecret: string;
  stateSecret: string;
  redirectUri: string;
  apiVersion: string;
  now: () => number;
  getUser: (authorization: string | null) => Promise<{ id: string } | null>;
  getWorkspaceId: (authorization: string) => Promise<string | null>;
  http: (req: LiHttpRequest) => Promise<LiHttpResult>;
  /** Downloads a picture of ours. Returns null when the address is not one of our own files or it is too big. */
  fetchMedia: (url: string) => Promise<{ bytes: Uint8Array; type: string } | null>;
  saveAccount: (workspaceId: string, row: LiAccountRow) => Promise<void>;
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
  "LinkedIn is not set up yet. The site owner needs to add LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET and OAUTH_STATE_SECRET as Supabase secrets.";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function buildAuthUrl(input: { clientId: string; redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    state: input.state,
    scope: LI_SCOPES.join(" "),
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
}

const https = (x: unknown) => (typeof x === "string" && x.startsWith("https://") ? x : "");

/** Reads the answer of /v2/userinfo. Null when there is no usable member id. */
export function parseUserinfo(body: any): { id: string; name: string; avatarUrl: string } | null {
  if (!body || typeof body.sub !== "string" || !/^[A-Za-z0-9_-]{3,64}$/.test(body.sub)) return null;
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : [body.given_name, body.family_name].filter((x) => typeof x === "string").join(" ").trim();
  return { id: body.sub, name: (name || "LinkedIn member").slice(0, 120), avatarUrl: https(body.picture) };
}

/**
 * LinkedIn reads the text as "little text": these characters have a meaning and must be escaped with a backslash,
 * otherwise the post can be cut short or refused.
 */
export function escapeLittleText(text: string): string {
  return text.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);
}

/** Hashtags become real LinkedIn hashtags ({hashtag|\#|word}). Only letters, digits and underscore are kept. */
export function hashtagTemplates(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const word = raw.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "");
    const key = word.toLowerCase();
    if (!word || word.length > 60 || seen.has(key)) continue;
    seen.add(key);
    out.push(`{hashtag|\\#|${word}}`);
  }
  return out.slice(0, 30);
}

/** The text of the post: escaped caption, then hashtags, never longer than LinkedIn allows (and never cut inside an escape). */
export function buildCommentary(post: Pick<LiPost, "caption" | "hashtags">): string {
  const tags = hashtagTemplates(post.hashtags).join(" ");
  const room = LI_POST_LIMIT - (tags ? tags.length + 2 : 0);
  let raw = post.caption.trim();
  while (raw.length > 0 && escapeLittleText(raw).length > room) {
    const over = escapeLittleText(raw).length - room;
    raw = raw.slice(0, Math.max(0, raw.length - Math.max(1, Math.ceil(over / 2)))).trimEnd();
  }
  return [escapeLittleText(raw), tags].filter(Boolean).join("\n\n");
}

export function buildPostBody(input: { author: string; commentary: string; imageUrn?: string }): Record<string, unknown> {
  return {
    author: input.author,
    commentary: input.commentary,
    visibility: "PUBLIC",
    distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
    ...(input.imageUrn ? { content: { media: { id: input.imageUrn } } } : {}),
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };
}

/** A picture of ours: public file in the post-media bucket of this Supabase project. */
export function isOwnMediaUrl(url: string, supabaseUrl: string): boolean {
  try {
    const u = new URL(url);
    const base = new URL(supabaseUrl);
    return u.protocol === "https:" && u.origin === base.origin && u.pathname.startsWith("/storage/v1/object/public/post-media/") && !u.pathname.includes("..");
  } catch {
    return false;
  }
}

/** Text a person can read. Never includes tokens or LinkedIn's raw answer. */
export function liError(res: LiHttpResult): string {
  if (res.status === 401) return "The LinkedIn login expired or was removed. Press Connect next to LinkedIn again.";
  if (res.status === 403) return "LinkedIn refused the post. On your LinkedIn app, check that the product \"Share on LinkedIn\" is added, then press Connect again.";
  if (res.status === 429) return "LinkedIn's daily posting limit is reached. Try again tomorrow.";
  if (res.status === 422 || res.status === 400) {
    const m = typeof res.body?.message === "string" ? res.body.message : "";
    return `LinkedIn did not accept the post${m ? `: ${m.slice(0, 200)}` : "."}`;
  }
  return `LinkedIn answered ${res.status}. Please try again later.`;
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

export interface LiOutcome {
  ok: boolean;
  id?: string;
  message?: string;
}

function liHeaders(token: string, version: string, extra: Record<string, string> = {}): Record<string, string> {
  return { authorization: `Bearer ${token}`, "linkedin-version": version, "x-restli-protocol-version": "2.0.0", ...extra };
}

async function uploadImage(post: LiPost, account: LiAccountRow, deps: Pick<LiDeps, "http" | "fetchMedia" | "apiVersion">): Promise<{ urn: string } | { error: string }> {
  const file = await deps.fetchMedia(post.mediaUrl!);
  if (!file) return { error: "The picture could not be read. Remove it from the post and add it again." };
  if (file.bytes.length > LI_IMAGE_MAX_BYTES) return { error: "The picture is too large for LinkedIn." };
  const owner = `urn:li:person:${account.externalId}`;
  const init = await deps.http({
    method: "POST",
    url: "https://api.linkedin.com/rest/images?action=initializeUpload",
    headers: liHeaders(account.token, deps.apiVersion, { "content-type": "application/json" }),
    json: { initializeUploadRequest: { owner } },
  });
  const uploadUrl = init.body?.value?.uploadUrl;
  const urn = init.body?.value?.image;
  if (init.status >= 400 || typeof uploadUrl !== "string" || !uploadUrl.startsWith("https://") || typeof urn !== "string") {
    return { error: liError(init) };
  }
  const put = await deps.http({ method: "PUT", url: uploadUrl, headers: { authorization: `Bearer ${account.token}`, "content-type": file.type || "image/jpeg" }, bytes: file.bytes });
  if (put.status >= 400) return { error: "LinkedIn did not accept the picture. Please try again." };
  return { urn };
}

export async function publishToLinkedIn(
  post: LiPost,
  account: LiAccountRow,
  deps: Pick<LiDeps, "http" | "fetchMedia" | "apiVersion" | "now">,
): Promise<LiOutcome> {
  if (account.expiresAt && Date.parse(account.expiresAt) <= deps.now()) {
    return { ok: false, message: "The LinkedIn login expired (LinkedIn logins last 60 days). Press Connect next to LinkedIn again." };
  }
  if (post.mediaUrl && post.mediaKind === "video") return { ok: false, message: "Video posts to LinkedIn are not supported yet. Remove the video or post it by hand." };
  const commentary = buildCommentary(post);
  if (!commentary && !post.mediaUrl) return { ok: false, message: "The post is empty." };
  try {
    let imageUrn: string | undefined;
    if (post.mediaUrl) {
      const up = await uploadImage(post, account, deps);
      if ("error" in up) return { ok: false, message: up.error };
      imageUrn = up.urn;
    }
    const res = await deps.http({
      method: "POST",
      url: "https://api.linkedin.com/rest/posts",
      headers: liHeaders(account.token, deps.apiVersion, { "content-type": "application/json" }),
      json: buildPostBody({ author: `urn:li:person:${account.externalId}`, commentary, imageUrn }),
    });
    const id = res.headers["x-restli-id"];
    if (res.status >= 400 || res.status !== 201 || !id) return { ok: false, message: liError(res) };
    return { ok: true, id };
  } catch {
    return { ok: false, message: "Could not reach LinkedIn. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/** POST from the browser (signed in). Returns the LinkedIn login address. */
export async function handleStart(req: Request, deps: LiDeps): Promise<Response> {
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
  if (!deps.configured) return fail(503, "linkedin_not_configured", NOT_CONFIGURED);
  const workspaceId = await deps.getWorkspaceId(authorization).catch(() => null);
  if (!workspaceId) return fail(404, "no_workspace", "Your workspace was not found. Run the database setup first.");
  const state = await signState({ uid: user.id, ws: workspaceId, exp: deps.now() + STATE_TTL_MS }, deps.stateSecret);
  return json(200, { url: buildAuthUrl({ clientId: deps.clientId, redirectUri: deps.redirectUri, state }) });
}

function back(deps: LiDeps, query: string): Response {
  const base = deps.siteUrl.replace(/\/+$/, "");
  return new Response(null, { status: 302, headers: { location: `${base}/?${query}`, "cache-control": "no-store" } });
}

/** GET: LinkedIn sends the browser here after the user approves. */
export async function handleCallback(req: Request, deps: LiDeps): Promise<Response> {
  if (req.method !== "GET") return fail(405, "method_not_allowed", "Use GET.");
  if (!deps.configured) return back(deps, "connect_error=not_configured&p=linkedin");
  const url = new URL(req.url);
  if (url.searchParams.get("error")) return back(deps, "connect_error=denied&p=linkedin");
  const code = url.searchParams.get("code");
  const state = await verifyState(url.searchParams.get("state"), deps.stateSecret, deps.now());
  if (!code || !state) return back(deps, "connect_error=bad_state&p=linkedin");
  try {
    const tok = await deps.http({
      method: "POST",
      url: "https://www.linkedin.com/oauth/v2/accessToken",
      form: { grant_type: "authorization_code", code, redirect_uri: deps.redirectUri, client_id: deps.clientId, client_secret: deps.clientSecret },
    });
    const token = tok.body?.access_token;
    if (tok.status >= 400 || typeof token !== "string") {
      deps.log?.(`token exchange failed (${tok.status})`);
      return back(deps, "connect_error=token_failed&p=linkedin");
    }
    const expiresIn = typeof tok.body.expires_in === "number" && tok.body.expires_in > 0 ? tok.body.expires_in : 60 * 24 * 3600;
    const info = await deps.http({ method: "GET", url: "https://api.linkedin.com/v2/userinfo", headers: { authorization: `Bearer ${token}` } });
    const member = info.status < 400 ? parseUserinfo(info.body) : null;
    if (!member) {
      deps.log?.(`profile lookup failed (${info.status})`);
      return back(deps, "connect_error=profile_failed&p=linkedin");
    }
    try {
      await deps.saveAccount(state.ws, {
        externalId: member.id,
        displayName: member.name,
        avatarUrl: member.avatarUrl,
        token,
        expiresAt: new Date(deps.now() + expiresIn * 1000).toISOString(),
      });
    } catch {
      return back(deps, "connect_error=save_failed&p=linkedin");
    }
    return back(deps, "connected=linkedin");
  } catch (e) {
    // Never log the error text: a failed request can contain secrets.
    deps.log?.(`linkedin callback failed (${e instanceof Error ? e.name : "unknown"})`);
    return back(deps, "connect_error=linkedin_unreachable&p=linkedin");
  }
}
