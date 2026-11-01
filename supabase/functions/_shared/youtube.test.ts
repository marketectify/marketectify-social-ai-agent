import { describe, expect, it } from "vitest";
import {
  buildAuthUrl,
  handleCallback,
  handleRefresh,
  handleStart,
  parseChannel,
  signState,
  verifyState,
  type YtDeps,
} from "./youtube";

const SECRET = "test-state-secret";
const NOW = 1_800_000_000_000;
const channelBody = {
  items: [{ id: "UC123", snippet: { title: "Acme TV", customUrl: "@acmetv", thumbnails: { default: { url: "https://yt3.example/a.jpg" } } }, statistics: { subscriberCount: "1520", videoCount: "42", viewCount: "98000" } }],
};

function deps(over: Partial<YtDeps> = {}) {
  const saved: any[] = [];
  const stats: any[] = [];
  const logs: string[] = [];
  const d: YtDeps = {
    configured: true,
    siteUrl: "https://site.test/",
    clientId: "cid",
    stateSecret: SECRET,
    redirectUri: "https://x.supabase.co/functions/v1/youtube-callback",
    now: () => NOW,
    getUser: async (a) => (a === "Bearer good" ? { id: "u1" } : null),
    getWorkspaceId: async () => "w1",
    exchangeCode: async () => ({ ok: true, accessToken: "AT", refreshToken: "RT", expiresIn: 3600, scope: "yt" }),
    refreshAccessToken: async () => ({ accessToken: "AT2", expiresIn: 3600 }),
    fetchChannel: async () => ({ status: 200, body: channelBody }),
    saveAccount: async (row) => void saved.push(row),
    loadAccount: async () => ({ accessToken: "AT", refreshToken: "RT", tokenExpiresAt: new Date(NOW + 3_600_000).toISOString() }),
    updateStats: async (ws, patch) => void stats.push({ ws, patch }),
    log: (m) => logs.push(m),
    ...over,
  };
  return { d, saved, stats, logs };
}
const post = (auth = "Bearer good") => new Request("https://x.test/f", { method: "POST", headers: auth ? { authorization: auth } : {} });

describe("signed state", () => {
  it("round-trips", async () => {
    const t = await signState({ uid: "u", ws: "w", exp: NOW + 1000 }, SECRET);
    expect(await verifyState(t, SECRET, NOW)).toEqual({ uid: "u", ws: "w", exp: NOW + 1000 });
  });
  it("rejects tampering, wrong secret, expiry and junk", async () => {
    const t = await signState({ uid: "u", ws: "w", exp: NOW + 1000 }, SECRET);
    const [body, sig] = t.split(".");
    const forged = btoa(JSON.stringify({ uid: "attacker", ws: "w", exp: NOW + 1000 })).replace(/=+$/, "");
    expect(await verifyState(`${forged}.${sig}`, SECRET, NOW)).toBeNull();
    expect(await verifyState(`${body}.${sig.slice(0, -2)}AA`, SECRET, NOW)).toBeNull();
    expect(await verifyState(t, "other", NOW)).toBeNull();
    expect(await verifyState(t, SECRET, NOW + 2000)).toBeNull();
    for (const junk of [null, "", "abc", "a.b.c", "!!.!!"]) expect(await verifyState(junk, SECRET, NOW)).toBeNull();
    expect(await verifyState(t, "", NOW)).toBeNull();
  });
});

describe("buildAuthUrl and parseChannel", () => {
  it("asks for read-only access and a refresh token", () => {
    const u = new URL(buildAuthUrl({ clientId: "cid", redirectUri: "https://r.test/cb", state: "S" }));
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/youtube.readonly");
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("prompt")).toBe("consent");
    expect(u.searchParams.get("state")).toBe("S");
    expect(u.searchParams.get("redirect_uri")).toBe("https://r.test/cb");
  });
  it("parses a channel", () => {
    expect(parseChannel(channelBody)).toEqual({ externalId: "UC123", name: "Acme TV", handle: "@acmetv", avatarUrl: "https://yt3.example/a.jpg", subscribers: 1520, videos: 42, views: 98000 });
  });
  it("handles hidden subscribers, junk numbers, missing channel and unsafe avatars", () => {
    const hidden = parseChannel({ items: [{ id: "x", snippet: { title: "T", thumbnails: { default: { url: "javascript:alert(1)" } } }, statistics: { hiddenSubscriberCount: true, viewCount: "-5", videoCount: "abc" } }] });
    expect(hidden).toMatchObject({ subscribers: null, views: 0, videos: 0, avatarUrl: "" });
    for (const bad of [null, {}, { items: [] }, { items: [{}] }]) expect(parseChannel(bad)).toBeNull();
  });
});

describe("handleStart", () => {
  it("returns a Google URL carrying a valid state for the user's workspace", async () => {
    const { d } = deps();
    const res = await handleStart(post(), d);
    expect(res.status).toBe(200);
    const url = new URL((await res.json()).url);
    const state = await verifyState(url.searchParams.get("state"), SECRET, NOW);
    expect(state).toMatchObject({ uid: "u1", ws: "w1" });
  });
  it("needs login, config and a workspace", async () => {
    expect((await handleStart(post("Bearer bad"), deps().d)).status).toBe(401);
    expect((await handleStart(post(""), deps().d)).status).toBe(401);
    const r = await handleStart(post(), deps({ configured: false }).d);
    expect(r.status).toBe(503);
    expect((await r.json()).error.message).toContain("GOOGLE_CLIENT_ID");
    expect((await handleStart(post(), deps({ getWorkspaceId: async () => null }).d)).status).toBe(404);
    expect((await handleStart(post(), deps({ getUser: async () => { throw new Error("x"); } }).d)).status).toBe(502);
  });
  it("handles preflight and wrong method", async () => {
    expect((await handleStart(new Request("https://x.test", { method: "OPTIONS" }), deps().d)).status).toBe(204);
    expect((await handleStart(new Request("https://x.test", { method: "GET" }), deps().d)).status).toBe(405);
  });
});

