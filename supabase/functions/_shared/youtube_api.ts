// YouTube posting and comments for the connected channel. Pure logic: the network comes in through deps so it can be tested.
// Needs the scopes youtube.upload (post videos) and youtube.force-ssl (read comments and reply), see YT_SCOPE in youtube.ts.
// Note: videos uploaded by a Google project that has not passed Google's YouTube API audit stay PRIVATE on YouTube.
import type { LiHttpRequest, LiHttpResult } from "./linkedin.ts";

export const YT_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";
export const YT_COMMENT_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";
export const YT_VIDEO_MAX_BYTES = 52 * 1024 * 1024;

export interface YtPost {
  caption: string;
  hashtags: string[];
  mediaUrl: string | null;
  mediaKind?: "image" | "video" | null;
}

export interface YtAccount {
  /** The channel id. */
  externalId: string;
  refreshToken: string;
  /** Space separated scopes saved at connect time (may be empty for old connections). */
  scopes?: string | null;
}

export interface YtComment {
  externalId: string;
  senderName: string;
  senderHandle: string;
  body: string;
  receivedAt: string;
}

export interface YtApiDeps {
  http: (req: LiHttpRequest) => Promise<LiHttpResult>;
  fetchVideo: (url: string) => Promise<{ bytes: Uint8Array; type: string } | null>;
  clientId: string;
  clientSecret: string;
}

const hasScope = (scopes: string | null | undefined, scope: string) => (scopes ?? "").split(/\s+/).includes(scope);
const RECONNECT = "Press Connect next to YouTube again and allow posting and comments.";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** YouTube rejects "<" and ">" in titles and descriptions. */
const clean = (t: string) => t.replace(/[<>]/g, "");

/** The first line of the caption is the video title (100 characters at most). */
export function videoTitle(caption: string): string {
  const first = clean(caption).split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
  return (first.length > 100 ? first.slice(0, 99).trimEnd() + "…" : first) || "New video";
}

export function videoDescription(post: Pick<YtPost, "caption" | "hashtags">): string {
  const tags = post.hashtags.map((t) => t.replace(/[^\p{L}\p{N}_]/gu, "")).filter(Boolean).map((t) => `#${t}`).join(" ");
  return [clean(post.caption).trim(), tags].filter(Boolean).join("\n\n").slice(0, 4800);
}

export function buildVideoMetadata(post: YtPost): Record<string, unknown> {
  return {
    snippet: { title: videoTitle(post.caption), description: videoDescription(post), categoryId: "22" },
    status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
  };
}

/** Top level comments nobody has answered yet, written by other people. */
export function parseThreads(body: any, channelId: string): YtComment[] {
  const items: any[] = Array.isArray(body?.items) ? body.items : [];
  const out: YtComment[] = [];
  for (const it of items) {
    const top = it?.snippet?.topLevelComment;
    const s = top?.snippet;
    if (typeof top?.id !== "string" || !/^[A-Za-z0-9_.-]{5,100}$/.test(top.id) || !s) continue;
    if (Number(it.snippet.totalReplyCount) > 0) continue;
    const authorId = typeof s.authorChannelId?.value === "string" ? s.authorChannelId.value : "";
    if (authorId && authorId === channelId) continue;
    const text = String(s.textOriginal ?? s.textDisplay ?? "").trim();
    if (!text) continue;
    const when = new Date(String(s.publishedAt ?? ""));
    out.push({
      externalId: top.id,
      senderName: String(s.authorDisplayName ?? "YouTube viewer").slice(0, 120),
      senderHandle: String(s.authorDisplayName ?? "").slice(0, 120),
      body: text.slice(0, 2000),
      receivedAt: Number.isNaN(when.getTime()) ? new Date(0).toISOString() : when.toISOString(),
    });
  }
  return out;
}

export function ytError(res: LiHttpResult): string {
  const reason = String(res.body?.error?.errors?.[0]?.reason ?? "");
  if (res.status === 401) return `The Google login was removed. ${RECONNECT}`;
  if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") return "YouTube's daily limit for this app is used up. Try again tomorrow.";
  if (reason === "uploadLimitExceeded") return "This channel reached its upload limit for today. Try again tomorrow.";
  if (reason === "commentsDisabled") return "Comments are turned off for this video.";
  if (reason === "insufficientPermissions" || (res.status === 403 && reason === "forbidden")) return `Google did not allow this. ${RECONNECT}`;
  if (res.status === 403) return "YouTube refused the request. Check that the YouTube Data API is enabled and this Google account owns the channel.";
  if (res.status === 429) return "YouTube's request limit is reached. Try again in a few minutes.";
  return `YouTube answered ${res.status}. Please try again later.`;
}

