import { useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
} from "lucide-react";
import type { Post, PostStatus } from "../types";
import { usePosts } from "../context/PostsContext";
import { statusConfig, statusOrder } from "../lib/status";
import {
  addDays,
  addMonths,
  formatFullDate,
  formatMonthYear,
  formatShortDate,
  formatTime,
  formatWeekday,
  isSameDay,
  isSameMonth,
  monthGrid,
  startOfDay,
  weekOf,
} from "../lib/dates";
import PostEditor from "./PostEditor";

type View = "month" | "week";

interface EditorState {
  post: Post | null;
  defaultDate?: Date;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function PostChip({ post, onOpen, compact }: { post: Post; onOpen: (p: Post) => void; compact?: boolean }) {
  const cfg = statusConfig[post.status];
  const when = post.scheduledAt ? formatTime(new Date(post.scheduledAt)) : "";
  return (
    <button
      onClick={() => onOpen(post)}
      title={`${post.title} · ${cfg.label}`}
      className={`w-full text-left rounded-lg ${cfg.chip} text-white hover:brightness-110 transition ${
        compact ? "px-1.5 py-1" : "px-2 py-1.5"
      }`}
    >
      <div className="flex items-center gap-1.5">
        {post.media?.kind === "image" && (
          <img src={post.media.url} alt="" className={`shrink-0 rounded object-cover ${compact ? "w-4 h-4" : "w-6 h-6"}`} loading="lazy" />
        )}
        <p className={`font-semibold truncate ${compact ? "text-[10px]" : "text-xs"}`}>{post.title}</p>
      </div>
      {when && <p className="text-[10px] text-white/90">{when}</p>}
    </button>
  );
}

export default function Calendar() {
  const { posts, loading, error, reload } = usePosts();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [editor, setEditor] = useState<EditorState | null>(null);
  const today = startOfDay(new Date());

  const postsByDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const post of posts) {
      if (!post.scheduledAt) continue;
      const d = new Date(post.scheduledAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      map.set(key, [...(map.get(key) ?? []), post]);
    }
    return map;
  }, [posts]);

  const unscheduled = posts.filter((p) => !p.scheduledAt);
  const postsOn = (day: Date) =>
    postsByDay.get(`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`) ?? [];

  const days = view === "month" ? monthGrid(cursor.getFullYear(), cursor.getMonth()) : weekOf(cursor);

  const counts = useMemo(() => {
    const c: Record<PostStatus, number> = { draft: 0, pending: 0, approved: 0, published: 0 };
    for (const p of posts) c[p.status]++;
    return c;
  }, [posts]);

  const go = (direction: -1 | 1) =>
    setCursor((c) => (view === "month" ? addMonths(c, direction) : addDays(c, direction * 7)));

  const title =
    view === "month"
      ? formatMonthYear(cursor)
      : `${formatShortDate(days[0])} – ${formatShortDate(days[6])}, ${days[6].getFullYear()}`;

  const maxChips = view === "month" ? 3 : 20;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Content Calendar &amp; Approvals
          </h2>
          <p className="text-sm text-slate-600 mt-1">Plan, approve and schedule posts across all platforms.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/50 border border-slate-200" role="group" aria-label="Calendar view">
            {(["month", "week"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                  view === v
                    ? "bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                    : "text-slate-600 hover:text-slate-800 border border-transparent"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            onClick={() => setEditor({ post: null, defaultDate: cursor })}
            className="flex items-center gap-2 px-4 h-10 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 transition-colors glow-blue"
          >
            <Plus className="w-4 h-4" />
            New post
          </button>
        </div>
      </div>

      {/* Status legend with counts */}
      <div className="flex items-center gap-x-5 gap-y-2 flex-wrap">
        {statusOrder.map((s) => (
          <div key={s} className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${statusConfig[s].dot}`} />
            <span className="text-xs font-medium text-slate-600">
              {statusConfig[s].label} <span className="text-slate-500">({counts[s]})</span>
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm border bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => void reload()} className="font-semibold underline">
            Try again
          </button>
        </div>
      )}

      {/* Calendar */}
      <div className="glass rounded-2xl p-4 sm:p-5 relative">
        <div className="flex items-center justify-between mb-4 gap-3">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <div className="flex items-center gap-1">
            <button onClick={() => go(-1)} aria-label={view === "month" ? "Previous month" : "Previous week"} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <button
              onClick={() => setCursor(startOfDay(new Date()))}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Today
            </button>
            <button onClick={() => go(1)} aria-label={view === "month" ? "Next month" : "Next week"} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>

        {loading && (
          <div className="absolute inset-x-0 top-16 flex justify-center pointer-events-none" aria-live="polite">
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs text-slate-700">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading posts...
            </span>
          </div>
        )}

        {/* Weekday names (hidden in the stacked mobile week view) */}
        <div className={`grid grid-cols-7 gap-1.5 sm:gap-2 mb-2 ${view === "week" ? "hidden sm:grid" : ""}`}>
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-slate-500 py-2">
              {d}
            </div>
          ))}
        </div>

        <div className={`grid gap-1.5 sm:gap-2 ${view === "week" ? "grid-cols-1 sm:grid-cols-7" : "grid-cols-7"}`}>
          {days.map((day) => {
            const isToday = isSameDay(day, today);
            const inMonth = view === "week" || isSameMonth(day, cursor);
            const dayPosts = postsOn(day);
            const shown = dayPosts.slice(0, maxChips);
            const hidden = dayPosts.length - shown.length;
            return (
              <div
                key={day.toISOString()}
                className={`group rounded-xl p-1.5 border transition-colors ${
                  view === "month" ? "min-h-[84px] sm:min-h-[116px]" : "min-h-[120px] sm:min-h-[260px]"
                } ${
                  isToday
                    ? "bg-blue-500/10 border-blue-500/50"
                    : inMonth
                      ? "bg-slate-100/40 border-slate-200 hover:border-slate-300"
                      : "bg-transparent border-slate-200/60 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-semibold ${
                      isToday ? "text-blue-700 dark:text-blue-300" : "text-slate-600"
                    }`}
                  >
                    {view === "week" && <span className="sm:hidden mr-1">{formatWeekday(day)}</span>}
                    {day.getDate()}
                  </span>
                  <button
                    onClick={() => setEditor({ post: null, defaultDate: day })}
                    aria-label={`Add a post on ${formatFullDate(day)}`}
                    className="p-0.5 rounded text-slate-500 hover:text-blue-700 hover:bg-blue-500/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-1">
                  {shown.map((post) => (
                    <PostChip key={post.id} post={post} onOpen={(p) => setEditor({ post: p })} compact={view === "month"} />
                  ))}
                  {hidden > 0 && (
                    <button
                      onClick={() => {
                        setCursor(day);
                        setView("week");
                      }}
                      className="text-[10px] font-medium text-blue-700 dark:text-blue-300 px-1 hover:underline"
                    >
                      +{hidden} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!loading && !error && posts.length === 0 && (
          <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-center">
            <p className="text-sm font-semibold text-slate-900">No posts yet</p>
            <p className="text-xs text-slate-600 mt-1 mb-4">Create your first post to see it on the calendar.</p>
            <button
              onClick={() => setEditor({ post: null, defaultDate: cursor })}
              className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Create a post
            </button>
          </div>
        )}
      </div>

      {/* Unscheduled drafts */}
      {unscheduled.length > 0 && (
        <div className="glass rounded-2xl p-4 sm:p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-3">
            Unscheduled drafts <span className="text-slate-500 font-medium">({unscheduled.length})</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {unscheduled.map((post) => (
              <PostChip key={post.id} post={post} onOpen={(p) => setEditor({ post: p })} />
            ))}
          </div>
        </div>
      )}

      {editor && (
        <PostEditor
          key={editor.post?.id ?? "new"}
          post={editor.post}
          defaultDate={editor.defaultDate}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
