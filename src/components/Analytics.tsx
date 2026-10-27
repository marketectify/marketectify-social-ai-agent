import {
  BarChart3,
  TrendingUp,
  Target,
  Users,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Facebook,
  Instagram,
  Youtube,
  ArrowUpRight,
  Filter,
  Download,
} from "lucide-react";
import type { Platform } from "../types";
import { engagementData, monthlyChartData, leadFunnelData, platformLabels } from "../data";

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

const platformChartColors: Record<string, string> = {
  facebook: "#3b82f6",
  instagram: "#ec4899",
  tiktok: "#22d3ee",
  youtube: "#ef4444",
};

export default function Analytics() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Analytics & Lead Generation Reports
          </h2>
          <p className="text-sm text-slate-600 mt-1">Multi-platform performance insights and AI-captured lead tracking.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100/50 border border-slate-200/50 text-xs font-medium text-slate-700 hover:bg-slate-200/50 transition-colors">
            <Filter className="w-3.5 h-3.5" />
            Last 6 Months
          </button>
          <button className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-500/25 transition-colors">
            <Download className="w-3.5 h-3.5" />
            Export Report
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryStat icon={Eye} label="Total Impressions" value="3.24M" trend="+18.2%" accent="bg-blue-500/10 border-blue-500/20" />
        <SummaryStat icon={Heart} label="Total Interactions" value="284.5K" trend="+12.4%" accent="bg-sky-500/10 border-sky-500/20" />
        <SummaryStat icon={MessageCircle} label="AI DM Conversations" value="8,420" trend="+34.1%" accent="bg-indigo-500/10 border-indigo-500/20" />
        <SummaryStat icon={Target} label="Conversion Rate" value="2.5%" trend="+0.8%" accent="bg-cyan-500/10 border-cyan-500/20" />
      </div>

      {/* Multi-platform comparative chart */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Multi-Platform Comparative Performance</h3>
            <p className="text-xs text-slate-500 mt-0.5">Monthly reach index across all connected platforms</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {(Object.keys(platformLabels) as Platform[]).map((p) => (
              <div key={p} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: platformChartColors[p] }} />
                <span className="text-xs text-slate-600">{platformLabels[p]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="relative h-64 flex items-end justify-between gap-2 sm:gap-4 pt-4">
          {/* Y-axis lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="border-t border-slate-200/50 w-full" />
            ))}
          </div>

          {monthlyChartData.map((month) => (
            <div key={month.month} className="relative flex-1 flex flex-col items-center gap-2 group">
              <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-full pb-8">
                <Bar value={month.facebook} color={platformChartColors.facebook} delay={0} />
                <Bar value={month.instagram} color={platformChartColors.instagram} delay={50} />
                <Bar value={month.tiktok} color={platformChartColors.tiktok} delay={100} />
                <Bar value={month.youtube} color={platformChartColors.youtube} delay={150} />
              </div>
              <span className="absolute bottom-0 text-[10px] sm:text-xs font-medium text-slate-600">{month.month}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engagement breakdown */}
        <div className="glass rounded-2xl p-5">
          <h3 className="text-lg font-bold text-slate-900 mb-1">Engagement Breakdown by Platform</h3>
          <p className="text-xs text-slate-500 mb-5">Reach, engagement rate & performance score</p>

          <div className="space-y-4">
            {engagementData.map((item) => {
              const Icon = platformIcons[item.platform.toLowerCase() as Platform];
              return (
                <div key={item.platform} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-slate-100/60 flex items-center justify-center">
                        {Icon && <Icon className="w-4 h-4 text-slate-700" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.platform}</p>
                        <p className="text-[10px] text-slate-500">{item.reach} reach · {item.engagement} engagement</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{item.value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color} transition-all duration-700 ease-out`}
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lead conversion funnel */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-bold text-slate-900">Lead Conversion Tracker</h3>
            <span className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              +22.7% MoM
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-5">Direct lead inquiries captured via AI DMs</p>

          <div className="space-y-3">
            {leadFunnelData.map((stage, idx) => (
              <div key={stage.stage}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-medium text-slate-800">{stage.stage}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-900">{stage.count.toLocaleString()}</span>
                    <span className="text-xs text-slate-500 ml-2">{stage.percentage}%</span>
                  </div>
                </div>
                <div className="h-3 rounded-lg bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-lg transition-all duration-700 ease-out"
                    style={{
                      width: `${stage.percentage}%`,
                      backgroundColor: ["#93c5fd", "#60a5fa", "#2563eb", "#10b981"][idx],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Summary card */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="glass-light rounded-xl p-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total Leads</p>
              <p className="text-xl font-bold text-slate-900 mt-1">1,247</p>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                <ArrowUpRight className="w-3 h-3" /> +227 this month
              </p>
            </div>
            <div className="glass-light rounded-xl p-3">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Revenue Attributed</p>
              <p className="text-xl font-bold text-slate-900 mt-1">$48.2K</p>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                <ArrowUpRight className="w-3 h-3" /> +$8.4K this month
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Platform detail cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {(Object.keys(platformLabels) as Platform[]).map((p) => {
          const Icon = platformIcons[p];
          const data = engagementData.find((e) => e.platform.toLowerCase() === p);
          return (
            <div key={p} className="glass rounded-2xl p-4 hover:border-slate-200 transition-all hover:scale-[1.02]">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100/60 flex items-center justify-center">
                  {Icon && <Icon className="w-5 h-5 text-slate-700" />}
                </div>
                <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" />
                  {data?.engagement}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-900">{platformLabels[p]}</p>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div>
                  <p className="text-[9px] text-slate-500">Reach</p>
                  <p className="text-xs font-bold text-slate-800">{data?.reach}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-500">Likes</p>
                  <p className="text-xs font-bold text-slate-800">{Math.floor(Math.random() * 50 + 20)}K</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-500">Shares</p>
                  <p className="text-xs font-bold text-slate-800">{Math.floor(Math.random() * 10 + 2)}K</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryStat({
  icon: Icon,
  label,
  value,
  trend,
  accent,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
  trend: string;
  accent: string;
}) {
  return (
    <div className="relative glass rounded-2xl p-4 overflow-hidden">
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${accent}`}>
            <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5">
            <TrendingUp className="w-3 h-3" />
            {trend}
          </span>
        </div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-600 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function Bar({ value, color, delay }: { value: number; color: string; delay: number }) {
  return (
    <div
      className="w-2.5 sm:w-3.5 rounded-t-md transition-all duration-700 ease-out group-hover:opacity-100 opacity-80 hover:opacity-100 relative"
      style={{
        height: `${value}%`,
        backgroundColor: color,
        transitionDelay: `${delay}ms`,
      }}
    >
      <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-bold text-slate-900 whitespace-nowrap">
        {value}
      </div>
    </div>
  );
}
