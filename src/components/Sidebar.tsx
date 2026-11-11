import { useEffect, useState } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  Sparkles,
  CalendarClock,
  Inbox,
  BarChart3,
  Zap,
  Palette,
  CreditCard,
  Plug,
  History,
  ShieldCheck,
} from "lucide-react";
import type { TabId } from "../types";
import { usePlan } from "../context/PlanContext";

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  mobileOpen: boolean;
  onClose: () => void;
}

type NavItem = { id: TabId; label: string; icon: typeof LayoutDashboard; description: string };

/** Groups are separated by a thin line, so the menu reads as: overview, create, publish, engage, settings. */
const navGroups: NavItem[][] = [
  [{ id: "overview", label: "Dashboard", icon: LayoutDashboard, description: "What needs you today" }],
  [
    { id: "studio", label: "AI Content Studio", icon: Sparkles, description: "Generate captions, reels & visuals" },
    { id: "design", label: "Design Studio", icon: Palette, description: "Drag & drop post designer" },
  ],
  [
    { id: "calendar", label: "Calendar & Approvals", icon: CalendarClock, description: "Schedule & approve content" },
    { id: "history", label: "Post History", icon: History, description: "What went out, when and where" },
  ],
  [
    { id: "inbox", label: "Unified Inbox", icon: Inbox, description: "Comments, DMs & AI replies" },
    { id: "analytics", label: "Analytics & Leads", icon: BarChart3, description: "Performance & lead reports" },
  ],
  [
    { id: "accounts", label: "Accounts", icon: Plug, description: "Connect your social accounts" },
    { id: "plan", label: "Plan & Billing", icon: CreditCard, description: "Free or Pro, upgrade" },
  ],
];

const adminItem: NavItem = { id: "admin", label: "Admin", icon: ShieldCheck, description: "Upgrade requests & plans" };

const COLLAPSE_KEY = "marketectify.sidebar.collapsed";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

// The sidebar is always dark, in the light and the dark theme, so it uses fixed colors instead of the theme-flipping slate scale.
export default function Sidebar({ activeTab, onTabChange, mobileOpen, onClose }: SidebarProps) {
  const { isAdmin } = usePlan();
  const groups = isAdmin ? [...navGroups.slice(0, -1), [...navGroups[navGroups.length - 1], adminItem]] : navGroups;
  const [collapsed, setCollapsed] = useState(readCollapsed);
  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* blocked storage: the choice just lasts until the page is closed */
    }
  }, [collapsed]);
  // The slim version only exists on large screens. The phone drawer is always the full menu.
  const slim = collapsed;

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm" onClick={onClose} />}

      <aside
        aria-label="Main menu"
        className={`fixed lg:sticky top-7 left-0 z-50 h-[calc(100vh-1.75rem)] w-72 ${slim ? "lg:w-[4.75rem]" : "lg:w-72"} shrink-0 bg-[#0b1324] text-[#aab6cc] border-r border-white/10 transition-[transform,width] duration-300 ease-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className={`flex items-center gap-3 border-b border-white/10 py-5 ${slim ? "lg:justify-center lg:px-0 px-5" : "px-5"}`}>
            <div className="w-10 h-10 shrink-0 rounded-xl bg-blue-600 flex items-center justify-center shadow-[0_6px_18px_rgba(37,99,235,0.45)]">
              <Zap className="w-5 h-5 text-white" fill="white" aria-hidden="true" />
            </div>
            <div className={`min-w-0 ${slim ? "lg:hidden" : ""}`}>
              <h1 className="text-lg font-bold text-white leading-tight">Marketectify</h1>
              <p className="text-xs text-sky-300/90 font-medium">AI social agent</p>
            </div>
          </div>

          {/* Nav items */}
          <nav aria-label="Pages" className="flex-1 px-3 py-3 overflow-y-auto overflow-x-hidden scrollbar-thin">
            {groups.map((group, gi) => (
              <ul key={gi} className={`space-y-1 ${gi > 0 ? "mt-2 pt-2 border-t border-white/10" : ""}`}>
                {group.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onTabChange(item.id);
                          onClose();
                        }}
                        title={slim ? item.label : item.description}
                        aria-label={item.label}
                        aria-current={active ? "page" : undefined}
                        className={`relative w-full group flex items-center gap-3 h-11 rounded-xl text-left transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${
                          slim ? "lg:justify-center lg:px-0 px-3" : "px-3"
                        } ${active ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"}`}
                      >
                        {active && <span aria-hidden="true" className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full bg-sky-400" />}
                        <Icon className={`w-5 h-5 shrink-0 transition-transform duration-150 group-hover:scale-110 ${active ? "text-sky-300" : "text-[#8493ad] group-hover:text-sky-200"}`} aria-hidden="true" />
                        <span className={`text-sm leading-tight truncate ${active ? "font-semibold" : "font-medium"} ${slim ? "lg:hidden" : ""}`}>{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ))}
          </nav>

          {/* Bottom: small note (full menu only) and the collapse button (large screens only) */}
          <div className="p-3 border-t border-white/10 space-y-2">
            <div className={`px-2 pt-1 ${slim ? "lg:hidden" : ""}`}>
              <p className="text-xs font-medium text-[#c3cde0]">AI powered by Google Gemini</p>
              <p className="text-[11px] text-[#7f8ca6] mt-0.5">
                <a href="/privacy.html" target="_blank" rel="noreferrer" className="underline hover:text-white">Privacy</a>
                {" · "}
                <a href="/terms.html" target="_blank" rel="noreferrer" className="underline hover:text-white">Terms</a>
                {" · "}
                <a href="/data-deletion.html" target="_blank" rel="noreferrer" className="underline hover:text-white">Delete my data</a>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-expanded={!slim}
              aria-label={slim ? "Expand menu" : "Collapse menu"}
              title={slim ? "Expand menu" : "Collapse menu"}
              className={`hidden lg:flex w-full items-center gap-3 h-10 rounded-xl text-[#8493ad] hover:bg-white/5 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 ${
                slim ? "justify-center px-0" : "px-3"
              }`}
            >
              {slim ? <PanelLeftOpen className="w-5 h-5" aria-hidden="true" /> : <PanelLeftClose className="w-5 h-5" aria-hidden="true" />}
              {!slim && <span className="text-sm font-medium">Collapse menu</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
