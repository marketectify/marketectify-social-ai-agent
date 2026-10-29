import { describe, expect, it } from "vitest";
import { createLocalMessagesRepo, sortMessages } from "./messagesRepo";
import { timeAgo } from "./dates";

const NOW = new Date("2026-10-29T10:00:00Z");
const memoryStorage = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
};
const input = { platform: "instagram" as const, kind: "dm" as const, senderName: "Ali", senderHandle: "@ali", body: "Price?", receivedAt: "2026-10-29T09:00:00Z" };

describe("local messages repo", () => {
  it("starts with sample messages and saves new ones", async () => {
    const storage = memoryStorage();
    const repo = createLocalMessagesRepo(storage, () => NOW);
    const first = await repo.list();
    expect(first.length).toBeGreaterThan(0);
    const created = await repo.create(input);
    expect(created).toMatchObject({ status: "unread", reply: null, repliedAt: null });
    const again = await createLocalMessagesRepo(storage, () => NOW).list();
    expect(again.some((m) => m.id === created.id)).toBe(true);
  });

  it("updates and deletes", async () => {
    const repo = createLocalMessagesRepo(null, () => NOW);
    const m = await repo.create(input);
    const updated = await repo.update(m.id, { status: "replied", reply: "Hi", repliedAt: NOW.toISOString() });
    expect(updated).toMatchObject({ status: "replied", reply: "Hi" });
    await repo.remove(m.id);
    expect((await repo.list()).some((x) => x.id === m.id)).toBe(false);
    await expect(repo.update(m.id, { status: "read" })).rejects.toThrow(/no longer exists/);
  });

  it("ignores corrupt stored data", async () => {
    const storage = memoryStorage();
    storage.setItem("marketectify.demo.messages.v1", JSON.stringify([{ id: 1 }, "x"]));
    const list = await createLocalMessagesRepo(storage, () => NOW).list();
    expect(list.every((m) => typeof m.id === "string")).toBe(true);
  });

  it("does not break when storage throws", async () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    const repo = createLocalMessagesRepo(broken, () => NOW);
    const m = await repo.create(input);
    expect((await repo.list()).some((x) => x.id === m.id)).toBe(true);
  });

  it("tracks the lead flag", async () => {
    const repo = createLocalMessagesRepo(null, () => NOW);
    const m = await repo.create(input);
    expect(m.isLead).toBe(false);
    expect((await repo.update(m.id, { isLead: true })).isLead).toBe(true);
  });

  it("sorts newest first", () => {
    const a = { ...input, id: "a", status: "read" as const, reply: null, repliedAt: null, isLead: false, receivedAt: "2026-10-01T00:00:00Z" };
    const b = { ...a, id: "b", receivedAt: "2026-10-02T00:00:00Z" };
    expect(sortMessages([a, b]).map((m) => m.id)).toEqual(["b", "a"]);
  });
});

describe("timeAgo", () => {
  const at = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
  it.each([
    [10_000, "just now"],
    [5 * 60_000, "5 min ago"],
    [3 * 3_600_000, "3 h ago"],
    [24 * 3_600_000, "1 day ago"],
    [3 * 24 * 3_600_000, "3 days ago"],
  ])("%i ms -> %s", (ms, expected) => expect(timeAgo(at(ms), NOW)).toBe(expected));
  it("falls back to a date after a week and handles bad input", () => {
    expect(timeAgo(at(20 * 24 * 3_600_000), NOW)).toMatch(/Oct/);
    expect(timeAgo("not a date", NOW)).toBe("");
  });
});
