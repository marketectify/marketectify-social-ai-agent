import { useEffect, useRef, useState } from "react";
import { Search, Bell, ChevronDown, Plus, Menu, LogOut, Info } from "lucide-react";
import type { Platform } from "../types";
import type { Theme } from "../theme";
import ThemeToggle from "./ThemeToggle";
import { platformIcons } from "./PlatformIcon";
import { platformLabels } from "../data";
import { useAuth } from "../context/AuthContext";
import { usePlan } from "../context/PlanContext";

interface TopNavProps {
  onMenuClick: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

const platforms: Platform[] = ["facebook", "instagram", "tiktok", "youtube"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0]).toUpperCase();
}

export default function TopNav({ onMenuClick, theme, onToggleTheme }: TopNavProps) {
  const { mode, user, workspace, signOut } = useAuth();
  const { isPro, showUpgrade } = usePlan();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isDemo = mode === "demo";
  const name = workspace?.name ?? "Workspace";

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 glass border-b border-slate-200/80">
      {/* Main nav row */}
      <div className="flex items-center gap-3 px-4 lg:px-6 h-16">
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="lg:hidden p-2 rounded-lg hover:bg-slate-100/60 transition-colors"
        >
          <Menu className="w-5 h-5 text-slate-700" />
        </button>

        {/* Search */}
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            aria-label="Search"
            placeholder="Search posts, campaigns, analytics..."
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-slate-100/50 border border-slate-200/50 text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 lg:gap-3 ml-auto">
          {/* Upgrade button */}
          <button
            onClick={() => showUpgrade()}
            className="hidden sm:flex items-center gap-2 px-4 h-10 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 transition-all glow-blue hover:scale-[1.02] active:scale-95"
          >
            <Plus className="w-4 h-4" />
            {isPro ? "Pro plan" : "Upgrade"}
          </button>

          {/* Dark / light theme switch */}
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />

          {/* Notifications */}
          <button aria-label="Notifications" className="relative p-2.5 rounded-xl hover:bg-slate-100/60 transition-colors group">
            <Bell className="w-5 h-5 text-slate-700 group-hover:text-slate-900" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-surface animate-pulse" />
          </button>

          {/* Account menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2.5 pl-2 pr-3 h-10 rounded-xl hover:bg-slate-100/60 transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">
                {initials(name)}
              </div>
              <div className="hidden md:block text-left max-w-[10rem]">
                <p className="text-sm font-semibold text-slate-900 leading-tight truncate">{name}</p>
                <p className="text-[10px] text-slate-500 truncate">{isDemo ? "Demo mode" : user?.email}</p>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-600 group-hover:text-slate-900" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 glass rounded-xl p-2 shadow-lg animate-fade-in"
              >
                <div className="px-3 py-2 border-b border-slate-200 mb-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">{name}</p>
                  <p className="text-xs text-slate-500 truncate">{isDemo ? "demo@marketectify.com" : user?.email}</p>
                </div>
                {isDemo ? (
                  <p className="flex items-start gap-2 px-3 py-2 text-xs text-slate-600">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    Demo mode: your changes are saved in this browser only. Connect the database to enable accounts.
                  </p>
                ) : (
                  <button
                    role="menuitem"
                    onClick={() => void signOut()}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-800 hover:bg-slate-100 transition-colors"
                  >
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Platform accounts bar */}
      <div className="flex items-center gap-2 px-4 lg:px-6 py-2.5 border-t border-slate-200/60 overflow-x-auto scrollbar-thin">
        <span className="text-xs font-medium text-slate-500 shrink-0 mr-1">{isDemo ? "Connected:" : "Accounts:"}</span>
        {platforms.map((p) => {
          const Icon = platformIcons[p];
          return (
            <div
              key={p}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100/40 border border-slate-200/40 shrink-0"
            >
              <Icon className="w-3.5 h-3.5 text-slate-700" />
              <span className="text-xs font-medium text-slate-700">{platformLabels[p]}</span>
              {isDemo ? (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">Connected</span>
                </span>
              ) : (
                <span className="text-[10px] text-slate-500 font-medium" title="Account connections arrive in an upcoming update">
                  Not connected
                </span>
              )}
            </div>
          );
        })}
      </div>
    </header>
  );
}
