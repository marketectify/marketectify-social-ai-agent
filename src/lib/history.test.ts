import { describe, expect, it } from "vitest";
import { filterHistory, historyCounts, historyGroup, platformOutcomes, postLink, sortHistory } from "./history";
import type { Post } from "../types";

const post = (o: Partial<Post>): Post => ({ id: "1", title: "T", caption: "C", hashtags: [], platforms: ["facebook"], status: "draft", scheduledAt: null, ...o });

describe("post history", () => {
  it("marks a platform with an id as posted and gives Facebook and YouTube links", () => {
    const p = post({ status: "published", platforms: ["facebook", "youtube", "instagram"], externalIds: { facebook: "1_2", youtube: "abc", instagram: "9" } });
    const o = platformOutcomes(p);
    expect(o.map((x) => x.state)).toEqual(["posted", "posted", "posted"]);
    expect(o[0].link).toBe("https://www.facebook.com/1_2");
    expect(o[1].link).toBe("https://www.youtube.com/watch?v=abc");
    expect(o[2].link).toBeNull();
  });
  it("shows a failed platform when only some platforms went out", () => {
    const p = post({ status: "published", platforms: ["facebook", "instagram"], externalIds: { facebook: "1" }, publishError: "Instagram refused" });
    expect(platformOutcomes(p).map((x) => x.state)).toEqual(["posted", "failed"]);
    expect(historyGroup(p)).toBe("failed");
  });
  it("treats a failed approved post as failed and a clean approved post as waiting", () => {
    expect(historyGroup(post({ status: "approved", publishError: "x" }))).toBe("failed");
    const ok = post({ status: "approved", platforms: ["facebook", "tiktok"] });
    expect(platformOutcomes(ok).map((x) => x.state)).toEqual(["waiting", "waiting"]);
    expect(historyGroup(ok)).toBe("scheduled");
  });
  it("counts a hand-posted platform (no automatic publish) as posted", () => {
    expect(platformOutcomes(post({ status: "published", platforms: ["tiktok"], publishError: "x" }))[0].state).toBe("posted");
  });
  it("keeps drafts and pending posts as not sent", () => {
    expect(platformOutcomes(post({ status: "pending" }))[0].state).toBe("notsent");
    expect(historyGroup(post({ status: "pending" }))).toBe("draft");
  });
  it("sorts newest first, preferring the real publish time, with undated posts last", () => {
    const a = post({ id: "a", scheduledAt: "2026-01-01T00:00:00Z" });
    const b = post({ id: "b", scheduledAt: "2026-01-01T00:00:00Z", publishedAt: "2026-03-01T00:00:00Z" });
    const c = post({ id: "c" });
    expect(sortHistory([c, a, b]).map((p) => p.id)).toEqual(["b", "a", "c"]);
  });
  it("filters by group, platform and text, and counts groups", () => {
    const list = [
      post({ id: "1", status: "published", title: "Eid sale", externalIds: { facebook: "x" } }),
      post({ id: "2", status: "approved", platforms: ["instagram"], caption: "dentist" }),
      post({ id: "3", status: "draft" }),
    ];
    expect(filterHistory(list, { group: "published", platform: "all", query: "" }).map((p) => p.id)).toEqual(["1"]);
    expect(filterHistory(list, { group: "all", platform: "instagram", query: "" }).map((p) => p.id)).toEqual(["2"]);
    expect(filterHistory(list, { group: "all", platform: "all", query: "DENTIST" }).map((p) => p.id)).toEqual(["2"]);
    expect(historyCounts(list)).toEqual({ all: 3, published: 1, scheduled: 1, failed: 0, draft: 1 });
  });
  it("has no link without an id", () => {
    expect(postLink("facebook", undefined)).toBeNull();
  });
});
