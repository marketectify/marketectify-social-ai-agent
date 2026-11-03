// Facebook + Instagram (Meta Graph API) logic. Import-free so it runs in Deno and in Node tests.
// Everything outside (Meta, database, login check) is injected through `MetaDeps`.
import { CORS_HEADERS, STATE_TTL_MS, signState, verifyState } from "./youtube.ts";

export const GRAPH_VERSION = "v21.0";
export const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_manage_engagement",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_comments",
];

export type MetaPlatform = "facebook" | "instagram";
/** Platforms this publisher sends posts to by itself. */
export type AutoPlatform = MetaPlatform | "linkedin";
const AUTO: AutoPlatform[] = ["facebook", "instagram", "linkedin"];
const isAuto = (p: string): p is AutoPlatform => (AUTO as string[]).includes(p);
const NAMES: Record<AutoPlatform, string> = { facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn" };

export interface MetaAccountRow {
  platform: AutoPlatform;
  externalId: string;
  displayName: string;
  handle: string;
  avatarUrl: string;
  followers: number | null;
  mediaCount: number;
  /** Page access token (also used for the linked Instagram account). */
  token: string;
  /** When the login stops working (LinkedIn: 60 days). Null/absent: it does not expire. */
  expiresAt?: string | null;
}

export interface PostRow {
  id: string;
  workspaceId: string;
  caption: string;
  hashtags: string[];
  platforms: string[];
  status: string;
  mediaUrl: string | null;
  mediaKind?: "image" | "video" | null;
  externalIds: Record<string, string>;
}

export interface MessageRow {
  id: string;
  workspaceId: string;
  platform: string;
  externalId: string | null;
  status: string;
}

export interface ImportedComment {
  externalId: string;
  platform: MetaPlatform;
  senderName: string;
  senderHandle: string;
  body: string;
  receivedAt: string;
}

export interface GraphResult {
  status: number;
  body: any;
}

export interface MetaDeps {
  configured: boolean;
  siteUrl: string;
  appId: string;
  /** Optional Login Configuration id (Facebook Login for Business). Empty = classic login with scopes. */
  configId: string;
  stateSecret: string;
  cronSecret: string;
  redirectUri: string;
  now: () => number;
  getUser: (authorization: string | null) => Promise<{ id: string } | null>;
  getWorkspaceId: (authorization: string) => Promise<string | null>;
  /** One call to the Graph API. `token` is sent as access_token. */
  graph: (method: "GET" | "POST", path: string, params: Record<string, string>, token?: string) => Promise<GraphResult>;
  saveAccounts: (workspaceId: string, rows: MetaAccountRow[]) => Promise<void>;
  loadAccount: (workspaceId: string, platform: AutoPlatform) => Promise<MetaAccountRow | null>;
  /** Sends the post to LinkedIn (see linkedin.ts). */
  publishLinkedIn: (post: PostRow, account: MetaAccountRow) => Promise<{ ok: boolean; id?: string; message?: string }>;
  loadPost: (workspaceId: string, postId: string) => Promise<PostRow | null>;
  /** Marks the post as "being published". False when another run already holds it (so nothing is posted twice). */
  claimPost: (postId: string) => Promise<boolean>;
  releasePost: (postId: string) => Promise<void>;
  markPost: (postId: string, patch: { published?: boolean; error?: string | null; externalIds?: Record<string, string> }) => Promise<void>;
  importComments: (workspaceId: string, comments: ImportedComment[]) => Promise<number>;
  loadMessage: (workspaceId: string, messageId: string) => Promise<MessageRow | null>;
  markReplied: (messageId: string, reply: string) => Promise<void>;
  /** Cron: approved posts whose time has come, and workspaces that have a Meta account. */
  listDuePosts: (nowIso: string, limit: number) => Promise<PostRow[]>;
  listMetaWorkspaces: () => Promise<string[]>;
  log?: (message: string) => void;
}

/** Compares two secrets without stopping at the first different character. */
export function sameText(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
const fail = (status: number, code: string, message: string) => json(status, { error: { code, message } });

const NOT_CONFIGURED =
  "Facebook and Instagram are not set up yet. The site owner needs to add META_APP_ID, META_APP_SECRET and OAUTH_STATE_SECRET as Supabase secrets.";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Classic Facebook Login sends the permissions as `scope`. Apps created with Meta's newer "Facebook Login for Business"
 * keep the permissions in a Login Configuration instead and need its id as `config_id` (and no `scope`).
 */
export function buildAuthUrl(input: { appId: string; redirectUri: string; state: string; configId?: string }): string {
  const params = new URLSearchParams({
    client_id: input.appId,
    redirect_uri: input.redirectUri,
    state: input.state,
    response_type: "code",
  });
  if (input.configId && /^\d{5,30}$/.test(input.configId)) params.set("config_id", input.configId);
  else params.set("scope", META_SCOPES.join(","));
  return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}

function num(x: unknown): number {
  const n = typeof x === "string" ? Number(x) : typeof x === "number" ? x : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}
const https = (x: unknown) => (typeof x === "string" && x.startsWith("https://") ? x : "");

/** Reads /me/accounts. Picks the first Page that has an Instagram account, else the first Page. */
export function parsePages(body: any): MetaAccountRow[] {
  const pages: any[] = Array.isArray(body?.data) ? body.data.filter((p: any) => typeof p?.id === "string" && typeof p?.access_token === "string") : [];
  if (pages.length === 0) return [];
  const page = pages.find((p) => p.instagram_business_account?.id) ?? pages[0];
  const rows: MetaAccountRow[] = [
    {
      platform: "facebook",
      externalId: page.id,
      displayName: String(page.name ?? "Facebook Page").slice(0, 120),
      handle: "",
      avatarUrl: https(page.picture?.data?.url),
      followers: page.followers_count !== undefined ? num(page.followers_count) : page.fan_count !== undefined ? num(page.fan_count) : null,
      mediaCount: 0,
      token: page.access_token,
    },
  ];
  const ig = page.instagram_business_account;
  if (ig && typeof ig.id === "string") {
    rows.push({
      platform: "instagram",
      externalId: ig.id,
      displayName: String(ig.username ?? "Instagram").slice(0, 120),
      handle: ig.username ? `@${ig.username}` : "",
      avatarUrl: https(ig.profile_picture_url),
      followers: ig.followers_count !== undefined ? num(ig.followers_count) : null,
      mediaCount: num(ig.media_count),
      token: page.access_token,
    });
  }
  return rows;
}

/** Instagram's API only takes JPEG for image_url. Pictures uploaded by the app are converted; older ones may still be PNG or WebP. */
export function isJpegUrl(url: string): boolean {
  const path = url.split("?")[0].toLowerCase();
  return /\.(jpe?g)$/.test(path);
}

export function buildCaption(post: Pick<PostRow, "caption" | "hashtags">): string {
  const tags = post.hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ");
  return [post.caption.trim(), tags].filter(Boolean).join("\n\n").slice(0, 2200);
}

export function parseFbComments(body: any, pageId: string): ImportedComment[] {
  const out: ImportedComment[] = [];
  for (const post of Array.isArray(body?.data) ? body.data : []) {
    for (const c of Array.isArray(post?.comments?.data) ? post.comments.data : []) {
      if (typeof c?.id !== "string" || typeof c?.message !== "string" || !c.message.trim()) continue;
      if (c.from?.id === pageId) continue; // our own reply
      out.push({
        externalId: c.id,
        platform: "facebook",
        senderName: String(c.from?.name ?? "Facebook user").slice(0, 80),
        senderHandle: "",
        body: c.message.slice(0, 2000),
        receivedAt: typeof c.created_time === "string" ? new Date(c.created_time).toISOString() : new Date(0).toISOString(),
      });
    }
  }
  return out;
}

export function parseIgComments(body: any, ownHandle: string): ImportedComment[] {
  const out: ImportedComment[] = [];
  const own = ownHandle.replace(/^@/, "").toLowerCase();
  for (const media of Array.isArray(body?.data) ? body.data : []) {
    for (const c of Array.isArray(media?.comments?.data) ? media.comments.data : []) {
      if (typeof c?.id !== "string" || typeof c?.text !== "string" || !c.text.trim()) continue;
      const user = String(c.username ?? "");
      if (user && user.toLowerCase() === own) continue;
      out.push({
        externalId: c.id,
        platform: "instagram",
        senderName: (user || "Instagram user").slice(0, 80),
        senderHandle: user ? `@${user}`.slice(0, 80) : "",
        body: c.text.slice(0, 2000),
        receivedAt: typeof c.timestamp === "string" ? new Date(c.timestamp).toISOString() : new Date(0).toISOString(),
      });
    }
  }
  return out;
}

/** Text a person can read. Never includes tokens. */
export function graphError(res: GraphResult): string {
  const e = res.body?.error;
  const msg = typeof e?.message === "string" ? e.message : `Meta answered ${res.status}`;
  if (e?.code === 190) return "The Facebook login expired or was removed. Please press Connect again.";
  if (e?.code === 200 || e?.code === 10 || (e?.code === 100 && /permission/i.test(msg))) {
    return `Meta refused: ${msg}. The app may still need that permission (App Review) or you are not an admin/tester of the app.`;
  }
  return msg.slice(0, 300);
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

export interface PublishOutcome {
  platform: AutoPlatform;
  ok: boolean;
  id?: string;
  message?: string;
}

export async function publishToPlatform(post: PostRow, platform: AutoPlatform, deps: MetaDeps): Promise<PublishOutcome> {
  const account = await deps.loadAccount(post.workspaceId, platform);
  if (!account) return { platform, ok: false, message: `${NAMES[platform]} is not connected.` };
  const caption = buildCaption(post);
  try {
    if (platform === "linkedin") {
      const r = await deps.publishLinkedIn(post, account);
      return r.ok && r.id ? { platform, ok: true, id: r.id } : { platform, ok: false, message: r.message ?? "LinkedIn did not accept the post." };
    }
    if (platform === "facebook") {
      const res = post.mediaUrl
        ? await deps.graph("POST", `${account.externalId}/photos`, { url: post.mediaUrl, caption }, account.token)
        : await deps.graph("POST", `${account.externalId}/feed`, { message: caption }, account.token);
      const id = res.body?.post_id ?? res.body?.id;
      if (res.status >= 400 || typeof id !== "string") return { platform, ok: false, message: graphError(res) };
      return { platform, ok: true, id };
    }
    if (!post.mediaUrl) return { platform, ok: false, message: "Instagram posts need a picture. Add one to the post first." };
    if (!isJpegUrl(post.mediaUrl)) {
      return { platform, ok: false, message: "Instagram only accepts JPEG pictures. Remove the picture from the post and add it again (it is converted when you upload it)." };
    }
    const created = await deps.graph("POST", `${account.externalId}/media`, { image_url: post.mediaUrl, caption }, account.token);
    const creation = created.body?.id;
    if (created.status >= 400 || typeof creation !== "string") return { platform, ok: false, message: graphError(created) };
    const done = await deps.graph("POST", `${account.externalId}/media_publish`, { creation_id: creation }, account.token);
    const id = done.body?.id;
    if (done.status >= 400 || typeof id !== "string") return { platform, ok: false, message: graphError(done) };
    return { platform, ok: true, id };
  } catch {
    return { platform, ok: false, message: "Could not reach Meta. Please try again." };
  }
}

/** Publishes to every Facebook/Instagram platform of the post that is not published yet. Updates the post row. */
export async function publishPost(post: PostRow, deps: MetaDeps): Promise<{ outcomes: PublishOutcome[]; allDone: boolean }> {
  const targets = post.platforms.filter((p): p is AutoPlatform => isAuto(p) && !post.externalIds[p]);
  const outcomes: PublishOutcome[] = [];
  const ids = { ...post.externalIds };
  for (const platform of targets) {
    const o = await publishToPlatform(post, platform, deps);
    outcomes.push(o);
    if (o.ok && o.id) ids[platform] = o.id;
  }
  const wanted = post.platforms.filter(isAuto);
  const allDone = wanted.length > 0 && wanted.every((p) => ids[p]);
  const errors = outcomes.filter((o) => !o.ok).map((o) => `${o.platform}: ${o.message}`);
  // A post that also targets TikTok/YouTube is only "published" when nothing else is left to do by hand.
  const onlyMeta = post.platforms.every(isAuto);
  await deps.markPost(post.id, {
    externalIds: ids,
    published: allDone && onlyMeta,
    error: errors.length ? errors.join(" | ").slice(0, 500) : null,
  });
  return { outcomes, allDone };
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function syncWorkspaceComments(workspaceId: string, deps: MetaDeps): Promise<{ imported: number; problems: string[] }> {
  let found: ImportedComment[] = [];
  const problems: string[] = [];
  const fb = await deps.loadAccount(workspaceId, "facebook");
  if (fb) {
    try {
      const res = await deps.graph(
        "GET",
        `${fb.externalId}/feed`,
        { fields: "id,created_time,comments.limit(25){id,message,created_time,from{id,name}}", limit: "10" },
        fb.token,
      );
      if (res.status >= 400) problems.push(`Facebook: ${graphError(res)}`);
      else found = found.concat(parseFbComments(res.body, fb.externalId));
    } catch {
      problems.push("Facebook: could not reach Meta.");
    }
  }
  const ig = await deps.loadAccount(workspaceId, "instagram");
  if (ig) {
    try {
      const res = await deps.graph(
        "GET",
        `${ig.externalId}/media`,
        { fields: "id,comments.limit(25){id,text,username,timestamp}", limit: "10" },
        ig.token,
      );
      if (res.status >= 400) problems.push(`Instagram: ${graphError(res)}`);
      else found = found.concat(parseIgComments(res.body, ig.handle));
    } catch {
      problems.push("Instagram: could not reach Meta.");
    }
  }
  const imported = found.length ? await deps.importComments(workspaceId, found) : 0;
  return { imported, problems };
}

export async function sendReply(message: MessageRow, text: string, deps: MetaDeps): Promise<{ ok: true } | { ok: false; message: string }> {
  if (message.platform !== "facebook" && message.platform !== "instagram") return { ok: false, message: "Only Facebook and Instagram comments can be answered from here." };
  if (!message.externalId) return { ok: false, message: "This message was added by hand, so it cannot be answered on the platform. Copy the reply instead." };
  const account = await deps.loadAccount(message.workspaceId, message.platform);
  if (!account) return { ok: false, message: `${message.platform === "facebook" ? "Facebook" : "Instagram"} is not connected.` };
  try {
    const path = message.platform === "facebook" ? `${message.externalId}/comments` : `${message.externalId}/replies`;
    const res = await deps.graph("POST", path, { message: text }, account.token);
    if (res.status >= 400) return { ok: false, message: graphError(res) };
    await deps.markReplied(message.id, text);
    return { ok: true };
  } catch {
    return { ok: false, message: "Could not reach Meta. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function authenticate(req: Request, deps: MetaDeps): Promise<{ workspaceId: string; userId: string } | Response> {
  const authorization = req.headers.get("authorization");
  let user: { id: string } | null;
  try {
    user = await deps.getUser(authorization);
  } catch {
    return fail(502, "auth_unavailable", "Could not check your login. Please try again.");
  }
  if (!user || !authorization) return fail(401, "unauthorized", "Please sign in again.");
  if (!deps.configured) return fail(503, "meta_not_configured", NOT_CONFIGURED);
  const workspaceId = await deps.getWorkspaceId(authorization).catch(() => null);
  if (!workspaceId) return fail(404, "no_workspace", "Your workspace was not found. Run the database setup first.");
  return { workspaceId, userId: user.id };
}

/** POST from the browser (signed in). Returns the Facebook login address. */
export async function handleStart(req: Request, deps: MetaDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Use POST.");
  const auth = await authenticate(req, deps);
  if (auth instanceof Response) return auth;
  const state = await signState({ uid: auth.userId, ws: auth.workspaceId, exp: deps.now() + STATE_TTL_MS }, deps.stateSecret);
  return json(200, { url: buildAuthUrl({ appId: deps.appId, redirectUri: deps.redirectUri, state, configId: deps.configId }) });
}

function back(deps: MetaDeps, query: string): Response {
  const base = deps.siteUrl.replace(/\/+$/, "");
  return new Response(null, { status: 302, headers: { location: `${base}/?${query}`, "cache-control": "no-store" } });
}

/** GET: Facebook sends the browser here after the user approves. */
export async function handleCallback(req: Request, deps: MetaDeps): Promise<Response> {
  if (req.method !== "GET") return fail(405, "method_not_allowed", "Use GET.");
  if (!deps.configured) return back(deps, "connect_error=not_configured&p=meta");
  const url = new URL(req.url);
  if (url.searchParams.get("error")) return back(deps, "connect_error=denied&p=meta");
  const code = url.searchParams.get("code");
  const state = await verifyState(url.searchParams.get("state"), deps.stateSecret, deps.now());
  if (!code || !state) return back(deps, "connect_error=bad_state&p=meta");
  try {
    const short = await deps.graph("GET", "oauth/access_token", { code, redirect_uri: deps.redirectUri });
    if (short.status >= 400 || typeof short.body?.access_token !== "string") {
      deps.log?.(`token exchange failed (${short.status})`);
      return back(deps, "connect_error=token_failed&p=meta");
    }
    const long = await deps.graph("GET", "oauth/access_token", { grant_type: "fb_exchange_token", fb_exchange_token: short.body.access_token });
    const userToken = long.status < 400 && typeof long.body?.access_token === "string" ? long.body.access_token : short.body.access_token;
    // Page tokens taken with a long-lived user token do not expire.
    const pages = await deps.graph(
      "GET",
      "me/accounts",
      { fields: "id,name,access_token,picture{url},followers_count,fan_count,instagram_business_account{id,username,profile_picture_url,followers_count,media_count}", limit: "25" },
      userToken,
    );
    if (pages.status >= 400) {
      deps.log?.(`page lookup failed (${pages.status})`);
      return back(deps, "connect_error=pages_failed&p=meta");
    }
    const rows = parsePages(pages.body);
    if (rows.length === 0) return back(deps, "connect_error=no_page&p=meta");
    await deps.saveAccounts(state.ws, rows);
    return back(deps, `connected=meta&ig=${rows.some((r) => r.platform === "instagram") ? "1" : "0"}`);
  } catch (e) {
    // Never log the error text: a failed request can contain the full address with the access token in it.
    deps.log?.(`meta callback failed (${e instanceof Error ? e.name : "unknown"})`);
    return back(deps, "connect_error=meta_unreachable&p=meta");
  }
}

/** POST { action: "publish" | "sync" | "reply", ... } from the browser (signed in). */
export async function handleApi(req: Request, deps: MetaDeps): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Use POST.");
  const auth = await authenticate(req, deps);
  if (auth instanceof Response) return auth;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail(400, "bad_request", "Send JSON.");
  }
  const action = body?.action;

  if (action === "publish") {
    if (typeof body.postId !== "string") return fail(400, "bad_request", "postId is required.");
    const post = await deps.loadPost(auth.workspaceId, body.postId).catch(() => null);
    if (!post) return fail(404, "post_not_found", "Post not found.");
    if (post.status === "published") return fail(409, "already_published", "This post is already marked as published.");
    if (post.status !== "approved") return fail(409, "not_approved", "Approve the post first. Only approved posts are published.");
    if (!post.platforms.some(isAuto)) {
      return fail(400, "no_meta_platform", "This post has no Facebook, Instagram or LinkedIn platform.");
    }
    if (!(await deps.claimPost(post.id).catch(() => false))) return fail(409, "busy", "This post is being published right now. Wait a moment and reload.");
    try {
      const { outcomes, allDone } = await publishPost(post, deps);
      return json(200, { outcomes, published: allDone });
    } finally {
      await deps.releasePost(post.id).catch(() => undefined);
    }
  }

  if (action === "sync") {
    const { imported, problems } = await syncWorkspaceComments(auth.workspaceId, deps);
    return json(200, { imported, problems });
  }

  if (action === "reply") {
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (typeof body.messageId !== "string" || !text) return fail(400, "bad_request", "messageId and text are required.");
    if (text.length > 2000) return fail(400, "too_long", "The reply is too long.");
    const message = await deps.loadMessage(auth.workspaceId, body.messageId).catch(() => null);
    if (!message) return fail(404, "message_not_found", "Message not found.");
    const result = await sendReply(message, text, deps);
    return result.ok ? json(200, { ok: true }) : fail(422, "reply_failed", result.message);
  }

  return fail(400, "bad_action", "Unknown action.");
}

/** Called by the scheduler (header x-cron-secret). Publishes due posts and imports new comments. */
export async function handleCron(req: Request, deps: MetaDeps): Promise<Response> {
  if (req.method !== "POST") return fail(405, "method_not_allowed", "Use POST.");
  if (!deps.configured || !deps.cronSecret) return fail(503, "not_configured", "CRON_SECRET is not set.");
  const given = req.headers.get("x-cron-secret") ?? "";
  if (!sameText(given, deps.cronSecret)) return fail(401, "unauthorized", "Wrong secret.");
  const due = await deps.listDuePosts(new Date(deps.now()).toISOString(), 20);
  let published = 0;
  let failed = 0;
  for (const post of due) {
    if (!(await deps.claimPost(post.id).catch(() => false))) continue; // another run is already on it
    try {
      const { allDone, outcomes } = await publishPost(post, deps);
      if (allDone) published += 1;
      if (outcomes.some((o) => !o.ok)) failed += 1;
    } catch (e) {
      failed += 1;
      deps.log?.(`publish failed (${e instanceof Error ? e.name : "unknown"})`);
    } finally {
      await deps.releasePost(post.id).catch(() => undefined);
    }
  }
  let imported = 0;
  for (const ws of await deps.listMetaWorkspaces()) {
    const r = await syncWorkspaceComments(ws, deps).catch(() => ({ imported: 0, problems: [] as string[] }));
    imported += r.imported;
  }
  return json(200, { due: due.length, published, failed, imported });
}
