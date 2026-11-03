import { describe, expect, it } from "vitest";
import {
  buildAuthUrl,
  buildCaption,
  graphError,
  handleApi,
  handleCallback,
  handleCron,
  handleStart,
  isJpegUrl,
  parseFbComments,
  parseIgComments,
  parsePages,
  publishPost,
  sameText,
  syncWorkspaceComments,
  type GraphResult,
  type MetaDeps,
  type PostRow,
} from "./meta";
import { signState } from "./youtube";

const SECRET = "state-secret";
const NOW = 1_800_000_000_000;
const JPG = "https://x.supabase.co/storage/v1/object/public/post-media/w1/a.jpg";

const pagesBody = {
  data: [
    { id: "P0", name: "No IG page", access_token: "T0" },
    { id: "P1", name: "Acme", access_token: "T1", fan_count: 120, picture: { data: { url: "https://p/1.jpg" } }, instagram_business_account: { id: "IG1", username: "acme", followers_count: 55, media_count: 9, profile_picture_url: "https://p/ig.jpg" } },
  ],
};

const post = (over: Partial<PostRow> = {}): PostRow => ({
  id: "p1", workspaceId: "w1", caption: "Hello", hashtags: ["sale", "#new"], platforms: ["facebook", "instagram"],
  status: "approved", mediaUrl: JPG, externalIds: {}, ...over,
});

function make(over: Partial<MetaDeps> = {}, replies: Record<string, GraphResult> = {}) {
  const calls: { method: string; path: string; params: Record<string, string>; token?: string }[] = [];
  const marks: any[] = [];
  const saved: any[] = [];
  const imported: any[] = [];
  const replied: any[] = [];
  const claimed = new Set<string>();
  const released: string[] = [];
  const logs: string[] = [];
  const d: MetaDeps = {
    configured: true,
    siteUrl: "https://site.test/",
    appId: "APP",
    configId: "",
    stateSecret: SECRET,
    cronSecret: "cron-secret",
    redirectUri: "https://x.supabase.co/functions/v1/meta-callback",
    now: () => NOW,
    getUser: async (a) => (a === "Bearer good" ? { id: "u1" } : null),
    getWorkspaceId: async () => "w1",
    graph: async (method, path, params, token) => {
      calls.push({ method, path, params, token });
      const key = `${method} ${path}`;
      const hit = replies[key];
      if (hit) return hit;
      if (path === "oauth/access_token") return { status: 200, body: { access_token: "UT" } };
      if (path === "me/accounts") return { status: 200, body: pagesBody };
      if (path.endsWith("/photos")) return { status: 200, body: { id: "ph1", post_id: "P1_900" } };
      if (path.endsWith("/feed") && method === "POST") return { status: 200, body: { id: "P1_901" } };
      if (path.endsWith("/media") && method === "POST") return { status: 200, body: { id: "c1" } };
      if (path.endsWith("/media_publish")) return { status: 200, body: { id: "ig900" } };
      return { status: 200, body: { data: [] } };
    },
    saveAccounts: async (ws, rows) => void saved.push({ ws, rows }),
    loadAccount: async (_ws, platform) => ({ platform, externalId: platform === "facebook" ? "P1" : "IG1", displayName: "Acme", handle: platform === "instagram" ? "@acme" : "", avatarUrl: "", followers: 1, mediaCount: 0, token: "PT" }),
    loadPost: async () => post(),
    publishLinkedIn: async () => ({ ok: true, id: "urn:li:share:77" }),
    claimPost: async (id) => (claimed.has(id) ? false : (claimed.add(id), true)),
    releasePost: async (id) => void (claimed.delete(id), released.push(id)),
    markPost: async (id, patch) => void marks.push({ id, ...patch }),
    importComments: async (ws, comments) => (imported.push({ ws, comments }), comments.length),
    loadMessage: async () => ({ id: "m1", workspaceId: "w1", platform: "facebook", externalId: "C1", status: "unread" }),
    markReplied: async (id, text) => void replied.push({ id, text }),
    listDuePosts: async () => [post()],
    listMetaWorkspaces: async () => ["w1"],
    log: (m) => logs.push(m),
    ...over,
  };
  return { d, calls, marks, saved, imported, replied, claimed, released, logs };
}

