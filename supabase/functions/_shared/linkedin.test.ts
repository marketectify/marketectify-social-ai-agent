import { describe, expect, it } from "vitest";
import {
  LI_POST_LIMIT,
  buildAuthUrl,
  buildCommentary,
  buildPostBody,
  escapeLittleText,
  handleCallback,
  handleStart,
  hashtagTemplates,
  isOwnMediaUrl,
  liError,
  parseUserinfo,
  publishToLinkedIn,
  type LiAccountRow,
  type LiDeps,
  type LiHttpRequest,
  type LiHttpResult,
} from "./linkedin";
import { signState } from "./youtube";

const SECRET = "state-secret";
const NOW = 1_800_000_000_000;
const MEDIA = "https://x.supabase.co/storage/v1/object/public/post-media/w1/a.jpg";
const account: LiAccountRow = { externalId: "abc123", displayName: "Ann Lee", avatarUrl: "", token: "TOKEN", expiresAt: new Date(NOW + 86_400_000).toISOString() };
const res = (status: number, body: any = null, headers: Record<string, string> = {}): LiHttpResult => ({ status, body, headers });

function make(over: Partial<LiDeps> = {}, replies: Record<string, LiHttpResult> = {}) {
  const calls: LiHttpRequest[] = [];
  const saved: any[] = [];
  const logs: string[] = [];
  const d: LiDeps = {
    configured: true,
    siteUrl: "https://site.test/",
    clientId: "CID",
    clientSecret: "CSECRET",
    stateSecret: SECRET,
    redirectUri: "https://x.supabase.co/functions/v1/linkedin-callback",
    apiVersion: "202610",
    now: () => NOW,
    getUser: async (a) => (a === "Bearer good" ? { id: "u1" } : null),
    getWorkspaceId: async () => "w1",
    http: async (req) => {
      calls.push(req);
      const key = `${req.method} ${req.url.split("?action")[0]}`;
      if (replies[key]) return replies[key];
      if (req.url.endsWith("/oauth/v2/accessToken")) return res(200, { access_token: "AT", expires_in: 5184000 });
      if (req.url.endsWith("/v2/userinfo")) return res(200, { sub: "abc123", name: "Ann Lee", picture: "https://media.licdn.com/p.jpg" });
      if (req.url.includes("/rest/images")) return res(200, { value: { uploadUrl: "https://www.linkedin.com/dms-uploads/xyz", image: "urn:li:image:C1" } });
      if (req.method === "PUT") return res(201);
      if (req.url.endsWith("/rest/posts")) return res(201, null, { "x-restli-id": "urn:li:share:555" });
      return res(404);
    },
    fetchMedia: async () => ({ bytes: new Uint8Array([1, 2, 3]), type: "image/jpeg" }),
    saveAccount: async (ws, row) => void saved.push({ ws, row }),
    log: (m) => logs.push(m),
    ...over,
  };
  return { d, calls, saved, logs };
}
const req = (auth: string | null = "Bearer good", method = "POST") =>
  new Request("https://x.test/f", { method, headers: auth ? { authorization: auth } : {}, body: method === "GET" ? undefined : "{}" });

