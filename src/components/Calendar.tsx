import { useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  X,
  Check,
  Edit3,
  Video,
  Facebook,
  Instagram,
  Youtube,
  AlertCircle,
  CheckCircle2,
  Clock3,
} from "lucide-react";
import type { ScheduledPost, Platform, PostStatus } from "../types";
import { calendarPosts, platformLabels, platformColors } from "../data";

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.73 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

type IconType = React.ComponentType<{ className?: string }>;

const platformIcons: Record<Platform, IconType> = {
  facebook: Facebook,
  instagram: Instagram,
  tiktok: TikTokIcon,
  youtube: Youtube,
};

const statusConfig: Record<PostStatus, { label: string; dot: string; badge: string; icon: typeof Clock3 }> = {
  pending: { label: "Pending Approval", dot: "bg-amber-400", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: AlertCircle },
  approved: { label: "Approved & Scheduled", dot: "bg-emerald-400", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  published: { label: "Auto-Published", dot: "bg-blue-400", badge: "bg-blue-500/15 text-blue-600 border-blue-500/30", icon: CheckCircle2 },
};

const daysInMonth = 31;
const monthStartDay = 4; // Oct 1, 2026 = Thursday (0=Sun, 4=Thu)
const today = 22;

export default function Calendar() {
  const [view, setView] = useState<"month" | "week">("month");
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);

  // Map posts to day numbers
  const postsByDay: Record<number, ScheduledPost[]> = {};
  calendarPosts.forEach((post) => {
    const day = parseInt(post.date.split(" ")[1]);
    if (!postsByDay[day]) postsByDay[day] = [];
    postsByDay[day].push(post);
  });

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Week view: current week around day 22
  const weekStart = today - today % 7 + (today % 7 === 0 ? 0 : 0);
  const weekDates = [];
  const oct1Day = monthStartDay;
  const todayWeekday = (oct1Day + today - 1) % 7;
  for (let i = 0; i < 7; i++) {
    weekDates.push(today - todayWeekday + i);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-blue-600" />
            Content Calendar & Approval Center
          </h2>
          <p className="text-sm text-slate-600 mt-1">Review, approve, and schedule posts across all platforms.</p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100/50 border border-slate-200/50">
          <button
            onClick={() => setView("month")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              view === "month" ? "bg-blue-500/20 text-blue-700 border border-blue-500/30" : "text-slate-600 hover:text-slate-800"
            }`}
          >
            Month
          </button>
          <button
            onClick={() => setView("week")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              view === "week" ? "bg-blue-500/20 text-blue-700 border border-blue-500/30" : "text-slate-600 hover:text-slate-800"
            }`}
          >
            Week
          </button>
        </div>
      </div>

      {/* Status legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {(Object.keys(statusConfig) as PostStatus[]).map((s) => {
          const cfg = statusConfig[s];
          const Icon = cfg.icon;
          return (
            <div key={s} className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
              <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
                <Icon className="w-3.5 h-3.5" />
                {cfg.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Calendar grid */}
      <div className="glass rounded-2xl p-4 sm:p-5">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">October 2026</h3>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-slate-100/60 transition-colors">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <button className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100/60 transition-colors">
              Today
            </button>
            <button className="p-2 rounded-lg hover:bg-slate-100/60 transition-colors">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-slate-500 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {/* Empty cells before month start */}
          {Array.from({ length: monthStartDay }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[80px] sm:min-h-[110px] rounded-xl bg-slate-100/20 border border-slate-200/40" />
          ))}

          {/* Day cells */}
          {(view === "month" ? Array.from({ length: daysInMonth }, (_, i) => i + 1) : weekDates).map((day) => {
            const isToday = day === today;
            const dayPosts = postsByDay[day] || [];
            const isInWeek = view === "week" || true;

            return (
              <div
                key={day}
                className={`min-h-[80px] sm:min-h-[110px] rounded-xl p-1.5 border transition-all ${
                  isToday
                    ? "bg-blue-500/10 border-blue-500/40 glow-blue"
                    : "bg-slate-100/30 border-slate-200/40 hover:border-slate-300/60"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-semibold ${isToday ? "text-blue-700" : "text-slate-600"}`}>
                    {day}
                  </span>
                  {dayPosts.length > 0 && (
                    <span className="text-[9px] text-slate-500 bg-slate-200/40 px-1.5 rounded">
                      {dayPosts.length}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {dayPosts.slice(0, 2).map((post) => {
                    const status = statusConfig[post.status];
                    return (
                      <button
                        key={post.id}
                        onClick={() => setSelectedPost(post)}
                        className={`w-full text-left p-1.5 rounded-lg bg-gradient-to-r ${post.thumbnailGradient} hover:scale-[1.02] transition-transform group`}
                      >
                        <div className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot} shrink-0`} />
                          <p className="text-[10px] font-semibold text-white truncate">{post.title}</p>
                        </div>
                        <p className="text-[9px] text-white/70 mt-0.5">{post.time}</p>
                      </button>
                    );
                  })}
                  {dayPosts.length > 2 && (
                    <p className="text-[9px] text-slate-500 px-1">+{dayPosts.length - 2} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Post detail drawer */}
      {selectedPost && (
        <PostDrawer post={selectedPost} onClose={() => setSelectedPost(null)} />
      )}
    </div>
  );
}

function PostDrawer({ post, onClose }: { post: ScheduledPost; onClose: () => void }) {
  const [platforms, setPlatforms] = useState<Platform[]>([...post.platforms]);
  const status = statusConfig[post.status];

  const togglePlatform = (p: Platform) => {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full sm:w-[480px] z-50 glass border-l border-slate-200/50 overflow-y-auto scrollbar-thin animate-slide-in">
        <div className="p-5 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${status.badge} flex items-center gap-1.5`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100/60 transition-colors">
              <X className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          {/* Preview card */}
          <div className={`relative aspect-video rounded-2xl bg-gradient-to-br ${post.thumbnailGradient} overflow-hidden flex items-center justify-center`}>
            <div className="absolute inset-0 bg-black/15" />
            <div className="relative text-center px-6">
              <Video className="w-10 h-10 text-white/90 mx-auto mb-2" />
              <p className="text-white font-bold text-base">{post.title}</p>
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <span className="text-[10px] text-white/80 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-lg">
                Preview
              </span>
              <span className="text-[10px] text-white/80 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1">
                <Clock className="w-3 h-3" /> {post.date} · {post.time}
              </span>
            </div>
          </div>

          {/* Title & caption */}
          <div>
            <h3 className="text-lg font-bold text-slate-900">{post.title}</h3>
            <p className="text-sm text-slate-700 mt-2 leading-relaxed">{post.caption}</p>
          </div>

          {/* Hashtags */}
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">Hashtags</p>
            <div className="flex flex-wrap gap-2">
              {post.hashtags.map((tag) => (
                <span key={tag} className="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-700 text-xs font-medium border border-blue-500/20">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Platform checkboxes */}
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">Publishing Platforms</p>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(platformLabels) as Platform[]).map((p) => {
                const Icon = platformIcons[p];
                const selected = platforms.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all ${
                      selected
                        ? "bg-blue-500/15 border-blue-500/40 text-slate-900"
                        : "bg-slate-100/30 border-slate-200/40 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selected ? "bg-blue-500/20" : "bg-slate-200/40"}`}>
                      <Icon className={`w-4 h-4 ${selected ? platformColors[p] : "text-slate-500"}`} />
                    </div>
                    <span className="text-sm font-medium">{platformLabels[p]}</span>
                    {selected && <Check className="w-4 h-4 text-blue-600 ml-auto" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scheduled time */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-100/40 border border-slate-200/40">
            <Clock className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-xs text-slate-500">Scheduled for</p>
              <p className="text-sm font-semibold text-slate-900">{post.date}, 2026 · {post.time}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            {post.status !== "published" && (
              <button className="flex-1 h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-sm font-bold text-white hover:from-emerald-500 hover:to-teal-500 transition-all glow-emerald hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2">
                <Check className="w-5 h-5" />
                Approve & Schedule
              </button>
            )}
            <button className="flex-1 h-12 rounded-xl bg-slate-100 border border-slate-200 text-sm font-bold text-slate-800 hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
              <Edit3 className="w-4 h-4" />
              Edit
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
