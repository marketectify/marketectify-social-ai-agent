import { describe, expect, it } from "vitest";
import type { Message, Post } from "../types";
import { buildReportCsv, computeAnalytics, csvCell, formatDuration, formatPercent, lastMonths, rangeStart } from "./analytics";

const NOW = new Date(2026, 9, 29, 12, 0, 0); // 29 Oct 2026, local time
const iso = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString();

const post = (over: Partial<Post>): Post => ({ id: Math.random().toString(), title: "T", caption: "", hashtags: [], platforms: ["instagram"], status: "draft", scheduledAt: null, ...over });
const msg = (over: Partial<Message>): Message => ({
  id: Math.random().toString(), platform: "instagram", kind: "dm", senderName: "A", senderHandle: "", body: "Hi", status: "unread",
  reply: null, receivedAt: iso(2026, 10, 28), repliedAt: null, isLead: false, ...over,
});

describe("computeAnalytics", () => {
  it("handles empty data without NaN", () => {
    const a = computeAnalytics([], [], "all", NOW);
    expect(a.posts.total).toBe(0);
    expect(a.inbox).toMatchObject({ total: 0, replyRate: null, avgResponseMinutes: null, leadRate: null });
    expect(a.funnel.map((f) => f.percent)).toEqual([0, 0, 0]);
    expect(a.months).toHaveLength(6);
  });

  it("counts posts by status, platform and upcoming", () => {
    const a = computeAnalytics(
      [
        post({ status: "published", platforms: ["facebook", "instagram"], scheduledAt: iso(2026, 10, 20) }),
        post({ status: "approved", platforms: ["tiktok"], scheduledAt: iso(2026, 11, 2) }),
        post({ status: "approved", platforms: ["tiktok"], scheduledAt: iso(2026, 10, 1) }),
        post({ status: "draft", platforms: [] }),
      ],
      [],
      "all",
      NOW,
    );
    expect(a.posts.total).toBe(4);
    expect(a.posts.byStatus).toEqual({ draft: 1, pending: 0, approved: 2, published: 1 });
    expect(a.posts.byPlatform).toEqual({ facebook: 1, instagram: 1, tiktok: 2, youtube: 0 });
    expect(a.posts.upcoming).toBe(1);
  });

  it("applies the date range to dated posts and messages but keeps undated drafts", () => {
    const posts = [post({ scheduledAt: iso(2026, 10, 25) }), post({ scheduledAt: iso(2026, 3, 1) }), post({})];
    const messages = [msg({ receivedAt: iso(2026, 10, 27) }), msg({ receivedAt: iso(2026, 5, 1) })];
    const a = computeAnalytics(posts, messages, "30d", NOW);
    expect(a.posts.total).toBe(2);
    expect(a.inbox.total).toBe(1);
    expect(computeAnalytics(posts, messages, "all", NOW).inbox.total).toBe(2);
  });

  it("buckets posts per month for the last six months, per platform", () => {
    const a = computeAnalytics(
      [
        post({ platforms: ["facebook", "youtube"], scheduledAt: iso(2026, 10, 3) }),
        post({ platforms: ["facebook"], scheduledAt: iso(2026, 8, 15) }),
        post({ platforms: ["facebook"], scheduledAt: iso(2025, 1, 1) }), // too old
      ],
      [],
      "30d",
      NOW,
    );
    expect(a.months.map((m) => m.label)).toEqual(["May", "Jun", "Jul", "Aug", "Sep", "Oct"]);
    const oct = a.months[5];
    expect(oct.byPlatform).toMatchObject({ facebook: 1, youtube: 1 });
    expect(oct.total).toBe(2);
    expect(a.months[3].total).toBe(1);
  });

  it("computes inbox rates, response time and funnel", () => {
    const a = computeAnalytics(
      [],
      [
        msg({ status: "replied", receivedAt: iso(2026, 10, 28, 10), repliedAt: iso(2026, 10, 28, 11), isLead: true }),
        msg({ status: "replied", receivedAt: iso(2026, 10, 28, 10), repliedAt: iso(2026, 10, 28, 13) }),
        msg({ status: "unread" }),
        msg({ status: "read", platform: "tiktok", isLead: true }),
      ],
      "all",
      NOW,
    );
    expect(a.inbox).toMatchObject({ total: 4, unread: 1, replied: 2, leads: 2, replyRate: 0.5, leadRate: 0.5 });
    expect(a.inbox.avgResponseMinutes).toBe(120);
    expect(a.inbox.byPlatform).toMatchObject({ instagram: 3, tiktok: 1 });
    expect(a.funnel).toEqual([
      { stage: "Messages received", count: 4, percent: 100 },
      { stage: "Replied", count: 2, percent: 50 },
      { stage: "Marked as leads", count: 2, percent: 50 },
    ]);
  });

  it("ignores impossible response times", () => {
    const a = computeAnalytics([], [msg({ status: "replied", receivedAt: iso(2026, 10, 28, 12), repliedAt: iso(2026, 10, 28, 10) })], "all", NOW);
    expect(a.inbox.avgResponseMinutes).toBeNull();
  });
});

describe("helpers", () => {
  it("rangeStart", () => {
    expect(rangeStart("all", NOW)).toBeNull();
    const s = rangeStart("30d", NOW)!; expect(s.getMonth()).toBe(8); expect(s.getDate()).toBe(29);
  });
  it("lastMonths crosses the year boundary", () => {
    expect(lastMonths(new Date(2026, 1, 10), 4).map((m) => m.key)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
  it("formatDuration and formatPercent", () => {
    expect(formatDuration(null)).toBe("No replies yet");
    expect(formatDuration(0.3)).toBe("Under a minute");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(90)).toBe("1.5 h");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatDuration(60 * 48)).toBe("2 d");
    expect(formatPercent(0.256)).toBe("26%");
    expect(formatPercent(null)).toBe("–");
  });
});

describe("CSV", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('a,"b"\nc')).toBe('"a,""b""\nc"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(5)).toBe("5");
  });
  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe('"\'=HYPERLINK(""http://evil"")"');
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });
  it("builds a report with posts and messages", () => {
    const posts = [post({ title: "Sale, big", scheduledAt: iso(2026, 10, 20) })];
    const messages = [msg({ senderName: "=bad", body: "Hello", isLead: true })];
    const csv = buildReportCsv(posts, messages, computeAnalytics(posts, messages, "all", NOW), "All time");
    expect(csv).toContain('"Sale, big"');
    expect(csv).toContain("'=bad");
    expect(csv).toContain("Leads,1");
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});
