import { describe, expect, it } from "vitest";
import {
  GBP_SUMMARY_LIMIT,
  buildAuthUrl,
  buildLocalPost,
  buildSummary,
  gbpError,
  handleCallback,
  handleStart,
  parseAccountName,
  parseLocations,
  publishToGbp,
  type GbpDeps,
  type GbpHttpRequest,
  type GbpHttpResult,
} from "./gbp";
import { signState } from "./youtube";

const SECRET = "state-secret";
const NOW = 1_800_000_000_000;
const LOC = "accounts/111/locations/222";
const res = (status: number, body: any = null): GbpHttpResult => ({ status, body, headers: {} });

function make(over: Partial<GbpDeps> = {}, replies: Record<string, GbpHttpResult> = {}) {
  const calls: GbpHttpRequest[] = [];
  const saved: any[] = [];
  const logs: string[] = [];
  const d: GbpDeps = {
    configured: true,
    siteUrl: "https://site.test/",
    clientId: "CID",
    clientSecret: "CSECRET",
    stateSecret: SECRET,
    redirectUri: "https://x.supabase.co/functions/v1/gbp-callback",
    now: () => NOW,
    getUser: async (a) => (a === "Bearer good" ? { id: "u1" } : null),
    getWorkspaceId: async () => "w1",
    http: async (req) => {
      calls.push(req);
      const key = `${req.method} ${req.url.split("?")[0]}`;
      if (replies[key]) return replies[key];
      if (req.url === "https://oauth2.googleapis.com/token") {
        return res(200, req.form?.grant_type === "refresh_token" ? { access_token: "FRESH", expires_in: 3600 } : { access_token: "AT", refresh_token: "RT", expires_in: 3600 });
      }
      if (req.url.startsWith("https://mybusinessaccountmanagement.googleapis.com/v1/accounts")) return res(200, { accounts: [{ name: "accounts/111" }] });
      if (req.url.includes("/locations?")) return res(200, { locations: [{ name: "locations/222", title: "Acme Dental" }] });
      if (req.url.endsWith("/localPosts")) return res(200, { name: `${LOC}/localPosts/9` });
      return res(404);
    },
    saveAccount: async (ws, row) => void saved.push({ ws, row }),
    log: (m) => logs.push(m),
    ...over,
  };
  return { d, calls, saved, logs };
}
const req = (auth: string | null = "Bearer good", method = "POST") =>
  new Request("https://x.test/f", { method, headers: auth ? { authorization: auth } : {}, body: method === "GET" ? undefined : "{}" });
const pdeps = (m: ReturnType<typeof make>) => ({ http: m.d.http, clientId: "CID", clientSecret: "CSECRET" });

describe("helpers", () => {
  it("builds a Google sign-in address that asks for a refresh token", () => {
    const u = new URL(buildAuthUrl({ clientId: "C", redirectUri: "https://r/cb", state: "S" }));
    expect(u.hostname).toBe("accounts.google.com");
    expect(u.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/business.manage");
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("prompt")).toBe("consent");
    expect(u.searchParams.get("state")).toBe("S");
  });
  it("reads the account and location lists and ignores unsafe names", () => {
    expect(parseAccountName({ accounts: [{ name: "bad" }, { name: "accounts/111" }] })).toBe("accounts/111");
    expect(parseAccountName({})).toBeNull();
    expect(parseAccountName({ accounts: [{ name: "accounts/../x" }] })).toBeNull();
    expect(
      parseLocations("accounts/111", { locations: [{ name: "locations/222", title: " Acme " }, { name: "locations/x/../y" }, { name: "locations/333" }, null] }),
    ).toEqual([
      { path: LOC, title: "Acme" },
      { path: "accounts/111/locations/333", title: "Business location" },
    ]);
    expect(parseLocations("accounts/111", null)).toEqual([]);
  });
  it("shortens the text to Google's limit and attaches a picture only", () => {
    expect(buildSummary("  hi\r\nthere ")).toBe("hi\nthere");
    const long = buildSummary("x".repeat(3000));
    expect(long.length).toBe(GBP_SUMMARY_LIMIT);
    expect(long.endsWith("…")).toBe(true);
    expect(buildLocalPost({ caption: "Hi", mediaUrl: "https://m/a.jpg", mediaKind: "image" })).toEqual({
      languageCode: "en",
      summary: "Hi",
      topicType: "STANDARD",
      media: [{ mediaFormat: "PHOTO", sourceUrl: "https://m/a.jpg" }],
    });
    expect(buildLocalPost({ caption: "Hi", mediaUrl: null })).not.toHaveProperty("media");
  });
  it("explains Google errors in plain words", () => {
    expect(gbpError(res(401))).toMatch(/Connect/);
    expect(gbpError(res(403))).toMatch(/Business Profile API access/);
    expect(gbpError(res(429))).toMatch(/limit/);
    expect(gbpError(res(400, { error: { message: "Bad summary" } }))).toContain("Bad summary");
    expect(gbpError(res(500))).toContain("500");
  });
});

