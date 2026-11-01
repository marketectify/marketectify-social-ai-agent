import type { Message, Post, TabId } from "../types";
import { addDays, isSameDay, startOfDay } from "./dates";

export function greeting(hour: number): string {
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export type AttentionKind = "approve" | "overdue" | "unread" | "unscheduled";

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  /** What needs doing, in plain words. */
  title: string;
  /** Extra line (post title, how late ...). */
  detail: string;
  /** Button text: a verb that says what happens. */
  action: string;
  /** Opens this post in the editor. */
  postId?: string;
  /** Or goes to this tab. */
  tab?: TabId;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The things the person has to deal with today, most urgent first:
 * posts whose time has passed but are still not published, posts waiting for approval,
 * unread messages, and drafts that have no date yet.
 */
export function buildAttention(posts: Post[], messages: Message[], now: Date): AttentionItem[] {
  const items: AttentionItem[] = [];
  const t = now.getTime();

  const overdue = posts
    .filter((p) => p.status === "approved" && p.scheduledAt && new Date(p.scheduledAt).getTime() < t)
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  for (const p of overdue.slice(0, 3)) {
    items.push({
      id: `overdue-${p.id}`,
      kind: "overdue",
      title: "Time has passed: publish this post",
      detail: p.title,
      action: "Open post",
      postId: p.id,
    });
  }

  const pending = posts.filter((p) => p.status === "pending").sort((a, b) => (a.scheduledAt ?? "9").localeCompare(b.scheduledAt ?? "9"));
  for (const p of pending.slice(0, 3)) {
    items.push({ id: `approve-${p.id}`, kind: "approve", title: "Waiting for your approval", detail: p.title, action: "Review", postId: p.id });
  }
  if (pending.length > 3) {
    items.push({ id: "approve-more", kind: "approve", title: `${plural(pending.length - 3, "more post is", "more posts are")} waiting for approval`, detail: "See them in the calendar", action: "Open calendar", tab: "calendar" });
  }

  const unread = messages.filter((m) => m.status === "unread").length;
  if (unread > 0) {
    items.push({ id: "unread", kind: "unread", title: `${plural(unread, "new message", "new messages")} to answer`, detail: "Comments and DMs from your channels", action: "Open inbox", tab: "inbox" });
  }

  const unscheduled = posts.filter((p) => p.status === "draft" && !p.scheduledAt);
  if (unscheduled.length > 0) {
    items.push({ id: "unscheduled", kind: "unscheduled", title: `${plural(unscheduled.length, "draft has", "drafts have")} no date yet`, detail: unscheduled[0].title, action: "Pick a date", postId: unscheduled[0].id });
  }
  return items;
}

/** One sentence that sums the day up. */
export function headline(items: AttentionItem[], upcomingThisWeek: number): string {
  if (items.length > 0) return `${plural(items.length, "thing needs", "things need")} you today.`;
  if (upcomingThisWeek > 0) return `You are all caught up. ${plural(upcomingThisWeek, "post is", "posts are")} scheduled for the next 7 days.`;
  return "You are all caught up. Nothing is scheduled for the next 7 days.";
}

export interface DayColumn {
  date: Date;
  isToday: boolean;
  posts: Post[];
}

/** The next `days` days (starting today) with the scheduled and pending posts on each one. */
export function weekStrip(posts: Post[], now: Date, days = 7): DayColumn[] {
  const today = startOfDay(now);
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i);
    const list = posts
      .filter((p) => (p.status === "approved" || p.status === "pending" || p.status === "published") && p.scheduledAt && isSameDay(new Date(p.scheduledAt), date))
      .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
    return { date, isToday: i === 0, posts: list };
  });
}

export interface SetupStep {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  action: string;
  tab?: TabId;
  newPost?: boolean;
}

/** First steps for a new account. The list disappears once everything is done. */
export function setupSteps(posts: Post[], designCount: number): SetupStep[] {
  return [
    { id: "post", label: "Write your first post", hint: "Use the AI Content Studio or write it yourself.", done: posts.length > 0, action: "Create a post", newPost: true },
    { id: "design", label: "Design a picture", hint: "Drag a heading and a background, then save it.", done: designCount > 0, action: "Open Design Studio", tab: "design" },
    { id: "schedule", label: "Schedule a post", hint: "Pick the platforms and a time, then approve it.", done: posts.some((p) => p.status === "approved" || p.status === "published"), action: "Open calendar", tab: "calendar" },
  ];
}