const req = (body: unknown, auth: string | null = "Bearer good", method = "POST") =>
  new Request("https://x.test/f", { method, headers: { ...(auth ? { authorization: auth } : {}), "content-type": "application/json" }, body: method === "GET" ? undefined : JSON.stringify(body) });

describe("pure helpers", () => {
  it("builds the login address with every scope and the state", () => {
    const u = new URL(buildAuthUrl({ appId: "A", redirectUri: "https://r/cb", state: "S" }));
    expect(u.hostname).toBe("www.facebook.com");
    expect(u.searchParams.get("client_id")).toBe("A");
    expect(u.searchParams.get("state")).toBe("S");
    expect(u.searchParams.get("scope")).toContain("instagram_content_publish");
    expect(u.searchParams.get("scope")).toContain("pages_manage_engagement");
  });
  it("uses config_id (and no scope) for Facebook Login for Business, and ignores a bad id", () => {
    const u = new URL(buildAuthUrl({ appId: "A", redirectUri: "https://r/cb", state: "S", configId: "1234567890123" }));
    expect(u.searchParams.get("config_id")).toBe("1234567890123");
    expect(u.searchParams.has("scope")).toBe(false);
    expect(u.searchParams.get("response_type")).toBe("code");
    const bad = new URL(buildAuthUrl({ appId: "A", redirectUri: "https://r/cb", state: "S", configId: "abc&scope=evil" }));
    expect(bad.searchParams.has("config_id")).toBe(false);
    expect(bad.searchParams.get("scope")).toContain("pages_manage_posts");
  });
  it("prefers the Page that has Instagram and never trusts non-https pictures", () => {
    const rows = parsePages(pagesBody);
    expect(rows.map((r) => [r.platform, r.externalId, r.token])).toEqual([["facebook", "P1", "T1"], ["instagram", "IG1", "T1"]]);
    expect(rows[1].handle).toBe("@acme");
    expect(parsePages({ data: [{ id: "P", name: "x", access_token: "t", picture: { data: { url: "http://evil" } } }] })[0].avatarUrl).toBe("");
    expect(parsePages({})).toEqual([]);
    expect(parsePages({ data: [{ id: "P", name: "no token" }] })).toEqual([]);
  });
  it("builds a caption with hashtags and the 2200 limit", () => {
    expect(buildCaption({ caption: " Hi ", hashtags: ["a", "#b"] })).toBe("Hi\n\n#a #b");
    expect(buildCaption({ caption: "x".repeat(3000), hashtags: [] })).toHaveLength(2200);
    expect(buildCaption({ caption: "", hashtags: [] })).toBe("");
  });
  it("accepts only JPEG pictures for Instagram", () => {
    expect(isJpegUrl(JPG)).toBe(true);
    expect(isJpegUrl(JPG + "?v=2")).toBe(true);
    expect(isJpegUrl("https://x/a.PNG")).toBe(false);
    expect(isJpegUrl("https://x/a.webp")).toBe(false);
  });
  it("skips our own comments and junk", () => {
    const fb = parseFbComments({ data: [{ comments: { data: [
      { id: "1", message: "hi", from: { id: "U", name: "Ann" }, created_time: "2026-11-01T10:00:00+0000" },
      { id: "2", message: "our reply", from: { id: "P1", name: "Acme" } },
      { id: "3", message: "  " }, { message: "no id" },
    ] } }] }, "P1");
    expect(fb.map((c) => c.externalId)).toEqual(["1"]);
    expect(fb[0].receivedAt).toBe("2026-11-01T10:00:00.000Z");
    const ig = parseIgComments({ data: [{ comments: { data: [
      { id: "a", text: "nice", username: "bob", timestamp: "2026-11-01T11:00:00+0000" },
      { id: "b", text: "mine", username: "Acme" },
    ] } }] }, "@acme");
    expect(ig.map((c) => [c.externalId, c.senderHandle])).toEqual([["a", "@bob"]]);
  });
  it("turns Meta errors into readable text without leaking anything", () => {
    expect(graphError({ status: 400, body: { error: { code: 190, message: "token abc" } } })).toMatch(/Connect again/);
    expect(graphError({ status: 400, body: { error: { code: 200, message: "no perm" } } })).toMatch(/App Review/);
    expect(graphError({ status: 500, body: null })).toBe("Meta answered 500");
    expect(graphError({ status: 400, body: { error: { code: 1, message: "x".repeat(900) } } })).toHaveLength(300);
  });
  it("compares secrets safely", () => {
    expect(sameText("abc", "abc")).toBe(true);
    expect(sameText("abc", "abd")).toBe(false);
    expect(sameText("abc", "abcd")).toBe(false);
    expect(sameText("", "")).toBe(false);
  });
});