describe("text helpers", () => {
  it("escapes every character LinkedIn reads as formatting", () => {
    expect(escapeLittleText("50% off (today) @shop #1 {a|b} [x] <y> *z* _w_ ~ \\")).toBe(
      "50% off \\(today\\) \\@shop \\#1 \\{a\\|b\\} \\[x\\] \\<y\\> \\*z\\* \\_w\\_ \\~ \\\\",
    );
    expect(escapeLittleText("plain text, with punctuation!?")).toBe("plain text, with punctuation!?");
  });
  it("turns hashtags into LinkedIn hashtag templates and drops junk and duplicates", () => {
    expect(hashtagTemplates(["#sale", "New", "sale", "bad tag!", "###", "", "اردو"])).toEqual([
      "{hashtag|\\#|sale}",
      "{hashtag|\\#|New}",
      "{hashtag|\\#|badtag}",
      "{hashtag|\\#|اردو}",
    ]);
  });
  it("builds the commentary: escaped caption, blank line, hashtags", () => {
    expect(buildCommentary({ caption: " Big sale (50%) ", hashtags: ["#sale"] })).toBe("Big sale \\(50%\\)\n\n{hashtag|\\#|sale}");
    expect(buildCommentary({ caption: "Only text", hashtags: [] })).toBe("Only text");
    expect(buildCommentary({ caption: "", hashtags: ["a"] })).toBe("{hashtag|\\#|a}");
  });
  it("never goes over the limit and never cuts an escape in half", () => {
    const long = "(".repeat(2500);
    const c = buildCommentary({ caption: long, hashtags: ["tag"] });
    expect(c.length).toBeLessThanOrEqual(LI_POST_LIMIT);
    expect(c.endsWith("{hashtag|\\#|tag}")).toBe(true);
    const body = c.split("\n\n")[0];
    expect(body).toMatch(/^(\\\()+$/);
    expect(buildCommentary({ caption: "x".repeat(5000), hashtags: [] }).length).toBe(LI_POST_LIMIT);
  });
  it("reads the profile and refuses answers without a safe member id", () => {
    expect(parseUserinfo({ sub: "abc123", name: " Ann ", picture: "http://bad" })).toEqual({ id: "abc123", name: "Ann", avatarUrl: "" });
    expect(parseUserinfo({ sub: "abc123", given_name: "Ann", family_name: "Lee" })?.name).toBe("Ann Lee");
    expect(parseUserinfo({ sub: "abc123" })?.name).toBe("LinkedIn member");
    for (const bad of [null, {}, { sub: "" }, { sub: "a b" }, { sub: "x".repeat(100) }, { sub: 5 }]) expect(parseUserinfo(bad)).toBeNull();
  });
  it("builds the login address and the post body", () => {
    const u = new URL(buildAuthUrl({ clientId: "C", redirectUri: "https://r/cb", state: "S" }));
    expect(u.hostname).toBe("www.linkedin.com");
    expect(u.searchParams.get("scope")).toBe("openid profile w_member_social");
    expect(u.searchParams.get("state")).toBe("S");
    const b: any = buildPostBody({ author: "urn:li:person:1", commentary: "hi", imageUrn: "urn:li:image:9" });
    expect(b).toMatchObject({ author: "urn:li:person:1", commentary: "hi", visibility: "PUBLIC", lifecycleState: "PUBLISHED", content: { media: { id: "urn:li:image:9" } } });
    expect((buildPostBody({ author: "a", commentary: "t" }) as any).content).toBeUndefined();
  });
  it("only downloads our own public pictures", () => {
    const base = "https://x.supabase.co";
    expect(isOwnMediaUrl(MEDIA, base)).toBe(true);
    for (const bad of [
      "https://evil.test/storage/v1/object/public/post-media/a.jpg",
      "http://x.supabase.co/storage/v1/object/public/post-media/a.jpg",
      "https://x.supabase.co/storage/v1/object/public/other/a.jpg",
      "https://x.supabase.co.evil.test/storage/v1/object/public/post-media/a.jpg",
      "https://x.supabase.co/storage/v1/object/public/post-media/../x",
      "not a url",
    ]) expect(isOwnMediaUrl(bad, base)).toBe(false);
  });
  it("explains LinkedIn errors in plain words", () => {
    expect(liError(res(401))).toMatch(/Connect/);
    expect(liError(res(403))).toMatch(/Share on LinkedIn/);
    expect(liError(res(429))).toMatch(/tomorrow/);
    expect(liError(res(422, { message: "Duplicate post" }))).toContain("Duplicate post");
    expect(liError(res(500))).toContain("500");
  });
});

describe("publishToLinkedIn", () => {
  const deps = (m: ReturnType<typeof make>) => ({ http: m.d.http, fetchMedia: m.d.fetchMedia, apiVersion: m.d.apiVersion, now: m.d.now });
  it("publishes a text post with the right headers and body", async () => {
    const m = make();
    const r = await publishToLinkedIn({ caption: "Hello (world)", hashtags: ["news"], mediaUrl: null }, account, deps(m));
    expect(r).toEqual({ ok: true, id: "urn:li:share:555" });
    expect(m.calls).toHaveLength(1);
    const c = m.calls[0];
    expect(c.url).toBe("https://api.linkedin.com/rest/posts");
    expect(c.headers).toMatchObject({ authorization: "Bearer TOKEN", "linkedin-version": "202610", "x-restli-protocol-version": "2.0.0" });
    expect((c.json as any).author).toBe("urn:li:person:abc123");
    expect((c.json as any).commentary).toBe("Hello \\(world\\)\n\n{hashtag|\\#|news}");
  });
  it("uploads the picture first and attaches it", async () => {
    const m = make();
    const r = await publishToLinkedIn({ caption: "Look", hashtags: [], mediaUrl: MEDIA, mediaKind: "image" }, account, deps(m));
    expect(r.ok).toBe(true);
    expect(m.calls.map((c) => `${c.method} ${c.url.replace("https://", "").split("?")[0]}`)).toEqual([
      "POST api.linkedin.com/rest/images",
      "PUT www.linkedin.com/dms-uploads/xyz",
      "POST api.linkedin.com/rest/posts",
    ]);
    expect((m.calls[0].json as any).initializeUploadRequest.owner).toBe("urn:li:person:abc123");
    expect(m.calls[1].bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect((m.calls[2].json as any).content.media.id).toBe("urn:li:image:C1");
  });
  it("stops before posting when the login is expired, the picture is unreadable or too big, or a video is attached", async () => {
    const expired = make();
    const a = await publishToLinkedIn({ caption: "x", hashtags: [], mediaUrl: null }, { ...account, expiresAt: new Date(NOW - 1).toISOString() }, deps(expired));
    expect(a.ok).toBe(false);
    expect(a.message).toMatch(/expired/);
    expect(expired.calls).toHaveLength(0);

    const unreadable = make({ fetchMedia: async () => null });
    expect((await publishToLinkedIn({ caption: "x", hashtags: [], mediaUrl: MEDIA }, account, deps(unreadable))).message).toMatch(/could not be read/);
    expect(unreadable.calls).toHaveLength(0);

    const huge = make({ fetchMedia: async () => ({ bytes: new Uint8Array(9 * 1024 * 1024), type: "image/jpeg" }) });
    expect((await publishToLinkedIn({ caption: "x", hashtags: [], mediaUrl: MEDIA }, account, deps(huge))).message).toMatch(/too large/);

    const video = make();
    expect((await publishToLinkedIn({ caption: "x", hashtags: [], mediaUrl: MEDIA, mediaKind: "video" }, account, deps(video))).message).toMatch(/not supported yet/);
    expect(video.calls).toHaveLength(0);

    const empty = make();
    expect((await publishToLinkedIn({ caption: " ", hashtags: [], mediaUrl: null }, account, deps(empty))).message).toMatch(/empty/);
  });
  it("reports LinkedIn refusals without leaking the token and survives a network failure", async () => {
    const refused = make({}, { "POST https://api.linkedin.com/rest/posts": res(403, { message: "ACCESS_DENIED TOKEN" }) });
    const r = await publishToLinkedIn({ caption: "x", hashtags: [], mediaUrl: null }, account, deps(refused));
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/Share on LinkedIn/);
    expect(r.message).not.toContain("TOKEN");
    const noId = make({}, { "POST https://api.linkedin.com/rest/posts": res(201) });
    expect((await publishToLinkedIn({ caption: "x", hashtags: [], mediaUrl: null }, account, deps(noId))).ok).toBe(false);
    const down = make({ http: async () => { throw new Error("fetch failed ?token=TOKEN"); } });
    const d = await publishToLinkedIn({ caption: "x", hashtags: [], mediaUrl: null }, account, deps(down));
    expect(d).toEqual({ ok: false, message: "Could not reach LinkedIn. Please try again." });
    const initFail = make({}, { "POST https://api.linkedin.com/rest/images": res(401) });
    expect((await publishToLinkedIn({ caption: "x", hashtags: [], mediaUrl: MEDIA }, account, deps(initFail))).message).toMatch(/Connect/);
    const putFail = make({}, { "PUT https://www.linkedin.com/dms-uploads/xyz": res(500) });
    expect((await publishToLinkedIn({ caption: "x", hashtags: [], mediaUrl: MEDIA }, account, deps(putFail))).message).toMatch(/did not accept the picture/);
  });
});

describe("connect flow", () => {
  it("start: needs login and setup, then returns the LinkedIn address", async () => {
    expect((await handleStart(req(null), make().d)).status).toBe(401);
    expect((await handleStart(req(), make({ configured: false }).d)).status).toBe(503);
    expect((await handleStart(req("Bearer good", "GET"), make().d)).status).toBe(405);
    expect((await handleStart(req(), make({ getWorkspaceId: async () => null }).d)).status).toBe(404);
    const r = await handleStart(req(), make().d);
    expect(r.status).toBe(200);
    expect((await r.json()).url).toMatch(/^https:\/\/www\.linkedin\.com\/oauth\/v2\/authorization\?/);
  });
  it("callback: saves the member with an expiry and sends the browser home", async () => {
    const m = make();
    const state = await signState({ uid: "u1", ws: "w1", exp: NOW + 60_000 }, SECRET);
    const r = await handleCallback(new Request(`https://x.test/cb?code=C&state=${encodeURIComponent(state)}`), m.d);
    expect(r.headers.get("location")).toBe("https://site.test/?connected=linkedin");
    expect(m.saved).toHaveLength(1);
    expect(m.saved[0].ws).toBe("w1");
    expect(m.saved[0].row).toMatchObject({ externalId: "abc123", displayName: "Ann Lee", token: "AT", avatarUrl: "https://media.licdn.com/p.jpg" });
    expect(m.saved[0].row.expiresAt).toBe(new Date(NOW + 5184000 * 1000).toISOString());
    expect(m.calls[0].form).toMatchObject({ grant_type: "authorization_code", code: "C", client_secret: "CSECRET" });
    expect(m.calls[1].headers).toEqual({ authorization: "Bearer AT" });
  });
  it("callback: refuses forged or expired state, a cancelled login and a missing code", async () => {
    const m = make();
    const loc = async (u: string) => (await handleCallback(new Request(u), m.d)).headers.get("location");
    expect(await loc("https://x.test/cb?code=C&state=forged.sig")).toContain("bad_state");
    const old = await signState({ uid: "u1", ws: "w1", exp: NOW - 1 }, SECRET);
    expect(await loc(`https://x.test/cb?code=C&state=${encodeURIComponent(old)}`)).toContain("bad_state");
    expect(await loc("https://x.test/cb?error=user_cancelled_authorize")).toContain("connect_error=denied&p=linkedin");
    expect(await loc("https://x.test/cb")).toContain("bad_state");
    expect(m.saved).toHaveLength(0);
    expect(m.calls).toHaveLength(0);
    expect((await handleCallback(new Request("https://x.test/cb"), make({ configured: false }).d)).headers.get("location")).toContain("not_configured");
    expect((await handleCallback(new Request("https://x.test/cb", { method: "POST" }), m.d)).status).toBe(405);
  });
  it("callback: handles token, profile and save failures and never logs secrets", async () => {
    const state = await signState({ uid: "u1", ws: "w1", exp: NOW + 60_000 }, SECRET);
    const url = `https://x.test/cb?code=C&state=${encodeURIComponent(state)}`;
    const noTok = make({}, { "POST https://www.linkedin.com/oauth/v2/accessToken": res(400, { error: "invalid code SECRETCODE" }) });
    expect((await handleCallback(new Request(url), noTok.d)).headers.get("location")).toContain("token_failed");
    expect(noTok.logs.join(" ")).not.toContain("SECRETCODE");
    const noProfile = make({}, { "GET https://api.linkedin.com/v2/userinfo": res(200, { name: "no id" }) });
    expect((await handleCallback(new Request(url), noProfile.d)).headers.get("location")).toContain("profile_failed");
    expect(noProfile.saved).toHaveLength(0);
    const noSave = make({ saveAccount: async () => { throw new Error("db"); } });
    expect((await handleCallback(new Request(url), noSave.d)).headers.get("location")).toContain("save_failed");
    const down = make({ http: async () => { throw new Error("https://api.linkedin.com/?access_token=tok_secret"); } });
    expect((await handleCallback(new Request(url), down.d)).headers.get("location")).toContain("linkedin_unreachable");
    expect(down.logs.length).toBeGreaterThan(0);
    expect(down.logs.join(" ")).not.toContain("tok_secret");
  });
});
