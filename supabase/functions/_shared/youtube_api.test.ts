import { describe, expect, it } from "vitest";
import {
  YT_COMMENT_SCOPE,
  YT_UPLOAD_SCOPE,
  buildVideoMetadata,
  listYouTubeComments,
  parseThreads,
  publishToYouTube,
  replyOnYouTube,
  videoDescription,
  videoTitle,
  ytError,
  type YtAccount,
  type YtApiDeps,
} from "./youtube_api";
import type { LiHttpRequest, LiHttpResult } from "./linkedin";

const VIDEO = "https://x.supabase.co/storage/v1/object/public/post-media/w1/v.mp4";
const res = (status: number, body: any = null, headers: Record<string, string> = {}): LiHttpResult => ({ status, body, headers });
const account: YtAccount = { externalId: "UCchannel", refreshToken: "RT", scopes: `${YT_UPLOAD_SCOPE} ${YT_COMMENT_SCOPE}` };

function make(over: Partial<YtApiDeps> = {}, replies: Record<string, LiHttpResult> = {}) {
  const calls: LiHttpRequest[] = [];
  const d: YtApiDeps = {
    clientId: "CID",
    clientSecret: "CSECRET",
    fetchVideo: async () => ({ bytes: new Uint8Array([1, 2, 3]), type: "video/mp4" }),
    http: async (req) => {
      calls.push(req);
      const key = `${req.method} ${req.url.split("?")[0]}`;
      if (replies[key]) return replies[key];
      if (req.url === "https://oauth2.googleapis.com/token") return res(200, { access_token: "FRESH" });
      if (req.method === "PUT") return res(200, { id: "vid123" });
      if (req.url.startsWith("https://www.googleapis.com/upload/youtube/v3/videos")) {
        return res(200, null, { location: "https://www.googleapis.com/upload/youtube/v3/videos?upload_id=U1" });
      }
      if (req.method === "PUT") return res(200, { id: "vid123" });
      if (req.url.startsWith("https://www.googleapis.com/youtube/v3/commentThreads")) {
        return res(200, {
          items: [
            { snippet: { totalReplyCount: 0, topLevelComment: { id: "Ugx1abc", snippet: { authorDisplayName: "Sara", authorChannelId: { value: "UCsara" }, textOriginal: "Great video!", publishedAt: "2026-11-08T10:00:00Z" } } } },
            { snippet: { totalReplyCount: 2, topLevelComment: { id: "Ugx2abc", snippet: { authorDisplayName: "Bo", textOriginal: "answered already", publishedAt: "2026-11-08T10:00:00Z" } } } },
            { snippet: { totalReplyCount: 0, topLevelComment: { id: "Ugx3abc", snippet: { authorDisplayName: "Me", authorChannelId: { value: "UCchannel" }, textOriginal: "my own comment", publishedAt: "2026-11-08T10:00:00Z" } } } },
          ],
        });
      }
      if (req.url.startsWith("https://www.googleapis.com/youtube/v3/comments")) return res(200, { id: "reply1" });
      return res(404);
    },
    ...over,
  };
  return { d, calls };
}

describe("text helpers", () => {
  it("uses the first line as the title and removes characters YouTube rejects", () => {
    expect(videoTitle("\n  Big <sale> today \nsecond line")).toBe("Big sale today");
    expect(videoTitle("x".repeat(200)).length).toBe(100);
    expect(videoTitle("   ")).toBe("New video");
  });
  it("adds hashtags to the description", () => {
    expect(videoDescription({ caption: "Hello <b>", hashtags: ["#sale", "new deal", ""] })).toBe("Hello b\n\n#sale #newdeal");
    expect(videoDescription({ caption: "x".repeat(6000), hashtags: [] }).length).toBe(4800);
  });
  it("asks for a public video that is not made for kids", () => {
    const m: any = buildVideoMetadata({ caption: "Hi", hashtags: [], mediaUrl: VIDEO, mediaKind: "video" });
    expect(m.status).toEqual({ privacyStatus: "public", selfDeclaredMadeForKids: false });
    expect(m.snippet.title).toBe("Hi");
  });
  it("keeps only unanswered comments from other people", () => {
    const list = parseThreads(
      { items: [
        { snippet: { totalReplyCount: 0, topLevelComment: { id: "Ugx1abc", snippet: { authorDisplayName: "Sara", textOriginal: "Hi", publishedAt: "2026-11-08T10:00:00Z" } } } },
        { snippet: { totalReplyCount: 1, topLevelComment: { id: "Ugx2abc", snippet: { textOriginal: "x" } } } },
        { snippet: { totalReplyCount: 0, topLevelComment: { id: "bad id!", snippet: { textOriginal: "x" } } } },
        { snippet: { totalReplyCount: 0, topLevelComment: { id: "Ugx4abc", snippet: { textOriginal: "  " } } } },
        null,
      ] },
      "UCchannel",
    );
    expect(list).toEqual([{ externalId: "Ugx1abc", senderName: "Sara", senderHandle: "Sara", body: "Hi", receivedAt: "2026-11-08T10:00:00.000Z" }]);
    expect(parseThreads(null, "UC")).toEqual([]);
  });
  it("explains Google errors in plain words", () => {
    expect(ytError(res(401))).toMatch(/Connect/);
    expect(ytError(res(403, { error: { errors: [{ reason: "quotaExceeded" }] } }))).toMatch(/daily limit/);
    expect(ytError(res(403, { error: { errors: [{ reason: "insufficientPermissions" }] } }))).toMatch(/Connect/);
    expect(ytError(res(403, { error: { errors: [{ reason: "commentsDisabled" }] } }))).toMatch(/turned off/);
    expect(ytError(res(500))).toContain("500");
  });
});