describe("publishPost", () => {
  it("publishes a picture to Facebook and Instagram and marks the post published", async () => {
    const { d, calls, marks } = make();
    const r = await publishPost(post(), d);
    expect(r.allDone).toBe(true);
    const fb = calls.find((c) => c.path === "P1/photos")!;
    expect(fb.params).toEqual({ url: JPG, caption: "Hello\n\n#sale #new" });
    expect(fb.token).toBe("PT");
    expect(calls.find((c) => c.path === "IG1/media")!.params.image_url).toBe(JPG);
    expect(calls.find((c) => c.path === "IG1/media_publish")!.params.creation_id).toBe("c1");
    expect(marks).toEqual([{ id: "p1", externalIds: { facebook: "P1_900", instagram: "ig900" }, published: true, error: null }]);
  });
  it("posts text-only to the Facebook feed", async () => {
    const { d, calls } = make();
    await publishPost(post({ platforms: ["facebook"], mediaUrl: null }), d);
    expect(calls.map((c) => c.path)).toEqual(["P1/feed"]);
  });
  it("explains why Instagram cannot post without a picture or with a PNG", async () => {
    const a = make();
    await publishPost(post({ platforms: ["instagram"], mediaUrl: null }), a.d);
    expect(a.marks[0].error).toMatch(/need a picture/);
    expect(a.calls).toHaveLength(0);
    const b = make();
    await publishPost(post({ platforms: ["instagram"], mediaUrl: "https://x/a.png" }), b.d);
    expect(b.marks[0].error).toMatch(/JPEG/);
    expect(b.calls).toHaveLength(0);
  });
  it("keeps what worked and retries only what is missing", async () => {
    const first = make({}, { "POST IG1/media": { status: 400, body: { error: { code: 100, message: "Invalid image" } } } });
    const r1 = await publishPost(post(), first.d);
    expect(r1.allDone).toBe(false);
    expect(first.marks[0]).toMatchObject({ externalIds: { facebook: "P1_900" }, published: false });
    expect(first.marks[0].error).toContain("instagram: Invalid image");
    const second = make();
    await publishPost(post({ externalIds: { facebook: "P1_900" } }), second.d);
    expect(second.calls.some((c) => c.path === "P1/photos")).toBe(false);
    expect(second.marks[0]).toMatchObject({ externalIds: { facebook: "P1_900", instagram: "ig900" }, published: true });
  });
  it("sends LinkedIn posts through the LinkedIn publisher and keeps its reason when it fails", async () => {
    const ok = make();
    const r = await publishPost(post({ platforms: ["linkedin"], mediaUrl: null }), ok.d);
    expect(r.allDone).toBe(true);
    expect(ok.calls).toHaveLength(0); // nothing goes to Meta
    expect(ok.marks[0]).toMatchObject({ externalIds: { linkedin: "urn:li:share:77" }, published: true, error: null });

    const bad = make({ publishLinkedIn: async () => ({ ok: false, message: "The LinkedIn login expired." }) });
    await publishPost(post({ platforms: ["linkedin", "facebook"], mediaUrl: null }), bad.d);
    expect(bad.marks[0]).toMatchObject({ published: false, externalIds: { facebook: "P1_901" } });
    expect(bad.marks[0].error).toBe("linkedin: The LinkedIn login expired.");

    const none = make({ loadAccount: async () => null });
    await publishPost(post({ platforms: ["linkedin"] }), none.d);
    expect(none.marks[0].error).toMatch(/LinkedIn is not connected/);
  });
  it("does not call it published while TikTok or YouTube is still left to do by hand", async () => {
    const { d, marks } = make();
    await publishPost(post({ platforms: ["facebook", "tiktok"] }), d);
    expect(marks[0]).toMatchObject({ published: false, error: null, externalIds: { facebook: "P1_900" } });
  });
  it("reports a missing connection and a network failure", async () => {
    const a = make({ loadAccount: async () => null });
    await publishPost(post({ platforms: ["facebook"] }), a.d);
    expect(a.marks[0].error).toMatch(/not connected/);
    const b = make({ graph: async () => { throw new Error("boom"); } });
    await publishPost(post({ platforms: ["facebook"] }), b.d);
    expect(b.marks[0].error).toMatch(/Could not reach Meta/);
  });
});

