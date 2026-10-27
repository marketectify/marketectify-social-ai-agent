import { useState } from "react";
import type { TabId } from "./types";
import Sidebar from "./components/Sidebar";
import TopNav from "./components/TopNav";
import Overview from "./components/Overview";
import Studio from "./components/Studio";
import Calendar from "./components/Calendar";
import Inbox from "./components/Inbox";
import Analytics from "./components/Analytics";
import { useTheme } from "./theme";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Ambient background glows (dark theme only; light theme stays flat) */}
      <div className="hidden dark:block fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-sky-600/10 rounded-full blur-[120px]" />
      </div>

      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        mobileOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col relative">
        <TopNav onMenuClick={() => setMobileSidebarOpen(true)} theme={theme} onToggleTheme={toggleTheme} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {activeTab === "overview" && <Overview onNavigate={setActiveTab} />}
          {activeTab === "studio" && <Studio />}
          {activeTab === "calendar" && <Calendar />}
          {activeTab === "inbox" && <Inbox />}
          {activeTab === "analytics" && <Analytics />}
        </main>
      </div>
    </div>
  );
}
