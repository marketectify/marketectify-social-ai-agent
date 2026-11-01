import { describe, expect, it } from "vitest";
import { buildAttention, greeting, headline, setupSteps, weekStrip } from "./dashboard";
import type { Message, Post } from "../types";

const now = new Date(2026, 10, 1, 10, 0, 0); // 1 Nov 2026, 10:00 local
const at = (dayOffset: number, hour = 12) => new Date(2026, 10, 1 + dayOffset, hour).toISOString();
const post = (id: string, over: Partial<Post> = {}): Post => ({ id, title: `Post ${id}`, caption: "", hashtags: [], platforms: [], status: "draft", scheduledAt: null, ...over });
const msg = (id: string, status: Message["status"]): Message => ({ id, platform: "instagram", kind: "comment", senderName: "A", text: "hi", receivedAt: now.toISOString(), status, reply: "", repliedAt: null, isLead: false } as unknown as Message);

describe("greeting", () => {
  it("changes with the time of day", () => {
    expect([2, 9, 14, 20].map(greeting)).toEqual(["Working late", "Good morning", "Good afternoon", "Good evening"]);
  });
});

describe("buildAttention", () => {
  it("is empty when nothing needs the person", () => {
    expect(buildAttention([post("1", { status: "approved", scheduledAt: at(2) }), post("2", { status: "published", scheduledAt: at(-3) })], [msg("m", "replied")], now)).toEqual([]);
  });
  it("puts overdue first, then approvals, unread messages and undated drafts", () => {
    const items = buildAttention(
      [post("d"), post("p", { status: "pending", scheduledAt: at(1) }), post("o", { status: "approved", scheduledAt: at(0, 8) })],
      [msg("a", "unread"), msg("b", "unread"), msg("c", "read")],
      now,
    );
    expect(items.map((i) => i.kind)).toEqual(["overdue", "approve", "unread", "unscheduled"]);
    expect(items[0].postId).toBe("o");
    expect(items[2].title).toBe("2 new messages to answer");
    expect(items[3].postId).toBe("d");
  });
  it("shows at most 3 approvals and a link for the rest", () => {
    const pend = Array.from({ length: 5 }, (_, i) => post(`p${i}`, { status: "pending", scheduledAt: at(i + 1) }));
    const items = buildAttention(pend, [], now);
    expect(items).toHaveLength(4);
    expect(items[3]).toMatchObject({ tab: "calendar", title: "2 more posts are waiting for approval" });
  });
  it("uses singular wording", () => {
    expect(buildAttention([], [msg("a", "unread")], now)[0].title).toBe("1 new message to answer");
  });
});

describe("headline", () => {
  it("counts items or says all caught up", () => {
    expect(headline([{ id: "x", kind: "unread", title: "", detail: "", action: "" }], 0)).toBe("1 thing needs you today.");
    expect(headline([], 3)).toContain("3 posts are scheduled");
    expect(headline([], 1)).toContain("1 post is scheduled");
    expect(headline([], 0)).toContain("Nothing is scheduled");
  });
});

describe("weekStrip", () => {
  it("returns 7 days starting today with the right posts on each", () => {
    const week = weekStrip([post("a", { status: "approved", scheduledAt: at(0, 15) }), post("b", { status: "approved", scheduledAt: at(3) }), post("c", { status: "draft", scheduledAt: at(3) }), post("far", { status: "approved", scheduledAt: at(9) })], now);
    expect(week).toHaveLength(7);
    expect(week[0].isToday).toBe(true);
    expect(week.map((d) => d.posts.length)).toEqual([1, 0, 0, 1, 0, 0, 0]);
  });
  it("sorts posts of a day by time", () => {
    const week = weekStrip([post("late", { status: "approved", scheduledAt: at(1, 18) }), post("early", { status: "pending", scheduledAt: at(1, 8) })], now);
    expect(week[1].posts.map((p) => p.id)).toEqual(["early", "late"]);
  });
});

describe("setupSteps", () => {
  it("tracks real progress", () => {
    expect(setupSteps([], 0).map((s) => s.done)).toEqual([false, false, false]);
    expect(setupSteps([post("1", { status: "approved", scheduledAt: at(1) })], 2).map((s) => s.done)).toEqual([true, true, true]);
  });
});