describe("publishToGbp", () => {
  it("trades the refresh token for a fresh access token and posts to the location", async () => {
    const m = make();
    const r = await publishToGbp({ caption: "Open late today", mediaUrl: "https://m/a.jpg", mediaKind: "image" }, { externalId: LOC, refreshToken: "RT" }, pdeps(m));
    expect(r).toEqual({ ok: true, id: `${LOC}/localPosts/9` });
    expect(m.calls[0].form).toMatchObject({ grant_type: "refresh_token", refresh_token: "RT", client_secret: "CSECRET" });
    expect(m.calls[1].url).toBe(`https://mybusiness.googleapis.com/v4/${LOC}/localPosts`);
    expect(m.calls[1].headers).toEqual({ authorization: "Bearer FRESH" });
    expect((m.calls[1].json as any).media[0].sourceUrl).toBe("https://m/a.jpg");
  });
  it("stops early for videos, empty text, bad saved data and missing login", async () => {
    const m = make();
    expect((await publishToGbp({ caption: "x", mediaUrl: "https://m/v.mp4", mediaKind: "video" }, { externalId: LOC, refreshToken: "RT" }, pdeps(m))).message).toMatch(/pictures only/);
    expect((await publishToGbp({ caption: " ", mediaUrl: null }, { externalId: LOC, refreshToken: "RT" }, pdeps(m))).message).toMatch(/empty/);
    expect((await publishToGbp({ caption: "x", mediaUrl: null }, { externalId: "../evil", refreshToken: "RT" }, pdeps(m))).message).toMatch(/invalid/);
    expect((await publishToGbp({ caption: "x", mediaUrl: null }, { externalId: LOC, refreshToken: "" }, pdeps(m))).message).toMatch(/incomplete/);
    expect(m.calls).toHaveLength(0);
  });
  it("reports a removed login, a refusal and a network failure without leaking secrets", async () => {
    const gone = make({}, { "POST https://oauth2.googleapis.com/token": res(400, { error: "invalid_grant RT" }) });
    const a = await publishToGbp({ caption: "x", mediaUrl: null }, { externalId: LOC, refreshToken: "RT" }, pdeps(gone));
    expect(a.message).toMatch(/expired or was removed/);
    expect(a.message).not.toContain("RT");
    const refused = make({}, { [`POST https://mybusiness.googleapis.com/v4/${LOC}/localPosts`]: res(403) });
    expect((await publishToGbp({ caption: "x", mediaUrl: null }, { externalId: LOC, refreshToken: "RT" }, pdeps(refused))).message).toMatch(/Business Profile API access/);
    const noName = make({}, { [`POST https://mybusiness.googleapis.com/v4/${LOC}/localPosts`]: res(200, {}) });
    expect((await publishToGbp({ caption: "x", mediaUrl: null }, { externalId: LOC, refreshToken: "RT" }, pdeps(noName))).ok).toBe(false);
    const down = make({ http: async () => { throw new Error("fetch failed refresh_token=RT"); } });
    expect(await publishToGbp({ caption: "x", mediaUrl: null }, { externalId: LOC, refreshToken: "RT" }, pdeps(down))).toEqual({ ok: false, message: "Could not reach Google. Please try again." });
  });
});

describe("connect flow", () => {
  it("start: needs login and setup, then returns the Google address", async () => {
    expect((await handleStart(req(null), make().d)).status).toBe(401);
    expect((await handleStart(req(), make({ configured: false }).d)).status).toBe(503);
    expect((await handleStart(req("Bearer good", "GET"), make().d)).status).toBe(405);
    expect((await handleStart(req(), make({ getWorkspaceId: async () => null }).d)).status).toBe(404);
    const r = await handleStart(req(), make().d);
    expect((await r.json()).url).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
  });
  it("callback: saves the first location with the refresh token and goes home", async () => {
    const m = make();
    const state = await signState({ uid: "u1", ws: "w1", exp: NOW + 60_000 }, SECRET);
    const r = await handleCallback(new Request(`https://x.test/cb?code=C&state=${encodeURIComponent(state)}`), m.d);
    expect(r.headers.get("location")).toBe("https://site.test/?connected=gbp");
    expect(m.saved[0].ws).toBe("w1");
    expect(m.saved[0].row).toMatchObject({ externalId: LOC, displayName: "Acme Dental", refreshToken: "RT", accessToken: "AT" });
    expect(m.saved[0].row.expiresAt).toBe(new Date(NOW + 3600_000).toISOString());
  });
  it("callback: refuses bad state, cancel, missing refresh token, no access, no location", async () => {
    const m = make();
    const loc = async (mm: ReturnType<typeof make>, u: string) => (await handleCallback(new Request(u), mm.d)).headers.get("location");
    expect(await loc(m, "https://x.test/cb?code=C&state=forged.sig")).toContain("bad_state");
    expect(await loc(m, "https://x.test/cb?error=access_denied")).toContain("connect_error=denied&p=gbp");
    expect(m.saved).toHaveLength(0);
    const state = await signState({ uid: "u1", ws: "w1", exp: NOW + 60_000 }, SECRET);
    const url = `https://x.test/cb?code=C&state=${encodeURIComponent(state)}`;
    const noRefresh = make({}, { "POST https://oauth2.googleapis.com/token": res(200, { access_token: "AT" }) });
    expect(await loc(noRefresh, url)).toContain("token_failed");
    const noAccess = make({}, { "GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts": res(403) });
    expect(await loc(noAccess, url)).toContain("api_access");
    const noAccount = make({}, { "GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts": res(200, { accounts: [] }) });
    expect(await loc(noAccount, url)).toContain("no_location");
    const noLoc = make({}, { "GET https://mybusinessbusinessinformation.googleapis.com/v1/accounts/111/locations": res(200, {}) });
    expect(await loc(noLoc, url)).toContain("no_location");
    const noSave = make({ saveAccount: async () => { throw new Error("db"); } });
    expect(await loc(noSave, url)).toContain("save_failed");
    const down = make({ http: async () => { throw new Error("https://x?refresh_token=SECRETRT"); } });
    expect(await loc(down, url)).toContain("google_unreachable");
    expect(down.logs.join(" ")).not.toContain("SECRETRT");
  });
});
