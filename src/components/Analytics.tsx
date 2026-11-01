import { useMemo, useState } from "react";
import { BarChart3, Clock, Download, Info, Inbox as InboxIcon, MessageCircle, Send, Target, type LucideIcon } from "lucide-react";
import type { Platform } from "../types";
import { platformLabels } from "../data";
import { platformIcons } from "./PlatformIcon";
import { usePosts } from "../context/PostsContext";
import { useMessages } from "../context/MessagesContext";
import { useToast } from "../context/ToastContext";
import { useSocialAccounts } from "../context/SocialAccountsContext";
import { formatCount } from "../lib/socialAccounts";
import { timeAgo } from "../lib/dates";
import { PLATFORMS, RANGES, buildReportCsv, computeAnalytics, formatDuration, formatPercent, type RangeId } from "../lib/analytics";

const platformChartColors: Record<Platform, string> = {
  facebook: "#3b82f6",
  instagram: "#ec4899",
  tiktok: "#06b6d4",
  youtube: "#ef4444",
};

export default function Analytics() {
  const { posts, loading: postsLoading } = usePosts();
  const { messages, loading: messagesLoading } = useMessages();
  const toast = useToast();
  const [range, setRange] = useState<RangeId>("30d");

  const social = useSocialAccounts();
  const youtube = social.get("youtube");
  const a = useMemo(() => computeAnalytics(posts, messages, range), [posts, messages, range]);
  const rangeLabel = RANGES.find((r) => r.id === range)?.label ?? "";
  const loading = postsLoading || messagesLoading;
  const maxMonth = Math.max(1, ...a.months.map((m) => Math.max(...PLATFORMS.map((p) => m.byPlatform[p]))));
  const maxPlatformPosts = Math.max(1, ...PLATFORMS.map((p) => a.posts.byPlatform[p]));
  const maxPlatformMessages = Math.max(1, ...PLATFORMS.map((p) => a.inbox.byPlatform[p]));
  const noData = a.posts.total === 0 && a.inbox.total === 0;

  const exportReport = () => {
    try {
      const csv = buildReportCsv(posts, messages, a, rangeLabel);
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `marketectify-report-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Report downloaded");
    } catch {
      toast.error("Could not create the report. Please try again.");
    }
  };

  const cards: { icon: LucideIcon; label: string; value: string; note: string }[] = [
    { icon: Send, label: "Posts published", value: String(a.posts.byStatus.published), note: `${a.posts.upcoming} scheduled ahead` },
    { icon: MessageCircle, label: "Messages received", value: String(a.inbox.total), note: `${a.inbox.unread} unread` },
    { icon: Clock, label: "Average reply time", value: formatDuration(a.inbox.avgResponseMinutes), note: `${formatPercent(a.inbox.replyRate)} replied` },
    { icon: Target, label: "Leads", value: String(a.inbox.leads), note: `${formatPercent(a.inbox.leadRate)} of messages` },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Analytics & Leads
          </h2>
          <p className="text-sm text-slate-600 mt-1">Your content output, inbox response and leads, calculated from your own data.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="analytics-range">
            Time range
          </label>
          <select
            id="analytics-range"
            value={range}
            onChange={(e) => setRange(e.target.value as RangeId)}
            className="h-10 px-3 rounded-xl bg-slate-100/50 border border-slate-200/50 text-xs font-medium text-slate-700"
          >
            {RANGES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            onClick={exportReport}
            disabled={loading}
            className="flex items-center gap-2 h-10 px-3 rounded-xl bg-blue-500/15 border border-blue-500/30 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-500/25 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      <div role="status" className="flex gap-2 items-start text-xs text-slate-700 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
        <p>
          Reach, likes and followers come from Facebook, Instagram, TikTok and YouTube, which are not connected yet, so they are
          not shown rather than guessed. Everything below is calculated from the posts and messages in your workspace.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="glass rounded-2xl p-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center border bg-blue-500/10 border-blue-500/20 mb-3">
                <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {loading ? <span className="inline-block w-12 h-7 rounded bg-slate-200 animate-pulse" /> : c.value}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">{c.label}</p>
              <p className="text-[11px] text-slate-500 mt-1">{c.note}</p>
            </div>
          );
        })}
      </div>

      {youtube && (
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            {youtube.avatarUrl ? (
              <img src={youtube.avatarUrl} alt="" referrerPolicy="no-referrer" className="w-10 h-10 rounded-full" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center text-sm font-bold">YT</div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-slate-900 truncate">{youtube.displayName}</h3>
              <p className="text-xs text-slate-500 truncate">
                YouTube channel{youtube.handle ? ` · ${youtube.handle}` : ""}
                {youtube.statsUpdatedAt ? ` · updated ${timeAgo(youtube.statsUpdatedAt)}` : ""}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Subscribers", formatCount(youtube.subscribers)],
              ["Total views", formatCount(youtube.viewCount)],
              ["Videos", formatCount(youtube.videoCount)],
            ].map(([label, value]) => (
              <div key={label} className="glass-light rounded-xl p-3">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-3">These numbers come straight from YouTube. They are channel totals, not limited to the time range above.</p>
        </div>
      )}

      {!loading && noData && (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-sm font-semibold text-slate-900">Nothing to show for {rangeLabel.toLowerCase()}</p>
          <p className="text-xs text-slate-500 mt-1">Create posts in the Calendar and add messages in the Inbox, or choose a longer time range.</p>
        </div>
      )}

      <div className="glass rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Posts per month</h3>
            <p className="text-xs text-slate-500 mt-0.5">Scheduled and published posts by platform, last 6 months</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {PLATFORMS.map((p) => (
              <div key={p} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: platformChartColors[p] }} />
                <span className="text-xs text-slate-600">{platformLabels[p]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative h-56 flex items-end justify-between gap-2 sm:gap-4 pt-4" role="img" aria-label={`Posts per month: ${a.months.map((m) => `${m.label} ${m.total}`).join(", ")}`}>
          <div className="absolute inset-0 pb-8 flex flex-col justify-between pointer-events-none">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="border-t border-slate-200/50 w-full" />
            ))}
          </div>
          {a.months.map((m) => (
            <div key={m.key} className="relative flex-1 min-w-0 h-full flex flex-col items-center">
              <div className="w-full flex-1 flex items-end justify-center gap-0.5 sm:gap-1 pb-1">
                {PLATFORMS.map((p) => (
                  <div
                    key={p}
                    title={`${platformLabels[p]}: ${m.byPlatform[p]}`}
                    className="flex-1 min-w-0 max-w-4 rounded-t-md transition-all duration-500"
                    style={{ height: `${(m.byPlatform[p] / maxMonth) * 100}%`, minHeight: m.byPlatform[p] > 0 ? 4 : 0, backgroundColor: platformChartColors[p] }}
                  />
                ))}
              </div>
              <span className="text-[10px] sm:text-xs font-medium text-slate-600 h-6">{m.label}</span>
              <span className="text-[10px] text-slate-500 -mt-1">{m.total}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass rounded-2xl p-5">
          <h3 className="text-lg font-bold text-slate-900 mb-1">By platform</h3>
          <p className="text-xs text-slate-500 mb-5">Posts and messages, {rangeLabel.toLowerCase()}</p>
          <div className="space-y-5">
            {PLATFORMS.map((p) => {
              const Icon = platformIcons[p];
              return (
                <div key={p}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-slate-700" />
                    <span className="text-sm font-semibold text-slate-900">{platformLabels[p]}</span>
                  </div>
                  <MiniBar label="Posts" value={a.posts.byPlatform[p]} max={maxPlatformPosts} color={platformChartColors[p]} />
                  <MiniBar label="Messages" value={a.inbox.byPlatform[p]} max={maxPlatformMessages} color={platformChartColors[p]} faded />
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass rounded-2xl p-5">
            <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
              <InboxIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Lead funnel
            </h3>
            <p className="text-xs text-slate-500 mb-5">From the Inbox. Mark a message as a lead when the person looks like a customer.</p>
            <div className="space-y-3">
              {a.funnel.map((stage, idx) => (
                <div key={stage.stage}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-800">{stage.stage}</span>
                    <span className="text-sm">
                      <strong className="font-bold text-slate-900">{stage.count}</strong>
                      <span className="text-xs text-slate-500 ml-2">{stage.percent}%</span>
                    </span>
                  </div>
                  <div className="h-3 rounded-lg bg-slate-200 overflow-hidden">
                    <div className="h-full rounded-lg transition-all duration-500" style={{ width: `${stage.percent}%`, backgroundColor: ["#93c5fd", "#2563eb", "#10b981"][idx] }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Content pipeline</h3>
            <dl className="grid grid-cols-2 gap-3">
              {(
                [
                  ["Drafts", a.posts.byStatus.draft],
                  ["Awaiting approval", a.posts.byStatus.pending],
                  ["Approved", a.posts.byStatus.approved],
                  ["Published", a.posts.byStatus.published],
                ] as const
              ).map(([label, n]) => (
                <div key={label} className="glass-light rounded-xl p-3">
                  <dt className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</dt>
                  <dd className="text-xl font-bold text-slate-900 mt-1">{n}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniBar({ label, value, max, color, faded }: { label: string; value: number; max: number; color: string; faded?: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-1.5">
      <span className="w-16 text-[11px] text-slate-500">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(value / max) * 100}%`, backgroundColor: color, opacity: faded ? 0.55 : 1 }} />
      </div>
      <span className="w-8 text-right text-xs font-semibold text-slate-800">{value}</span>
    </div>
  );
}
