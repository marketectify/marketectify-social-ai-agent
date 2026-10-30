import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { TabId } from "./types";
import Sidebar from "./components/Sidebar";
import TopNav from "./components/TopNav";
import Overview from "./components/Overview";
import Studio from "./components/Studio";
import Calendar from "./components/Calendar";
import Inbox from "./components/Inbox";
import Analytics from "./components/Analytics";
import Login, { SetNewPassword } from "./components/Login";
import { useTheme, type Theme } from "./theme";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { PostsProvider } from "./context/PostsContext";
import { MessagesProvider } from "./context/MessagesContext";
import { SocialAccountsProvider, useSocialAccounts } from "./context/SocialAccountsContext";
import { useToast } from "./context/ToastContext";
import { connectErrorMessage } from "./lib/socialAccounts";
import { ToastProvider } from "./context/ToastContext";
import { supabase } from "./lib/supabase";
import { createLocalPostsRepo, createSupabasePostsRepo, type PostsRepo } from "./lib/postsRepo";
import { createLocalMessagesRepo, createSupabaseMessagesRepo, type MessagesRepo } from "./lib/messagesRepo";

interface ThemeProps {
  theme: Theme;
  onToggleTheme: () => void;
}

function Splash() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center" role="status" aria-label="Loading">
      <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
    </div>
  );
}

function Dashboard({ theme, onToggleTheme }: ThemeProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { mode } = useAuth();
  const toast = useToast();
  const social = useSocialAccounts();
  const { reload: reloadAccounts, refresh: refreshAccounts } = social;

  // Google sends the browser back with ?connected=youtube or ?connect_error=... . Show the result and tidy the address.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const problem = params.get("connect_error");
    if (!connected && !problem) return;
    window.history.replaceState(null, "", window.location.pathname);
    if (problem) {
      toast.error(connectErrorMessage(problem));
      return;
    }
    toast.success("YouTube connected");
    void reloadAccounts();
  }, [toast, reloadAccounts]);

  // Keep channel numbers fresh (once per visit).
  useEffect(() => {
    if (mode !== "supabase") return;
    void refreshAccounts();
  }, [mode, refreshAccounts]);

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
        <TopNav onMenuClick={() => setMobileSidebarOpen(true)} theme={theme} onToggleTheme={onToggleTheme} />

        {mode === "demo" && (
          <div className="px-4 lg:px-6 py-2 text-xs text-amber-900 dark:text-amber-300 bg-amber-500/10 border-b border-amber-500/30">
            <strong className="font-semibold">Demo mode.</strong> Your posts are saved in this browser only. Connect
            the database to enable accounts and sync.
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
          {activeTab === "overview" && <Overview onNavigate={setActiveTab} />}
          {/* Kept mounted (just hidden) so generated results survive tab switches. */}
          <div hidden={activeTab !== "studio"}>
            <Studio />
          </div>
          {activeTab === "calendar" && <Calendar />}
          {activeTab === "inbox" && <Inbox />}
          {activeTab === "analytics" && <Analytics />}
        </main>
      </div>
    </div>
  );
}

function Gate({ theme, onToggleTheme }: ThemeProps) {
  const { mode, ready, user, workspace, workspaceError, recovering, retryWorkspace, signOut } = useAuth();

  const repo = useMemo<PostsRepo | null>(() => {
    if (mode === "demo") {
      let storage: Storage | null = null;
      try {
        storage = window.localStorage;
      } catch {
        storage = null; // blocked (private mode): keep data in memory only
      }
      return createLocalPostsRepo(storage);
    }
    return supabase && workspace ? createSupabasePostsRepo(supabase, workspace.id) : null;
  }, [mode, workspace]);

  const messagesRepo = useMemo<MessagesRepo | null>(() => {
    if (mode === "demo") {
      let storage: Storage | null = null;
      try {
        storage = window.localStorage;
      } catch {
        storage = null;
      }
      return createLocalMessagesRepo(storage);
    }
    return supabase && workspace ? createSupabaseMessagesRepo(supabase, workspace.id) : null;
  }, [mode, workspace]);

  if (!ready) return <Splash />;
  if (!user) return <Login theme={theme} onToggleTheme={onToggleTheme} />;
  if (recovering) return <SetNewPassword theme={theme} onToggleTheme={onToggleTheme} />;

  if (workspaceError || !repo || !messagesRepo) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-6 max-w-md text-center space-y-4" role="alert">
          <h1 className="text-lg font-bold text-slate-900">We couldn't load your workspace</h1>
          <p className="text-sm text-slate-600">
            {workspaceError ?? "Something went wrong."} If you just set up the database, make sure the SQL setup
            script has been run.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={retryWorkspace}
              className="h-10 px-4 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Try again
            </button>
            <button
              onClick={() => void signOut()}
              className="h-10 px-4 rounded-xl border border-slate-200 text-sm font-medium hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    // `key` makes sure nothing from a previous account leaks into the next one.
    <PostsProvider key={user.id + (workspace?.id ?? "")} repo={repo}>
      <MessagesProvider repo={messagesRepo}>
        <SocialAccountsProvider>
          <Dashboard theme={theme} onToggleTheme={onToggleTheme} />
        </SocialAccountsProvider>
      </MessagesProvider>
    </PostsProvider>
  );
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  return (
    <ToastProvider>
      <AuthProvider>
        <Gate theme={theme} onToggleTheme={toggleTheme} />
      </AuthProvider>
    </ToastProvider>
  );
}
