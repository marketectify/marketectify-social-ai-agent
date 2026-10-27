import {
  Eye,
  Users,
  Heart,
  Target,
  TrendingUp,
  Video,
  CalendarPlus,
  Inbox as InboxIcon,
  ArrowUpRight,
  Clock,
  MoreVertical,
} from "lucide-react";
import type { TabId, ScheduledPost } from "../types";
import { statCards, upcomingPosts, platformLabels, platformBg } from "../data";

interface OverviewProps {
  onNavigate: (tab: TabId) => void;
}

const iconMap: Record<string, typeof Eye> = {
  Eye,
  Users,
  Heart,
  Target,
};

const statusConfig: Record<string, { label: string; dot: string; badge: string }> = {
  pending: { label: "Pending", dot: "bg-amber-400", badge: "bg-amber-500/15 text-amber-800 dark:text-amber-400 border-amber-500/30" },
  approved: { label: "Approved", dot: "bg-emerald-400", badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  published: { label: "Published", dot: "bg-blue-400", badge: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" },
};

export default function Overview({ onNavigate }: OverviewProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Welcome back, MarketKing 👋</h2>
          <p className="text-sm text-slate-600 mt-1">Here's what's happening across all your social channels today.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Clock className="w-4 h-4" />
          <span>Thursday, October 22, 2026</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = iconMap[stat.icon] ?? Eye;
          return (
            <div
              key={stat.label}
              className={`relative group glass rounded-2xl p-5 overflow-hidden hover:border-slate-200 transition-all duration-300 hover:scale-[1.02]`}
            >
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${stat.accent}`}>
                    <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
                    stat.trendUp ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-red-500/15 text-red-600 dark:text-red-400"
                  }`}>
                    <TrendingUp className={`w-3 h-3 ${stat.trendUp ? "" : "rotate-180"}`} />
                    {stat.trend}
                  </div>
                </div>
                <p className="text-3xl font-bold text-slate-900 tracking-tight">{stat.value}</p>
                <p className="text-sm text-slate-600 mt-1">{stat.label}</p>
              </div>
            </div>
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
              <p className="text-xs text-slate-500 mt-0.5">{upcomingPosts.length} posts queued for this week</p>
            </div>
            <button
              onClick={() => onNavigate("calendar")}
              className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              View Calendar <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {upcomingPosts.map((post) => (
              <PostRow key={post.id} post={post} onClick={() => onNavigate("calendar")} />
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="glass rounded-2xl p-5">
          <h3 className="text-lg font-bold text-slate-900 mb-1">Quick Actions</h3>
          <p className="text-xs text-slate-500 mb-5">Jump straight into work</p>

          <div className="space-y-3">
            <QuickAction
              icon={Video}
              label="Generate New Reel"
              description="AI-powered short video creation"
              color="bg-blue-600"
              onClick={() => onNavigate("studio")}
            />
            <QuickAction
              icon={CalendarPlus}
              label="Schedule Post"
              description="Plan & queue content for publishing"
              color="bg-sky-700"
              onClick={() => onNavigate("calendar")}
            />
            <QuickAction
              icon={InboxIcon}
              label="View Inbox"
              description="Check & auto-reply to messages"
              color="bg-indigo-600"
              onClick={() => onNavigate("inbox")}
            />
          </div>

          {/* Mini insight card */}
          <div className="mt-5 glass-light rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-600">Best performing platform</span>
              <MoreVertical className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-600 flex items-center justify-center">
                <Heart className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Instagram</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">+8.9% engagement this week</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PostRow({ post, onClick }: { post: ScheduledPost; onClick: () => void }) {
  const status = statusConfig[post.status];
  return (
    <button
      onClick={onClick}
      className="w-full group flex items-center gap-4 p-3 rounded-xl hover:bg-slate-100/50 transition-all text-left border border-transparent hover:border-slate-200/50"
    >
      <div className={`w-12 h-12 rounded-xl ${post.thumbnailColor} shrink-0 flex items-center justify-center`}>
        <Video className="w-5 h-5 text-white/90" />
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
        <p className="text-xs text-slate-500 truncate mt-0.5">{post.caption}</p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {post.date} · {post.time}
          </span>
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
  icon: typeof Video;
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
