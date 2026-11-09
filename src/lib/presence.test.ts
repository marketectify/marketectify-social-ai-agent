import { describe, expect, it } from "vitest";
import { lastSeenText, presenceCounts, presenceState } from "./presence";

const now = Date.parse("2026-11-09T12:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();

describe("presence", () => {
  it("is online within 2.5 minutes, offline after, never without a date", () => {
    expect(presenceState(ago(30_000), now)).toBe("online");
    expect(presenceState(ago(150_000), now)).toBe("online");
    expect(presenceState(ago(151_000), now)).toBe("offline");
    expect(presenceState(null, now)).toBe("never");
    expect(presenceState("nonsense", now)).toBe("never");
  });
  it("writes the last seen time in plain words", () => {
    expect(lastSeenText(ago(10_000), now)).toBe("Just now");
    expect(lastSeenText(ago(60_000), now)).toBe("1 minute ago");
    expect(lastSeenText(ago(5 * 60_000), now)).toBe("5 minutes ago");
    expect(lastSeenText(ago(3 * 3_600_000), now)).toBe("3 hours ago");
    expect(lastSeenText(ago(2 * 86_400_000), now)).toBe("2 days ago");
    expect(lastSeenText(null, now)).toBe("Never seen");
  });
  it("a clock slightly behind the server does not break the text", () => {
    expect(lastSeenText(new Date(now + 5000).toISOString(), now)).toBe("Just now");
    expect(presenceState(new Date(now + 5000).toISOString(), now)).toBe("online");
  });
  it("counts online and offline (never counts as offline)", () => {
    expect(presenceCounts(["online", "offline", "never", "online"])).toEqual({ online: 2, offline: 2 });
  });
});
