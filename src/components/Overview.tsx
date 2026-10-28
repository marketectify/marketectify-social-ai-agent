import { useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Clock,
  FileText,
  Inbox as InboxIcon,
  Plus,
  Sparkles,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import type { Platform, Post, TabId } from "../types";
import { platformLabels, platformBg } from "../data";
import { platformIcons } from "./PlatformIcon";
import { usePosts } from "../context/PostsContext";
import { useAuth } from "../context/AuthContext";
import { statusConfig } from "../lib/status";
import { formatDateTime, formatFullDate } from "../lib/dates";
import PostEditor from "./PostEditor";

interface OverviewProps {
  onNavigate: (tab: TabId) => void;
}

interface EditorState {
  post: Post | null;
}

const ALL_PLATFORMS = Object.keys(platformLabels) as Platform[];

export default function Overview({ onNavigate }: OverviewProps) {
  const { posts, loading, error, reload } = usePosts();
  const { workspace } = useAuth();
  const [editor, setEditor] = useState<EditorState | null>(null);

  const stats = useMemo(() => {
    const now = Date.now();
    const scheduled = posts.filter(
      (p) => p.status === "approved" && p.scheduledAt && new Date(p.scheduledAt).getTime() >= now,
    ).length;
    return {
      scheduled,
      pending: posts.filter((p) => p.status === "pending").length,
      drafts: posts.filter((p) => p.status === "draft").length,
      published: posts.filter((p) => p.status === "published").length,
    };
  }, [posts]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return posts
      .filter(
        (p) =>
          (p.status === "approved" || p.status === "pending") &&
          p.scheduledAt &&
          new Date(p.scheduledAt).getTime() >= now,
      )
      .slice(0, 5);
  }, [posts]);

  const platformCounts = useMemo(() => {
    const counts = Object.fromEntries(ALL_PLATFORMS.map((p) => [p, 0])) as Record<Platform, number>;
    for (const post of posts) for (const p of post.platforms) counts[p]++;
    return counts;
  }, [posts]);
  const maxCount = Math.max(1, ...Object.values(platformCounts));
  const hasPlatformData = Object.values(platformCounts).some((n) => n > 0);

  const statCards: { label: string; value: number; icon: LucideIcon; accent: string }[] = [
    { label: "Scheduled posts", value: stats.scheduled, icon: CalendarClock, accent: "bg-blue-500/10 border-blue-500/20" },
    { label: "Awaiting approval", value: stats.pending, icon: Clock, accent: "bg-sky-500/10 border-sky-500/20" },
    { label: "Drafts", value: stats.drafts, icon: FileText, accent: "bg-indigo-500/10 border-indigo-500/20" },
    { label: "Published", value: stats.published, icon: CheckCircle2, accent: "bg-cyan-500/10 border-cyan-500/20" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Welcome back, {workspace?.name ?? "there"} 👋</h2>
          <p className="text-sm text-slate-600 mt-1">Here's what's happening across your social channels today.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Clock className="w-4 h-4" />
          <span>{formatFullDate(new Date())}</span>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm border bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400">
          <span className="flex-1">{error}</span>
          <button onClick={() => void reload()} className="font-semibold underline">
            Try again
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.label}
              onClick={() => onNavigate("calendar")}
              className="glass rounded-2xl p-5 text-left hover:border-slate-300 transition-all duration-300 hover:scale-[1.02]"
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center border mb-4 ${stat.accent}`}>
                <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-3xl font-bold text-slate-900 tracking-tight">
                {loading ? <span className="inline-block w-10 h-8 rounded bg-slate-200 animate-pulse" /> : stat.value}
              </p>
              <p className="text-sm text-slate-600 mt-1">{stat.label}</p>
            </button>
          );
        })}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming posts */}
        <div className="lg:col-span-2 glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Upcoming Scheduled Posts</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {upcoming.length === 0 ? "Nothing queued" : `Next ${upcoming.length} on your calendar`}
              </p>
            </div>
            <button
              onClick={() => onNavigate("calendar")}
              className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              View Calendar <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
              <p className="text-sm font-semibold text-slate-900">No upcoming posts</p>
              <p className="text-xs text-slate-600 mt-1 mb-4">Schedule your next post to keep your channels active.</p>
              <button
                onClick={() => setEditor({ post: null })}
                className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" /> Create a post
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map((post) => (
                <PostRow key={post.id} post={post} onClick={() => setEditor({ post })} />
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <div className="glass rounded-2xl p-5">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Quick Actions</h3>
            <p className="text-xs text-slate-500 mb-5">Jump straight into work</p>
            <div className="space-y-3">
              <QuickAction
                icon={Sparkles}
                label="Create with AI"
                description="Captions, scripts and visuals"
                color="bg-blue-600"
                onClick={() => onNavigate("studio")}
              />
              <QuickAction
                icon={CalendarPlus}
                label="Schedule Post"
                description="Plan & queue content for publishing"
                color="bg-sky-700"
                onClick={() => setEditor({ post: null })}
              />
              <QuickAction
                icon={InboxIcon}
                label="View Inbox"
                description="Check & reply to messages"
                color="bg-indigo-600"
                onClick={() => onNavigate("inbox")}
              />
            </div>
          </div>

          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Posts by platform</h3>
            <p className="text-xs text-slate-500 mb-4">Across all your posts</p>
            {hasPlatformData ? (
              <div className="space-y-3">
                {ALL_PLATFORMS.map((p) => {
                  const Icon = platformIcons[p];
                  return (
                    <div key={p} className="flex items-center gap-3">
                      <Icon className="w-4 h-4 text-slate-600 shrink-0" />
                      <span className="text-xs font-medium text-slate-700 w-16 shrink-0">{platformLabels[p]}</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${(platformCounts[p] / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-slate-900 w-6 text-right">{platformCounts[p]}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-600">Choose platforms on your posts to see how they are spread out.</p>
            )}
          </div>
        </div>
      </div>

      {editor && <PostEditor key={editor.post?.id ?? "new"} post={editor.post} onClose={() => setEditor(null)} />}
    </div>
  );
}

function PostRow({ post, onClick }: { post: Post; onClick: () => void }) {
  const status = statusConfig[post.status];
  return (
    <button
      onClick={onClick}
      className="w-full group flex items-center gap-4 p-3 rounded-xl hover:bg-slate-100/50 transition-all text-left border border-transparent hover:border-slate-200"
    >
      <div className={`w-12 h-12 rounded-xl ${status.chip} shrink-0 flex items-center justify-center`}>
        <CalendarClock className="w-5 h-5 text-white/90" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
            {post.title}
          </p>
          <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${status.badge}`}>
            {status.label}
          </span>
        </div>
        {post.caption && <p className="text-xs text-slate-500 truncate mt-0.5">{post.caption}</p>}
        <div className="flex items-center gap-3 mt-1.5">
          {post.scheduledAt && (
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {formatDateTime(post.scheduledAt)}
            </span>
          )}
          <div className="flex items-center gap-1">
            {post.platforms.map((p) => (
              <span key={p} className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${platformBg[p]}`}>
                {platformLabels[p].slice(0, 2)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors shrink-0" />
    </button>
  );
}

function QuickAction({
  icon: Icon,
  label,
  description,
  color,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full group flex items-center gap-3 p-3 rounded-xl glass-light hover:border-slate-300 transition-all hover:scale-[1.02] active:scale-95 text-left"
    >
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">{label}</p>
        <p className="text-[11px] text-slate-500">{description}</p>
      </div>
      <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors shrink-0" />
    </button>
  );
}
