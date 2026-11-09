import type { SupabaseClient } from "@supabase/supabase-js";

/** A tab pings about once a minute, so two missed pings still count as online. */
export const HEARTBEAT_MS = 60_000;
export const ONLINE_WINDOW_MS = 150_000;

export type PresenceState = "online" | "offline" | "never";

export function presenceState(lastSeen: string | null | undefined, now: number): PresenceState {
  if (!lastSeen) return "never";
  const t = Date.parse(lastSeen);
  if (Number.isNaN(t)) return "never";
  return now - t <= ONLINE_WINDOW_MS ? "online" : "offline";
}

/** "5 minutes ago", "3 hours ago", "2 days ago". */
export function lastSeenText(lastSeen: string | null | undefined, now: number): string {
  const t = lastSeen ? Date.parse(lastSeen) : NaN;
  if (Number.isNaN(t)) return "Never seen";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "Just now";
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"} ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return unit(m, "minute");
  const h = Math.floor(m / 60);
  if (h < 24) return unit(h, "hour");
  return unit(Math.floor(h / 24), "day");
}

export function presenceCounts(states: PresenceState[]): { online: number; offline: number } {
  const online = states.filter((s) => s === "online").length;
  return { online, offline: states.length - online };
}

/** Tell the database "I am here". Never throws: before 0015 is run it simply does nothing. */
export async function touchPresence(client: SupabaseClient): Promise<void> {
  try {
    await client.rpc("touch_presence");
  } catch {
    /* presence is a nice-to-have */
  }
}

/** Admin only. Returns null when the 0015 SQL file has not been run yet. */
export async function adminPresence(client: SupabaseClient): Promise<Map<string, string | null> | null> {
  try {
    const { data, error } = await client.rpc("admin_account_presence");
    if (error) return null;
    const map = new Map<string, string | null>();
    for (const row of (data as Array<{ workspace_id?: unknown; last_seen?: unknown }> | null) ?? []) {
      if (typeof row.workspace_id === "string") map.set(row.workspace_id, typeof row.last_seen === "string" ? row.last_seen : null);
    }
    return map;
  } catch {
    return null;
  }
}
