import {
  LayoutDashboard,
  Sparkles,
  CalendarClock,
  Inbox,
  BarChart3,
  Zap,
} from "lucide-react";
import type { TabId } from "../types";

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  mobileOpen: boolean;
  onClose: () => void;
}

const navItems: { id: TabId; label: string; icon: typeof LayoutDashboard; description: string }[] = [
  { id: "overview", label: "Overview Dashboard", icon: LayoutDashboard, description: "Key metrics & quick actions" },
  { id: "studio", label: "AI Content Studio", icon: Sparkles, description: "Generate captions, reels & visuals" },
  { id: "calendar", label: "Calendar & Approvals", icon: CalendarClock, description: "Schedule & approve content" },
  { id: "inbox", label: "Unified Inbox", icon: Inbox, description: "AI auto-responder for DMs" },
  { id: "analytics", label: "Analytics & Leads", icon: BarChart3, description: "Performance & lead reports" },
];

export default function Sidebar({ activeTab, onTabChange, mobileOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-72 shrink-0 glass border-r border-slate-800/80 transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="px-6 py-5 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center glow-purple">
                <Zap className="w-5 h-5 text-white" fill="white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white leading-tight">Marketectify</h1>
                <p className="text-[10px] text-violet-400 font-medium tracking-wider uppercase">AI Social Agent</p>
              </div>
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    onClose();
                  }}
                  className={`w-full group flex items-start gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left ${
                    active
                      ? "bg-gradient-to-r from-violet-500/20 to-indigo-500/10 border border-violet-500/30 glow-purple"
                      : "hover:bg-slate-800/50 border border-transparent"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 mt-0.5 shrink-0 transition-colors ${
                      active ? "text-violet-400" : "text-slate-400 group-hover:text-slate-200"
                    }`}
                  />
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-semibold leading-tight ${
                        active ? "text-white" : "text-slate-300 group-hover:text-white"
                      }`}
                    >
                      {item.label}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{item.description}</p>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Bottom card */}
          <div className="p-4">
            <div className="glass-light rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-medium text-slate-300">AI Engine Online</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>GPT-4o · Gemini Pro</span>
                <span className="text-emerald-400 font-medium">Active</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-violet-500 to-indigo-500" />
              </div>
              <p className="text-[10px] text-slate-500">Monthly AI credits: 7,800 / 10,000</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
