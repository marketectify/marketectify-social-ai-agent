// Shared, import-free logic for the YouTube connection (runs in Deno, Node tests and nowhere near the browser).
// All outside access (Google, database, login check) is injected through `YtDeps`, so the whole flow is testable.

export const YT_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
export const STATE_TTL_MS = 10 * 60_000;

export const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-max-age": "86400",
};

// ---------------------------------------------------------------------------
// Signed "state" value: proves the callback belongs to a sign-in we started
// ---------------------------------------------------------------------------

export interface StatePayload {
  uid: string;
  ws: string;
  exp: number;
}

const enc = new TextEncoder();

function toB64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

export async function signState(payload: StatePayload, secret: string): Promise<string> {
  const body = toB64Url(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), enc.encode(body)));
  return `${body}.${toB64Url(sig)}`;
}

export async function verifyState(token: string | null, secret: string, now: number): Promise<StatePayload | null> {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  try {
    const valid = await crypto.subtle.verify("HMAC", await hmacKey(secret, "verify"), fromB64Url(parts[1]), enc.encode(parts[0]));
    if (!valid) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64Url(parts[0])));
    if (typeof data?.uid !== "string" || typeof data?.ws !== "string" || typeof data?.exp !== "number") return null;
    if (data.exp < now) return null;
    return data as StatePayload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Google URLs and channel parsing
// ---------------------------------------------------------------------------

export function buildAuthUrl(input: { clientId: string; redirectUri: string; state: string }): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: YT_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state: input.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface ChannelInfo {
  externalId: string;
  name: string;
  handle: string;
  avatarUrl: string;
  subscribers: number | null;
  videos: number;
  views: number;
}