/** Google access tokens last one hour, so every action first trades the refresh token for a fresh one. */
async function freshToken(refreshToken: string, deps: YtApiDeps): Promise<{ ok: true; token: string } | { ok: false; message: string }> {
  const tok = await deps.http({
    method: "POST",
    url: "https://oauth2.googleapis.com/token",
    form: { grant_type: "refresh_token", refresh_token: refreshToken, client_id: deps.clientId, client_secret: deps.clientSecret },
  });
  const access = tok.body?.access_token;
  if (tok.status >= 400 || typeof access !== "string") {
    return { ok: false, message: `The Google login expired or was removed. ${RECONNECT}` };
  }
  return { ok: true, token: access };
}

// ---------------------------------------------------------------------------
// Posting
// ---------------------------------------------------------------------------

export async function publishToYouTube(
  post: YtPost,
  account: YtAccount,
  deps: YtApiDeps,
): Promise<{ ok: boolean; id?: string; message?: string }> {
  if (post.mediaKind !== "video" || !post.mediaUrl) return { ok: false, message: "YouTube needs a video. Add an MP4 to the post." };
  if (account.scopes && !hasScope(account.scopes, YT_UPLOAD_SCOPE)) return { ok: false, message: `Posting is not allowed yet. ${RECONNECT}` };
  if (!account.refreshToken) return { ok: false, message: `The Google login is incomplete. ${RECONNECT}` };
  try {
    const media = await deps.fetchVideo(post.mediaUrl);
    if (!media) return { ok: false, message: "The video could not be read. Upload it again." };
    if (media.bytes.length > YT_VIDEO_MAX_BYTES) return { ok: false, message: "The video is too large to send from here (limit 50 MB)." };
    const t = await freshToken(account.refreshToken, deps);
    if (!t.ok) return { ok: false, message: t.message };
    const auth = { authorization: `Bearer ${t.token}` };
    const start = await deps.http({
      method: "POST",
      url: "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      headers: { ...auth, "x-upload-content-type": media.type || "video/mp4", "x-upload-content-length": String(media.bytes.length) },
      json: buildVideoMetadata(post),
    });
    const location = start.headers?.location;
    if (start.status >= 400 || typeof location !== "string" || !location.startsWith("https://www.googleapis.com/upload/")) {
      return { ok: false, message: ytError(start) };
    }
    const sent = await deps.http({ method: "PUT", url: location, headers: { ...auth, "content-type": media.type || "video/mp4" }, bytes: media.bytes });
    const id = sent.body?.id;
    if (sent.status >= 400 || typeof id !== "string") return { ok: false, message: ytError(sent) };
    return { ok: true, id };
  } catch {
    return { ok: false, message: "Could not reach YouTube. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function listYouTubeComments(
  account: YtAccount,
  deps: YtApiDeps,
): Promise<{ ok: true; comments: YtComment[] } | { ok: false; message: string }> {
  if (account.scopes && !hasScope(account.scopes, YT_COMMENT_SCOPE)) return { ok: false, message: `Comments are not allowed yet. ${RECONNECT}` };
  if (!account.refreshToken) return { ok: false, message: `The Google login is incomplete. ${RECONNECT}` };
  try {
    const t = await freshToken(account.refreshToken, deps);
    if (!t.ok) return { ok: false, message: t.message };
    const q = new URLSearchParams({ part: "snippet", allThreadsRelatedToChannelId: account.externalId, maxResults: "50", order: "time", textFormat: "plainText" });
    const res = await deps.http({ method: "GET", url: `https://www.googleapis.com/youtube/v3/commentThreads?${q.toString()}`, headers: { authorization: `Bearer ${t.token}` } });
    if (res.status >= 400) return { ok: false, message: ytError(res) };
    return { ok: true, comments: parseThreads(res.body, account.externalId) };
  } catch {
    return { ok: false, message: "Could not reach YouTube." };
  }
}

export async function replyOnYouTube(
  account: YtAccount,
  parentId: string,
  text: string,
  deps: YtApiDeps,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!/^[A-Za-z0-9_.-]{5,100}$/.test(parentId)) return { ok: false, message: "This comment cannot be answered on YouTube." };
  if (account.scopes && !hasScope(account.scopes, YT_COMMENT_SCOPE)) return { ok: false, message: `Replying is not allowed yet. ${RECONNECT}` };
  if (!account.refreshToken) return { ok: false, message: `The Google login is incomplete. ${RECONNECT}` };
  try {
    const t = await freshToken(account.refreshToken, deps);
    if (!t.ok) return { ok: false, message: t.message };
    const res = await deps.http({
      method: "POST",
      url: "https://www.googleapis.com/youtube/v3/comments?part=snippet",
      headers: { authorization: `Bearer ${t.token}` },
      json: { snippet: { parentId, textOriginal: text.slice(0, 9000) } },
    });
    if (res.status >= 400) return { ok: false, message: ytError(res) };
    return { ok: true };
  } catch {
    return { ok: false, message: "Could not reach YouTube. Please try again." };
  }
}
