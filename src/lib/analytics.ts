import type { Message, Platform, Post, PostStatus } from "../types";

export type RangeId = "30d" | "90d" | "180d" | "all";

export const RANGES: { id: RangeId; label: string; days: number | null }[] = [
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
  { id: "180d", label: "Last 6 months", days: 180 },
  { id: "all", label: "All time", days: null },
];

export const PLATFORMS: Platform[] = ["facebook", "instagram", "tiktok", "youtube"];
const STATUSES: PostStatus[] = ["draft", "pending", "approved", "published"];

const emptyByPlatform = (): Record<Platform, number> => ({ facebook: 0, instagram: 0, tiktok: 0, youtube: 0 });

export interface MonthBucket {
  key: string; // 2026-10
  label: string; // Oct
  byPlatform: Record<Platform, number>;
  total: number;
}

export interface Analytics {
  posts: {
    total: number;
    byStatus: Record<PostStatus, number>;
    byPlatform: Record<Platform, number>;
    /** Approved posts planned for the future. */
    upcoming: number;
  };
  months: MonthBucket[];
  inbox: {
    total: number;
    unread: number;
    replied: number;
    /** 0 to 1, or null when there are no messages. */
    replyRate: number | null;
    /** Average minutes between receiving and replying, or null when nothing was replied. */
    avgResponseMinutes: number | null;
    byPlatform: Record<Platform, number>;
    leads: number;
    /** 0 to 1, or null when there are no messages. */
    leadRate: number | null;
  };
  funnel: { stage: string; count: number; percent: number }[];
}

export function rangeStart(range: RangeId, now: Date): Date | null {
  const days = RANGES.find((r) => r.id === range)?.days ?? null;
  if (days === null) return null;
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** The last `count` calendar months, oldest first, ending with the month of `now`. */
export function lastMonths(now: Date, count: number): MonthBucket[] {
  const out: MonthBucket[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: monthKey(d),
      label: d.toLocaleString("en-US", { month: "short" }),
      byPlatform: emptyByPlatform(),
      total: 0,
    });
  }
  return out;
}

export function computeAnalytics(posts: Post[], messages: Message[], range: RangeId, now: Date = new Date()): Analytics {
  const start = rangeStart(range, now);
  const startMs = start ? start.getTime() : -Infinity;

  // Posts: those with a date must fall in the range (future posts count as planned work).
  // Undated drafts are current work, so they are always included.
  const inRangePosts = posts.filter((p) => !p.scheduledAt || new Date(p.scheduledAt).getTime() >= startMs);

  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<PostStatus, number>;
  const postsByPlatform = emptyByPlatform();
  let upcoming = 0;
  for (const p of inRangePosts) {
    byStatus[p.status]++;
    for (const pl of p.platforms) postsByPlatform[pl]++;
    if (p.status === "approved" && p.scheduledAt && new Date(p.scheduledAt).getTime() >= now.getTime()) upcoming++;
  }

  // Monthly chart: always the last 6 months, independent of the range.
  const months = lastMonths(now, 6);
  const index = new Map(months.map((m) => [m.key, m]));
  for (const p of posts) {
    if (!p.scheduledAt) continue;
    const bucket = index.get(monthKey(new Date(p.scheduledAt)));
    if (!bucket) continue;
    for (const pl of p.platforms) {
      bucket.byPlatform[pl]++;
      bucket.total++;
    }
  }

  const inRangeMessages = messages.filter((m) => new Date(m.receivedAt).getTime() >= startMs);
  const messagesByPlatform = emptyByPlatform();
  let unread = 0;
  let replied = 0;
  let leads = 0;
  let responseTotal = 0;
  let responseCount = 0;
  for (const m of inRangeMessages) {
    messagesByPlatform[m.platform]++;
    if (m.status === "unread") unread++;
    if (m.status === "replied") {
      replied++;
      if (m.repliedAt) {
        const minutes = (new Date(m.repliedAt).getTime() - new Date(m.receivedAt).getTime()) / 60000;
        if (Number.isFinite(minutes) && minutes >= 0) {
          responseTotal += minutes;
          responseCount++;
        }
      }
    }
    if (m.isLead) leads++;
  }
  const total = inRangeMessages.length;

  const pct = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
  return {
    posts: { total: inRangePosts.length, byStatus, byPlatform: postsByPlatform, upcoming },
    months,
    inbox: {
      total,
      unread,
      replied,
      replyRate: total === 0 ? null : replied / total,
      avgResponseMinutes: responseCount === 0 ? null : responseTotal / responseCount,
      byPlatform: messagesByPlatform,
      leads,
      leadRate: total === 0 ? null : leads / total,
    },
    funnel: [
      { stage: "Messages received", count: total, percent: total === 0 ? 0 : 100 },
      { stage: "Replied", count: replied, percent: pct(replied) },
      { stage: "Marked as leads", count: leads, percent: pct(leads) },
    ],
  };
}

export function formatDuration(minutes: number | null): string {
  if (minutes === null) return "No replies yet";
  if (minutes < 1) return "Under a minute";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours < 10 ? hours.toFixed(1).replace(/\.0$/, "") : Math.round(hours)} h`;
  return `${Math.round(hours / 24)} d`;
}

export function formatPercent(value: number | null): string {
  return value === null ? "–" : `${Math.round(value * 100)}%`;
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

/** Quotes a value for CSV and neutralises spreadsheet formulas (=, +, -, @ at the start). */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export function buildReportCsv(posts: Post[], messages: Message[], a: Analytics, rangeLabel: string): string {
  const rows: unknown[][] = [
    ["Marketectify report", rangeLabel],
    [],
    ["Summary"],
    ["Posts", a.posts.total],
    ["Published", a.posts.byStatus.published],
    ["Scheduled (upcoming)", a.posts.upcoming],
    ["Awaiting approval", a.posts.byStatus.pending],
    ["Drafts", a.posts.byStatus.draft],
    ["Messages received", a.inbox.total],
    ["Replied", a.inbox.replied],
    ["Reply rate", formatPercent(a.inbox.replyRate)],
    ["Average response time", formatDuration(a.inbox.avgResponseMinutes)],
    ["Leads", a.inbox.leads],
    [],
    ["Posts"],
    ["Title", "Status", "Platforms", "Scheduled at", "Caption"],
    ...posts.map((p) => [p.title, p.status, p.platforms.join(" "), p.scheduledAt ?? "", p.caption]),
    [],
    ["Messages"],
    ["Received at", "Platform", "Type", "Sender", "Status", "Lead", "Message", "Reply"],
    ...messages.map((m) => [m.receivedAt, m.platform, m.kind, m.senderName, m.status, m.isLead ? "yes" : "no", m.body, m.reply ?? ""]),
  ];
  return toCsv(rows);
}