function num(x: unknown): number {
  const n = typeof x === "string" ? Number(x) : typeof x === "number" ? x : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

export function parseChannel(response: unknown): ChannelInfo | null {
  const items = (response as { items?: unknown })?.items;
  if (!Array.isArray(items) || items.length === 0) return null;
  const item = items[0] as Record<string, any>;
  if (typeof item?.id !== "string" || !item.id) return null;
  const snippet = item.snippet ?? {};
  const stats = item.statistics ?? {};
  const thumbs = snippet.thumbnails ?? {};
  const avatar = thumbs.default?.url ?? thumbs.medium?.url ?? "";
  return {
    externalId: item.id,
    name: String(snippet.title ?? "YouTube channel").slice(0, 120),
    handle: String(snippet.customUrl ?? "").slice(0, 120),
    avatarUrl: typeof avatar === "string" && avatar.startsWith("https://") ? avatar : "",
    subscribers: stats.hiddenSubscriberCount === true ? null : num(stats.subscriberCount),
    videos: num(stats.videoCount),
    views: num(stats.viewCount),
  };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export type TokenResult =
  | { ok: true; accessToken: string; refreshToken?: string; expiresIn: number; scope: string }
  | { ok: false; code: string };

export interface StoredAccount {
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
}

export interface YtDeps {
  configured: boolean;
  siteUrl: string;
  clientId: string;
  stateSecret: string;
  redirectUri: string;
  now: () => number;
  getUser: (authorization: string | null) => Promise<{ id: string } | null>;
  getWorkspaceId: (authorization: string) => Promise<string | null>;
  exchangeCode: (code: string) => Promise<TokenResult>;
  refreshAccessToken: (refreshToken: string) => Promise<{ accessToken: string; expiresIn: number } | null>;
  fetchChannel: (accessToken: string) => Promise<{ status: number; body: unknown }>;
  saveAccount: (row: {
    workspaceId: string;
    channel: ChannelInfo;
    accessToken: string;
    refreshToken?: string;
    expiresAt: string;
    scope: string;
  }) => Promise<void>;
  loadAccount: (workspaceId: string) => Promise<StoredAccount | null>;
  updateStats: (workspaceId: string, patch: { channel: ChannelInfo; accessToken?: string; expiresAt?: string }) => Promise<void>;
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
  "YouTube is not set up yet. The site owner needs to add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and OAUTH_STATE_SECRET as Supabase secrets.";

/** POST from the browser (signed in). Returns the Google consent URL to send the user to. */
export async function handleStart(req: Request, deps: YtDeps): Promise<Response> {
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
  if (!deps.configured) return fail(503, "youtube_not_configured", NOT_CONFIGURED);
  let workspaceId: string | null;
  try {
    workspaceId = await deps.getWorkspaceId(authorization);
  } catch {
    workspaceId = null;
  }
  if (!workspaceId) return fail(404, "no_workspace", "Your workspace was not found. Run the database setup first.");
  const state = await signState({ uid: user.id, ws: workspaceId, exp: deps.now() + STATE_TTL_MS }, deps.stateSecret);
  return json(200, { url: buildAuthUrl({ clientId: deps.clientId, redirectUri: deps.redirectUri, state }) });
}

function back(deps: YtDeps, query: string): Response {
  const base = deps.siteUrl.replace(/\/+$/, "");
  return new Response(null, { status: 302, headers: { location: `${base}/?${query}`, "cache-control": "no-store" } });
}

/** GET: Google sends the browser here after the user approves. */
export async function handleCallback(req: Request, deps: YtDeps): Promise<Response> {
  if (req.method !== "GET") return fail(405, "method_not_allowed", "Use GET.");
  if (!deps.configured) return back(deps, "connect_error=not_configured");
  const url = new URL(req.url);
  if (url.searchParams.get("error")) return back(deps, "connect_error=denied");
  const code = url.searchParams.get("code");
  const state = await verifyState(url.searchParams.get("state"), deps.stateSecret, deps.now());
  if (!code || !state) return back(deps, "connect_error=bad_state");

  let tokens: TokenResult;
  try {
    tokens = await deps.exchangeCode(code);
  } catch {
    return back(deps, "connect_error=google_unreachable");
  }
  if (!tokens.ok) {
    deps.log?.(`token exchange failed: ${tokens.code}`);
    return back(deps, "connect_error=token_failed");
  }
  let channelRes: { status: number; body: unknown };
  try {
    channelRes = await deps.fetchChannel(tokens.accessToken);
  } catch {
    return back(deps, "connect_error=google_unreachable");
  }
  if (channelRes.status === 403 || channelRes.status === 401) {
    deps.log?.(`channel lookup refused (${channelRes.status})`);
    return back(deps, "connect_error=api_disabled");
  }
  const channel = parseChannel(channelRes.body);
  if (!channel) return back(deps, "connect_error=no_channel");
  try {
    await deps.saveAccount({
      workspaceId: state.ws,
      channel,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(deps.now() + tokens.expiresIn * 1000).toISOString(),
      scope: tokens.scope,
    });
  } catch (e) {
    deps.log?.(`saving the account failed: ${e instanceof Error ? e.message : "unknown"}`);
    return back(deps, "connect_error=save_failed");
  }
  return back(deps, "connected=youtube");
}

/** POST from the browser (signed in). Re-reads the channel numbers from YouTube. */
export async function handleRefresh(req: Request, deps: YtDeps): Promise<Response> {
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
  if (!deps.configured) return fail(503, "youtube_not_configured", NOT_CONFIGURED);

  const workspaceId = await deps.getWorkspaceId(authorization).catch(() => null);
  if (!workspaceId) return fail(404, "no_workspace", "Your workspace was not found.");
  const account = await deps.loadAccount(workspaceId).catch(() => null);
  if (!account) return fail(404, "not_connected", "YouTube is not connected.");

  let accessToken = account.accessToken;
  let expiresAt: string | undefined;
  const expired = !accessToken || !account.tokenExpiresAt || new Date(account.tokenExpiresAt).getTime() - deps.now() < 60_000;
  if (expired) {
    if (!account.refreshToken) return fail(409, "reconnect_needed", "Please reconnect YouTube.");
    const fresh = await deps.refreshAccessToken(account.refreshToken).catch(() => null);
    if (!fresh) return fail(409, "reconnect_needed", "Google no longer accepts the saved login. Please reconnect YouTube.");
    accessToken = fresh.accessToken;
    expiresAt = new Date(deps.now() + fresh.expiresIn * 1000).toISOString();
  }
  let res: { status: number; body: unknown };
  try {
    res = await deps.fetchChannel(accessToken as string);
  } catch {
    return fail(502, "google_unreachable", "Could not reach YouTube. Please try again.");
  }
  if (res.status === 401 || res.status === 403) return fail(409, "reconnect_needed", "YouTube refused the request. Please reconnect.");
  const channel = parseChannel(res.body);
  if (!channel) return fail(502, "no_channel", "No YouTube channel was found for this account.");
  await deps.updateStats(workspaceId, { channel, accessToken: expired ? (accessToken as string) : undefined, expiresAt });
  return json(200, { ok: true });
}