describe("handleCallback", () => {
  const cb = async (query: Record<string, string>) => new Request("https://x.test/cb?" + new URLSearchParams(query));
  const validState = () => signState({ uid: "u1", ws: "w1", exp: NOW + 60_000 }, SECRET);
  const loc = (r: Response) => r.headers.get("location");

  it("saves the channel and sends the user back to the site", async () => {
    const { d, saved } = deps();
    const res = await handleCallback(await cb({ code: "C", state: await validState() }), d);
    expect(res.status).toBe(302);
    expect(loc(res)).toBe("https://site.test/?connected=youtube");
    expect(saved[0]).toMatchObject({ workspaceId: "w1", accessToken: "AT", refreshToken: "RT" });
    expect(saved[0].channel.name).toBe("Acme TV");
    expect(saved[0].expiresAt).toBe(new Date(NOW + 3_600_000).toISOString());
  });
  it("uses the workspace from the signed state, never from the URL", async () => {
    const { d, saved } = deps();
    await handleCallback(await cb({ code: "C", state: await validState(), ws: "evil" }), d);
    expect(saved[0].workspaceId).toBe("w1");
  });
  it.each([
    [{ error: "access_denied" }, "denied"],
    [{ code: "C" }, "bad_state"],
    [{ code: "C", state: "forged.value" }, "bad_state"],
    [{ state: "x" }, "bad_state"],
  ])("rejects %j", async (q, reason) => {
    const { d, saved } = deps();
    const res = await handleCallback(await cb(q as any), d);
    expect(loc(res)).toBe(`https://site.test/?connect_error=${reason}`);
    expect(saved).toHaveLength(0);
  });
  it("reports expired state, token failure, API disabled, no channel, save failure", async () => {
    const expired = await signState({ uid: "u1", ws: "w1", exp: NOW - 1 }, SECRET);
    expect(loc(await handleCallback(await cb({ code: "C", state: expired }), deps().d))).toContain("bad_state");
    const s = await validState();
    expect(loc(await handleCallback(await cb({ code: "C", state: s }), deps({ exchangeCode: async () => ({ ok: false, code: "invalid_grant" }) }).d))).toContain("token_failed");
    expect(loc(await handleCallback(await cb({ code: "C", state: s }), deps({ exchangeCode: async () => { throw new Error("net"); } }).d))).toContain("google_unreachable");
    expect(loc(await handleCallback(await cb({ code: "C", state: s }), deps({ fetchChannel: async () => ({ status: 403, body: {} }) }).d))).toContain("api_disabled");
    expect(loc(await handleCallback(await cb({ code: "C", state: s }), deps({ fetchChannel: async () => ({ status: 200, body: { items: [] } }) }).d))).toContain("no_channel");
    expect(loc(await handleCallback(await cb({ code: "C", state: s }), deps({ saveAccount: async () => { throw new Error("db"); } }).d))).toContain("save_failed");
  });
  it("never logs tokens or codes", async () => {
    const { d, logs } = deps({ exchangeCode: async () => ({ ok: false, code: "invalid_grant" }) });
    await handleCallback(await cb({ code: "SECRETCODE", state: await validState() }), d);
    expect(logs.join(" ")).not.toContain("SECRETCODE");
  });
});

describe("handleRefresh", () => {
  it("updates stats with the saved token when it is still valid", async () => {
    const { d, stats } = deps();
    const res = await handleRefresh(post(), d);
    expect(res.status).toBe(200);
    expect(stats[0].patch.accessToken).toBeUndefined();
    expect(stats[0].patch.channel.subscribers).toBe(1520);
  });
  it("gets a fresh token when expired and stores it", async () => {
    const { d, stats } = deps({ loadAccount: async () => ({ accessToken: "OLD", refreshToken: "RT", tokenExpiresAt: new Date(NOW - 1000).toISOString() }) });
    expect((await handleRefresh(post(), d)).status).toBe(200);
    expect(stats[0].patch).toMatchObject({ accessToken: "AT2" });
    expect(typeof stats[0].patch.expiresAt).toBe("string");
  });
  it("asks to reconnect when Google refuses", async () => {
    const expired = async () => ({ accessToken: "OLD", refreshToken: "RT", tokenExpiresAt: new Date(NOW - 1000).toISOString() });
    let r = await handleRefresh(post(), deps({ loadAccount: expired, refreshAccessToken: async () => null }).d);
    expect(r.status).toBe(409);
    expect((await r.json()).error.code).toBe("reconnect_needed");
    r = await handleRefresh(post(), deps({ loadAccount: async () => ({ accessToken: null, refreshToken: null, tokenExpiresAt: null }) }).d);
    expect(r.status).toBe(409);
    r = await handleRefresh(post(), deps({ fetchChannel: async () => ({ status: 401, body: {} }) }).d);
    expect(r.status).toBe(409);
  });
  it("covers not connected, login and config", async () => {
    expect((await handleRefresh(post(), deps({ loadAccount: async () => null }).d)).status).toBe(404);
    expect((await handleRefresh(post("Bearer bad"), deps().d)).status).toBe(401);
    expect((await handleRefresh(post(), deps({ configured: false }).d)).status).toBe(503);
    expect((await handleRefresh(post(), deps({ fetchChannel: async () => { throw new Error("n"); } }).d)).status).toBe(502);
  });
});
