import type { Platform, Post } from "../types";
import { isAutoPublish } from "./platforms";

/**
 * What happened to one platform of a post.
 * posted   – the platform accepted it (we have its own id), or a person marked it as posted
 * failed   – an automatic publish was tried and the platform refused it
 * waiting  – approved and still to go out
 * notsent  – not approved yet (draft or waiting for approval)
 */
export type PlatformState = "posted" | "failed" | "waiting" | "notsent";

export interface PlatformOutcome {
  platform: Platform;
  state: PlatformState;
  /** Public address of the live post, when the platform's id gives us one. */
  link: string | null;
}

export type HistoryGroup = "published" | "scheduled" | "failed" | "draft";

export function postLink(platform: Platform, id: string | undefined): string | null {
  if (!id) return null;
  if (platform === "facebook") return `https://www.facebook.com/${encodeURIComponent(id)}`;
  if (platform === "youtube") return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
  return null;
}

export function platformOutcomes(post: Post): PlatformOutcome[] {
  return post.platforms.map((platform) => {
    const id = post.externalIds?.[platform];
    const link = postLink(platform, id);
    if (id) return { platform, state: "posted", link };
    if (post.status === "published") {
      // Published without an id: either the platform failed (auto platforms with an error) or a person posted it by hand.
      const failed = isAutoPublish(platform) && !!post.publishError;
      return { platform, state: failed ? "failed" : "posted", link: null };
    }
    if (post.publishError && isAutoPublish(platform)) return { platform, state: "failed", link: null };
    if (post.status === "approved") return { platform, state: "waiting", link: null };
    return { platform, state: "notsent", link: null };
  });
}

/** Which tab of the history a post belongs to. A post with any failed platform counts as failed. */
export function historyGroup(post: Post): HistoryGroup {
  if (platformOutcomes(post).some((o) => o.state === "failed")) return "failed";
  if (post.status === "published") return "published";
  if (post.status === "approved") return "scheduled";
  return "draft";
}

/** The moment to show for a post: when it went out, else when it is planned. */
export function historyTime(post: Post): string | null {
  return post.publishedAt ?? post.scheduledAt;
}

export function sortHistory(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => {
    const ta = historyTime(a);
    const tb = historyTime(b);
    if (ta && tb) return tb.localeCompare(ta);
    if (ta) return -1;
    if (tb) return 1;
    return 0;
  });
}

export interface HistoryFilter {
  group: HistoryGroup | "all";
  platform: Platform | "all";
  query: string;
}

export function filterHistory(posts: Post[], f: HistoryFilter): Post[] {
  const q = f.query.trim().toLowerCase();
  return sortHistory(
    posts.filter((p) => {
      if (f.group !== "all" && historyGroup(p) !== f.group) return false;
      if (f.platform !== "all" && !p.platforms.includes(f.platform)) return false;
      if (q && !`${p.title} ${p.caption}`.toLowerCase().includes(q)) return false;
      return true;
    }),
  );
}

export function historyCounts(posts: Post[]): Record<HistoryGroup | "all", number> {
  const c: Record<HistoryGroup | "all", number> = { all: posts.length, published: 0, scheduled: 0, failed: 0, draft: 0 };
  for (const p of posts) c[historyGroup(p)] += 1;
  return c;
}
