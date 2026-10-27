import { Search, Bell, ChevronDown, Plus, Menu, Facebook, Instagram, Youtube } from "lucide-react";
import type { Platform } from "../types";
import type { Theme } from "../theme";
import ThemeToggle from "./ThemeToggle";

interface TopNavProps {
  onMenuClick: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

type IconType = React.ComponentType<{ className?: string }>;

const connectedAccounts: { platform: Platform; label: string; icon: IconType; connected: boolean }[] = [
  { platform: "facebook", label: "Facebook", icon: Facebook, connected: true },
  { platform: "instagram", label: "Instagram", icon: Instagram, connected: true },
  { platform: "tiktok", label: "TikTok", icon: TikTokIcon, connected: true },
  { platform: "youtube", label: "YouTube", icon: Youtube, connected: true },
];

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.73 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

export default function TopNav({ onMenuClick, theme, onToggleTheme }: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 glass border-b border-slate-200/80">
      {/* Main nav row */}
      <div className="flex items-center gap-3 px-4 lg:px-6 h-16">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-slate-100/60 transition-colors"
        >
          <Menu className="w-5 h-5 text-slate-700" />
        </button>

        {/* Search */}
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search posts, campaigns, analytics..."
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-slate-100/50 border border-slate-200/50 text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 lg:gap-3 ml-auto">
          {/* Upgrade button */}
          <button className="hidden sm:flex items-center gap-2 px-4 h-10 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 transition-all glow-blue hover:scale-[1.02] active:scale-95">
            <Plus className="w-4 h-4" />
            Upgrade System
          </button>

          {/* Dark / light theme switch */}
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />

          {/* Notifications */}
          <button className="relative p-2.5 rounded-xl hover:bg-slate-100/60 transition-colors group">
            <Bell className="w-5 h-5 text-slate-700 group-hover:text-slate-900" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-surface animate-pulse" />
          </button>

          {/* Profile switcher */}
          <button className="flex items-center gap-2.5 pl-2 pr-3 h-10 rounded-xl hover:bg-slate-100/60 transition-colors group">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
              MK
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-semibold text-slate-900 leading-tight">MarketKing Co.</p>
              <p className="text-[10px] text-slate-500">Pro Plan</p>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-600 group-hover:text-slate-900" />
          </button>
        </div>
      </div>

      {/* Connected accounts bar */}
      <div className="flex items-center gap-2 px-4 lg:px-6 py-2.5 border-t border-slate-200/60 overflow-x-auto scrollbar-thin">
        <span className="text-xs font-medium text-slate-500 shrink-0 mr-1">Connected:</span>
        {connectedAccounts.map((acc) => {
          const Icon = acc.icon;
          return (
            <div
              key={acc.platform}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100/40 border border-slate-200/40 shrink-0 hover:border-slate-300/60 transition-colors"
            >
              <Icon className="w-3.5 h-3.5 text-slate-700" />
              <span className="text-xs font-medium text-slate-700">{acc.label}</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">Connected</span>
              </span>
            </div>
          );
        })}
      </div>
    </header>
  );
}
