import { describe, expect, it } from "vitest";
import { connectErrorMessage, formatCount, fromRow, youtubeNeedsReconnect } from "./socialAccounts";

describe("formatCount", () => {
  it.each([
    [null, "hidden"], [0, "0"], [999, "999"], [1000, "1K"], [1520, "1.5K"], [12_400, "12K"],
    [1_000_000, "1M"], [2_340_000, "2.3M"], [25_000_000, "25M"],
  ])("%s -> %s", (n, s) => expect(formatCount(n as number | null)).toBe(s));
});

describe("fromRow", () => {
  const row = { id: "1", platform: "youtube", display_name: "Acme", handle: "@a", avatar_url: "https://x/a.jpg", subscribers: 5, video_count: 2, view_count: 9, stats_updated_at: null };
  it("maps a row", () => expect(fromRow(row)).toMatchObject({ displayName: "Acme", subscribers: 5, videoCount: 2, viewCount: 9 }));
  it("drops unsafe avatar addresses and keeps hidden subscribers as null", () => {
    const r = fromRow({ ...row, avatar_url: "javascript:alert(1)", subscribers: null });
    expect(r.avatarUrl).toBe("");
    expect(r.subscribers).toBeNull();
  });
  it("copes with numbers sent as strings (bigint)", () => {
    expect(fromRow({ ...row, view_count: "123456789" as unknown as number }).viewCount).toBe(123456789);
  });
});

describe("youtubeNeedsReconnect", () => {
  const base = "https://www.googleapis.com/auth/";
  it("asks for a new connection when posting or comments are missing", () => {
    expect(youtubeNeedsReconnect({ platform: "youtube", scopes: `${base}youtube.readonly` })).toBe(true);
    expect(youtubeNeedsReconnect({ platform: "youtube", scopes: `${base}youtube.readonly ${base}youtube.upload` })).toBe(true);
    expect(youtubeNeedsReconnect({ platform: "youtube", scopes: `${base}youtube.upload ${base}youtube.force-ssl` })).toBe(false);
  });
  it("stays quiet when the permissions are unknown or it is another platform", () => {
    expect(youtubeNeedsReconnect({ platform: "youtube", scopes: null })).toBe(false);
    expect(youtubeNeedsReconnect({ platform: "facebook", scopes: "meta" })).toBe(false);
  });
  it("reads scopes from a row", () => {
    expect(fromRow({ id: "1", platform: "youtube", display_name: "A", handle: "", avatar_url: "", subscribers: 1, video_count: 1, view_count: 1, stats_updated_at: null, scopes: "x y" }).scopes).toBe("x y");
  });
});

describe("connectErrorMessage", () => {
  it("explains known problems and falls back for unknown ones", () => {
    expect(connectErrorMessage("api_disabled")).toMatch(/YouTube Data API/);
    expect(connectErrorMessage("no_channel")).toMatch(/no YouTube channel/);
    expect(connectErrorMessage("whatever")).toMatch(/Could not connect/);
  });
});