describe("connect flow", () => {
  it("start: needs login and configuration, then returns the Facebook address", async () => {
    expect((await handleStart(req({}, null), make().d)).status).toBe(401);
    expect((await handleStart(req({}), make({ configured: false }).d)).status).toBe(503);
    expect((await handleStart(req({}, "Bearer good", "GET"), make().d)).status).toBe(405);
    const res = await handleStart(req({}), make().d);
    expect(res.status).toBe(200);
    const { url } = await res.json();
    expect(url).toMatch(/^https:\/\/www\.facebook\.com\//);
    expect(new URL(url).searchParams.get("redirect_uri")).toBe("https://x.supabase.co/functions/v1/meta-callback");
  });
  it("callback: saves Page and Instagram and sends the browser home", async () => {
    const { d, saved, calls } = make();
    const state = await signState({ uid: "u1", ws: "w1", exp: NOW + 60_000 }, SECRET);
    const res = await handleCallback(new Request(`https://x.test/cb?code=C&state=${encodeURIComponent(state)}`), d);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://site.test/?connected=meta&ig=1");
    expect(saved[0].ws).toBe("w1");
    expect(saved[0].rows.map((r: any) => r.platform)).toEqual(["facebook", "instagram"]);
    expect(calls.map((c) => c.path)).toEqual(["oauth/access_token", "oauth/access_token", "me/accounts"]);
    expect(calls[2].token).toBe("UT");
  });
  it("callback: refuses a forged or expired state and a cancelled login", async () => {
    const { d, saved } = make();
    const loc = async (url: string) => (await handleCallback(new Request(url), d)).headers.get("location");
    expect(await loc("https://x.test/cb?code=C&state=forged.sig")).toContain("connect_error=bad_state");
    const old = await signState({ uid: "u1", ws: "w1", exp: NOW - 1 }, SECRET);
    expect(await loc(`https://x.test/cb?code=C&state=${encodeURIComponent(old)}`)).toContain("bad_state");
    expect(await loc("https://x.test/cb?error=access_denied")).toContain("connect_error=denied");
    expect(await loc("https://x.test/cb")).toContain("bad_state");
    expect(saved).toHaveLength(0);
  });
  it("callback: handles no Page, token failure and Meta being down without leaking details", async () => {
    const state = await signState({ uid: "u1", ws: "w1", exp: NOW + 60_000 }, SECRET);
    const url = `https://x.test/cb?code=C&state=${encodeURIComponent(state)}`;
    const noPage = make({}, { "GET me/accounts": { status: 200, body: { data: [] } } });
    expect((await handleCallback(new Request(url), noPage.d)).headers.get("location")).toContain("connect_error=no_page");
    const badToken = make({}, { "GET oauth/access_token": { status: 400, body: { error: { message: "code SECRET123 used" } } } });
    const r = await handleCallback(new Request(url), badToken.d);
    expect(r.headers.get("location")).toContain("token_failed");
    expect(badToken.logs.join(" ")).not.toContain("SECRET123");
    const down = make({ graph: async () => { throw new Error("fetch failed https://graph.facebook.com/x?access_token=tok_abc_secret"); } });
    expect((await handleCallback(new Request(url), down.d)).headers.get("location")).toContain("meta_unreachable");
    expect(down.logs.length).toBeGreaterThan(0);
    expect(down.logs.join(" ")).not.toContain("tok_abc_secret");
    expect(down.logs.join(" ")).not.toContain("access_token");
    expect((await handleCallback(new Request(url), make({ configured: false }).d)).headers.get("location")).toContain("not_configured");
  });
});

describe("api: publish, sync, reply", () => {
  it("publish: only approved posts, only with a Meta platform, never twice at once", async () => {
    const ok = make();
    const res = await handleApi(req({ action: "publish", postId: "p1" }), ok.d);
    expect(res.status).toBe(200);
    expect((await res.json()).published).toBe(true);
    expect(ok.released).toEqual(["p1"]);

    const draft = make({ loadPost: async () => post({ status: "draft" }) });
    expect((await handleApi(req({ action: "publish", postId: "p1" }), draft.d)).status).toBe(409);
    const done = make({ loadPost: async () => post({ status: "published" }) });
    expect((await handleApi(req({ action: "publish", postId: "p1" }), done.d)).status).toBe(409);
    const tt = make({ loadPost: async () => post({ platforms: ["tiktok"] }) });
    expect((await handleApi(req({ action: "publish", postId: "p1" }), tt.d)).status).toBe(400);
    const li = make({ loadPost: async () => post({ platforms: ["linkedin"], mediaUrl: null }) });
    expect((await handleApi(req({ action: "publish", postId: "p1" }), li.d)).status).toBe(200);
    const missing = make({ loadPost: async () => null });
    expect((await handleApi(req({ action: "publish", postId: "p1" }), missing.d)).status).toBe(404);

    const busy = make();
    busy.claimed.add("p1");
    expect((await handleApi(req({ action: "publish", postId: "p1" }), busy.d)).status).toBe(409);
    expect(busy.calls).toHaveLength(0);
  });
  it("releases the post even when publishing blows up", async () => {
    const m = make({ markPost: async () => { throw new Error("db down"); } });
    await expect(handleApi(req({ action: "publish", postId: "p1" }), m.d)).rejects.toThrow("db down");
    expect(m.released).toEqual(["p1"]);
  });
  it("checks login, setup, method and input", async () => {
    expect((await handleApi(req({}, null), make().d)).status).toBe(401);
    expect((await handleApi(req({}), make({ configured: false }).d)).status).toBe(503);
    expect((await handleApi(req({}, "Bearer good", "GET"), make().d)).status).toBe(405);
    expect((await handleApi(req({ action: "nope" }), make().d)).status).toBe(400);
    expect((await handleApi(req({ action: "publish" }), make().d)).status).toBe(400);
    expect((await handleApi(new Request("https://x.test/f", { method: "POST", headers: { authorization: "Bearer good" }, body: "not json" }), make().d)).status).toBe(400);
  });
  it("sync: imports new comments and reports problems per platform", async () => {
    const { d, imported } = make({}, {
      "GET P1/feed": { status: 200, body: { data: [{ comments: { data: [{ id: "c1", message: "price?", from: { id: "U", name: "Ann" }, created_time: "2026-11-01T10:00:00Z" }] } }] } },
      "GET IG1/media": { status: 400, body: { error: { code: 200, message: "no" } } },
    });
    const res = await handleApi(req({ action: "sync" }), d);
    const body = await res.json();
    expect(body.imported).toBe(1);
    expect(body.problems).toHaveLength(1);
    expect(body.problems[0]).toMatch(/^Instagram:/);
    expect(imported[0].comments[0]).toMatchObject({ externalId: "c1", platform: "facebook", body: "price?" });
  });
  it("reply: answers a Facebook comment and an Instagram comment on the right path", async () => {
    const fb = make();
    expect((await handleApi(req({ action: "reply", messageId: "m1", text: " Thanks! " }), fb.d)).status).toBe(200);
    expect(fb.calls[0]).toMatchObject({ method: "POST", path: "C1/comments", params: { message: "Thanks!" }, token: "PT" });
    expect(fb.replied).toEqual([{ id: "m1", text: "Thanks!" }]);
    const ig = make({ loadMessage: async () => ({ id: "m2", workspaceId: "w1", platform: "instagram", externalId: "IC9", status: "unread" }) });
    await handleApi(req({ action: "reply", messageId: "m2", text: "Hi" }), ig.d);
    expect(ig.calls[0].path).toBe("IC9/replies");
  });
  it("reply: refuses hand-added messages, other platforms, empty or huge text, and reports Meta errors", async () => {
    const hand = make({ loadMessage: async () => ({ id: "m", workspaceId: "w1", platform: "facebook", externalId: null, status: "unread" }) });
    const r1 = await handleApi(req({ action: "reply", messageId: "m", text: "x" }), hand.d);
    expect(r1.status).toBe(422);
    expect(hand.calls).toHaveLength(0);
    const tt = make({ loadMessage: async () => ({ id: "m", workspaceId: "w1", platform: "tiktok", externalId: "1", status: "unread" }) });
    expect((await handleApi(req({ action: "reply", messageId: "m", text: "x" }), tt.d)).status).toBe(422);
    expect((await handleApi(req({ action: "reply", messageId: "m", text: "   " }), make().d)).status).toBe(400);
    expect((await handleApi(req({ action: "reply", messageId: "m", text: "x".repeat(2001) }), make().d)).status).toBe(400);
    const missing = make({ loadMessage: async () => null });
    expect((await handleApi(req({ action: "reply", messageId: "m", text: "x" }), missing.d)).status).toBe(404);
    const rej = make({}, { "POST C1/comments": { status: 400, body: { error: { code: 190, message: "expired" } } } });
    const r2 = await handleApi(req({ action: "reply", messageId: "m1", text: "x" }), rej.d);
    expect(r2.status).toBe(422);
    expect((await r2.json()).error.message).toMatch(/Connect again/);
    expect(rej.replied).toHaveLength(0);
  });
});

describe("cron", () => {
  const cron = (secret: string | null) => new Request("https://x.test/c", { method: "POST", headers: secret === null ? {} : { "x-cron-secret": secret } });
  it("rejects a wrong or missing secret and an unset one", async () => {
    expect((await handleCron(cron(null), make().d)).status).toBe(401);
    expect((await handleCron(cron("nope"), make().d)).status).toBe(401);
    expect((await handleCron(cron(""), make({ cronSecret: "" }).d)).status).toBe(503);
    expect((await handleCron(new Request("https://x.test/c"), make().d)).status).toBe(405);
  });
  it("publishes due posts, imports comments, and skips a post another run holds", async () => {
    const m = make({ listDuePosts: async () => [post({ id: "a" }), post({ id: "b" })] });
    m.claimed.add("b");
    const res = await handleCron(cron("cron-secret"), m.d);
    expect(await res.json()).toEqual({ due: 2, published: 1, failed: 0, imported: 0 });
    expect(m.marks.map((x) => x.id)).toEqual(["a"]);
    expect(m.released).toEqual(["a"]);
  });
  it("counts failures and keeps going when one post throws", async () => {
    let n = 0;
    const m = make({
      listDuePosts: async () => [post({ id: "a" }), post({ id: "b", platforms: ["facebook"], mediaUrl: null })],
      markPost: async (id) => { if (++n === 1) throw new Error("db"); void id; },
    });
    const body = await (await handleCron(cron("cron-secret"), m.d)).json();
    expect(m.logs.join(" ")).not.toContain("db");
    expect(body.failed).toBe(1);
    expect(body.published).toBe(1);
    expect(m.released.sort()).toEqual(["a", "b"]);
  });
});

describe("syncWorkspaceComments", () => {
  it("does nothing when no platform is connected", async () => {
    const m = make({ loadAccount: async () => null });
    expect(await syncWorkspaceComments("w1", m.d)).toEqual({ imported: 0, problems: [] });
    expect(m.calls).toHaveLength(0);
  });
});