describe("publishToYouTube", () => {
  const post = { caption: "My title\nbody", hashtags: ["a"], mediaUrl: VIDEO, mediaKind: "video" as const };
  it("starts a resumable upload, then sends the video", async () => {
    const m = make();
    const r = await publishToYouTube(post, account, m.d);
    expect(r).toEqual({ ok: true, id: "vid123" });
    expect(m.calls[0].form).toMatchObject({ grant_type: "refresh_token", refresh_token: "RT" });
    expect(m.calls[1].url).toContain("uploadType=resumable");
    expect(m.calls[1].headers).toMatchObject({ authorization: "Bearer FRESH", "x-upload-content-length": "3", "x-upload-content-type": "video/mp4" });
    expect((m.calls[1].json as any).snippet.title).toBe("My title");
    expect(m.calls[2].method).toBe("PUT");
    expect(m.calls[2].url).toContain("upload_id=U1");
    expect(m.calls[2].bytes).toEqual(new Uint8Array([1, 2, 3]));
  });
  it("stops early without a video, without the upload permission, with an unreadable or huge video", async () => {
    const m = make();
    expect((await publishToYouTube({ ...post, mediaKind: "image" }, account, m.d)).message).toMatch(/needs a video/);
    expect((await publishToYouTube(post, { ...account, scopes: "https://www.googleapis.com/auth/youtube.readonly" }, m.d)).message).toMatch(/Connect/);
    expect((await publishToYouTube(post, { ...account, refreshToken: "" }, m.d)).message).toMatch(/incomplete/);
    expect((await publishToYouTube(post, account, make({ fetchVideo: async () => null }).d)).message).toMatch(/could not be read/);
    const huge = make({ fetchVideo: async () => ({ bytes: new Uint8Array(53 * 1024 * 1024), type: "video/mp4" }) });
    expect((await publishToYouTube(post, account, huge.d)).message).toMatch(/too large/);
    expect(m.calls).toHaveLength(0);
  });
  it("reports a removed login, refusals and network failures without leaking secrets", async () => {
    const gone = make({}, { "POST https://oauth2.googleapis.com/token": res(400, { error: "invalid_grant RT" }) });
    const a = await publishToYouTube(post, account, gone.d);
    expect(a.message).toMatch(/expired or was removed/);
    expect(a.message).not.toContain("RT");
    const quota = make({}, { "POST https://www.googleapis.com/upload/youtube/v3/videos": res(403, { error: { errors: [{ reason: "quotaExceeded" }] } }) });
    expect((await publishToYouTube(post, account, quota.d)).message).toMatch(/daily limit/);
    const noLoc = make({}, { "POST https://www.googleapis.com/upload/youtube/v3/videos": res(200, null, { location: "https://evil.test/up" }) });
    expect((await publishToYouTube(post, account, noLoc.d)).ok).toBe(false);
    const noId = make({}, { "PUT https://www.googleapis.com/upload/youtube/v3/videos": res(200, {}) });
    expect((await publishToYouTube(post, account, noId.d)).ok).toBe(false);
    const down = make({ http: async () => { throw new Error("refresh_token=RT"); } });
    expect(await publishToYouTube(post, account, down.d)).toEqual({ ok: false, message: "Could not reach YouTube. Please try again." });
  });
});

describe("comments and replies", () => {
  it("lists the channel's unanswered comments", async () => {
    const m = make();
    const r = await listYouTubeComments(account, m.d);
    expect(r.ok && r.comments.map((c) => c.externalId)).toEqual(["Ugx1abc"]);
    expect(m.calls[1].url).toContain("allThreadsRelatedToChannelId=UCchannel");
  });
  it("explains why comments cannot be read", async () => {
    expect((await listYouTubeComments({ ...account, scopes: YT_UPLOAD_SCOPE }, make().d))).toMatchObject({ ok: false });
    const quota = make({}, { "GET https://www.googleapis.com/youtube/v3/commentThreads": res(403, { error: { errors: [{ reason: "quotaExceeded" }] } }) });
    expect(await listYouTubeComments(account, quota.d)).toMatchObject({ ok: false, message: expect.stringMatching(/daily limit/) });
  });
  it("answers a comment with the comment as parent", async () => {
    const m = make();
    expect(await replyOnYouTube(account, "Ugx1abc", "Thank you!", m.d)).toEqual({ ok: true });
    const call = m.calls[1];
    expect(call.url).toBe("https://www.googleapis.com/youtube/v3/comments?part=snippet");
    expect(call.json).toEqual({ snippet: { parentId: "Ugx1abc", textOriginal: "Thank you!" } });
  });
  it("refuses odd comment ids, missing permission, and reports failures", async () => {
    const m = make();
    expect((await replyOnYouTube(account, "../x", "hi", m.d)).ok).toBe(false);
    expect((await replyOnYouTube({ ...account, scopes: YT_UPLOAD_SCOPE }, "Ugx1abc", "hi", m.d)).ok).toBe(false);
    expect(m.calls).toHaveLength(0);
    const refused = make({}, { "POST https://www.googleapis.com/youtube/v3/comments": res(403, { error: { errors: [{ reason: "commentsDisabled" }] } }) });
    expect(await replyOnYouTube(account, "Ugx1abc", "hi", refused.d)).toMatchObject({ ok: false, message: expect.stringMatching(/turned off/) });
    const down = make({ http: async () => { throw new Error("x"); } });
    expect((await replyOnYouTube(account, "Ugx1abc", "hi", down.d)).ok).toBe(false);
  });
});
