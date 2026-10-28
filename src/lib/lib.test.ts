import { describe, expect, it } from "vitest";
import {
  addMonths,
  fromLocalInputValue,
  isSameDay,
  monthGrid,
  toLocalInputValue,
  weekOf,
} from "./dates";
import { parseHashtags } from "./hashtags";
import { defaultSchedule } from "./schedule";
import { createLocalPostsRepo } from "./postsRepo";
import type { PostInput } from "../types";

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

const input = (over: Partial<PostInput> = {}): PostInput => ({
  title: "Hello",
  caption: "World",
  hashtags: ["#a"],
  platforms: ["instagram"],
  status: "draft",
  scheduledAt: null,
  ...over,
});

describe("dates", () => {
  it("builds whole weeks for a month (Oct 2026 starts on a Thursday and ends on a Saturday)", () => {
    const grid = monthGrid(2026, 9);
    expect(grid.length % 7).toBe(0);
    expect(grid[0].getDay()).toBe(0);
    expect(grid[grid.length - 1].getDay()).toBe(6);
    expect(isSameDay(grid[0], new Date(2026, 8, 27))).toBe(true);
    expect(isSameDay(grid[grid.length - 1], new Date(2026, 9, 31))).toBe(true);
    expect(grid.filter((d) => d.getMonth() === 9).length).toBe(31);
  });

  it("pads both ends when the month does not start or end on a week boundary", () => {
    const grid = monthGrid(2026, 10); // Nov 2026: starts Sunday Nov 1, ends Monday Nov 30
    expect(isSameDay(grid[0], new Date(2026, 10, 1))).toBe(true);
    expect(isSameDay(grid[grid.length - 1], new Date(2026, 11, 5))).toBe(true);
  });

  it("handles February in a leap year and a 4-row month", () => {
    expect(monthGrid(2024, 1).filter((d) => d.getMonth() === 1).length).toBe(29);
    expect(monthGrid(2026, 1).length).toBe(28); // Feb 2026 starts on Sunday, 28 days
  });

  it("returns Sunday to Saturday for a week", () => {
    const week = weekOf(new Date(2026, 9, 28)); // a Wednesday
    expect(week.map((d) => d.getDate())).toEqual([25, 26, 27, 28, 29, 30, 31]);
  });

  it("moves across year boundaries", () => {
    const next = addMonths(new Date(2026, 11, 15), 1);
    expect([next.getFullYear(), next.getMonth()]).toEqual([2027, 0]);
  });

  it("round-trips datetime-local values", () => {
    const iso = fromLocalInputValue("2026-10-28T10:30");
    expect(iso).not.toBeNull();
    expect(toLocalInputValue(iso)).toBe("2026-10-28T10:30");
    expect(fromLocalInputValue("")).toBeNull();
    expect(fromLocalInputValue("not a date")).toBeNull();
    expect(toLocalInputValue(null)).toBe("");
  });
});

describe("parseHashtags", () => {
  it("cleans, prefixes and de-duplicates", () => {
    expect(parseHashtags("ai, #Growth  ##marketing AI #")).toEqual(["#ai", "#Growth", "#marketing"]);
  });
  it("strips punctuation and keeps non-latin letters", () => {
    expect(parseHashtags("hello! #عربی")).toEqual(["#hello", "#عربی"]);
  });
  it("limits to 30 tags", () => {
    const many = Array.from({ length: 50 }, (_, i) => `t${i}`).join(" ");
    expect(parseHashtags(many)).toHaveLength(30);
  });
  it("handles empty input", () => {
    expect(parseHashtags("   ")).toEqual([]);
  });
});

describe("local posts repo (demo mode)", () => {
  const now = () => new Date(2026, 9, 28, 9, 0);

  it("seeds sample posts on first use and saves them", async () => {
    const storage = new MemoryStorage();
    const repo = createLocalPostsRepo(storage, now);
    const first = await repo.list();
    expect(first.length).toBeGreaterThan(3);
    expect(storage.data.size).toBe(1);
    // A second repo on the same storage sees the same data (survives reload).
    const again = await createLocalPostsRepo(storage, now).list();
    expect(again.map((p) => p.id)).toEqual(first.map((p) => p.id));
  });

  it("creates, updates and deletes", async () => {
    const repo = createLocalPostsRepo(new MemoryStorage(), now);
    const before = (await repo.list()).length;

    const created = await repo.create(input({ title: "New one" }));
    expect(created.id).toBeTruthy();
    expect(await repo.list()).toHaveLength(before + 1);

    const updated = await repo.update(created.id, { status: "pending", title: "Renamed" });
    expect(updated).toMatchObject({ id: created.id, status: "pending", title: "Renamed", caption: "World" });

    await repo.remove(created.id);
    expect(await repo.list()).toHaveLength(before);
    await expect(repo.update(created.id, { title: "x" })).rejects.toThrow(/no longer exists/);
  });

  it("recovers from corrupt storage", async () => {
    const storage = new MemoryStorage();
    storage.setItem("marketectify.demo.posts.v1", "{not json");
    const posts = await createLocalPostsRepo(storage, now).list();
    expect(posts.length).toBeGreaterThan(3);
  });

  it("works without any storage (private mode)", async () => {
    const repo = createLocalPostsRepo(null, now);
    const created = await repo.create(input());
    expect((await repo.list()).some((p) => p.id === created.id)).toBe(true);
  });

  it("keeps working when storage throws", async () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const repo = createLocalPostsRepo(broken, now);
    const created = await repo.create(input());
    expect((await repo.list()).some((p) => p.id === created.id)).toBe(true);
  });

  it("gives a copy, not the stored object", async () => {
    const repo = createLocalPostsRepo(new MemoryStorage(), now);
    const [post] = await repo.list();
    post.title = "mutated outside";
    expect((await repo.list())[0].title).not.toBe("mutated outside");
  });
});

describe("defaultSchedule", () => {
  const afternoon = new Date(2026, 9, 28, 13, 45); // Wed 1:45 PM

  it("uses 10:00 on a future day", () => {
    expect(defaultSchedule(new Date(2026, 9, 30), afternoon)).toBe("2026-10-30T10:00");
  });
  it("uses 10:00 today while it is still morning", () => {
    expect(defaultSchedule(new Date(2026, 9, 28), new Date(2026, 9, 28, 7, 5))).toBe("2026-10-28T10:00");
  });
  it("uses the next full hour today once 10:00 has passed", () => {
    expect(defaultSchedule(new Date(2026, 9, 28), afternoon)).toBe("2026-10-28T14:00");
  });
  it("rolls over midnight correctly late at night", () => {
    expect(defaultSchedule(new Date(2026, 9, 28), new Date(2026, 9, 28, 23, 30))).toBe("2026-10-29T00:00");
  });
  it("defaults to the next full hour with no day chosen", () => {
    expect(defaultSchedule(undefined, afternoon)).toBe("2026-10-28T14:00");
  });
});
