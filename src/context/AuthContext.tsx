import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export interface AppUser {
  id: string;
  email: string;
}

export interface Workspace {
  id: string;
  name: string;
}

interface AuthContextValue {
  /** "demo": no database configured, data stays in this browser. "supabase": real accounts. */
  mode: "demo" | "supabase";
  /** False while the saved session / workspace is still being loaded. */
  ready: boolean;
  user: AppUser | null;
  workspace: Workspace | null;
  workspaceError: string | null;
  /** True after the user opened a password-reset link; they must choose a new password. */
  recovering: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: {
    email: string;
    password: string;
    workspaceName: string;
  }) => Promise<{ needsConfirmation: boolean }>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  retryWorkspace: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_USER: AppUser = { id: "demo-user", email: "demo@marketectify.com" };
const DEMO_WORKSPACE: Workspace = { id: "demo-workspace", name: "MarketKing Co." };

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email or password is incorrect.";
  if (m.includes("email not confirmed")) return "Please confirm your email first. Check your inbox.";
  if (m.includes("user already registered")) return "An account with this email already exists. Try signing in.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Can't reach the server. Check your internet connection.";
  return message;
}

async function loadWorkspace(client: SupabaseClient, fallbackName: string): Promise<Workspace> {
  const { data, error } = await client
    .from("workspaces")
    .select("id,name")
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw new Error(error.message);
  if (data && data.length > 0) return data[0] as Workspace;

  // A database trigger normally creates this at sign-up. Create it here if it is missing.
  const created = await client.from("workspaces").insert({ name: fallbackName }).select("id,name").single();
  if (created.error) throw new Error(created.error.message);
  return created.data as Workspace;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(!supabase);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [workspaceAttempt, setWorkspaceAttempt] = useState(0);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSessionLoaded(true);
    });

    // Keep this callback synchronous: calling Supabase from inside it can dead-lock.
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setSessionLoaded(true);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (event === "SIGNED_OUT") setRecovering(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;
  const userEmail = session?.user.email ?? "";

  useEffect(() => {
    if (!supabase) return;
    if (!userId) {
      setWorkspace(null);
      setWorkspaceError(null);
      return;
    }
    let active = true;
    setWorkspaceError(null);
    loadWorkspace(supabase, userEmail.split("@")[0] || "My workspace")
      .then((w) => active && setWorkspace(w))
      .catch((e: Error) => active && setWorkspaceError(e.message));
    return () => {
      active = false;
    };
  }, [userId, userEmail, workspaceAttempt]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(friendlyAuthError(error.message));
  }, []);

  const signUp = useCallback<AuthContextValue["signUp"]>(async ({ email, password, workspaceName }) => {
    if (!supabase) return { needsConfirmation: false };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { workspace_name: workspaceName },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw new Error(friendlyAuthError(error.message));
    // With email confirmation turned on there is no session until the link is clicked.
    return { needsConfirmation: !data.session };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw new Error(friendlyAuthError(error.message));
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw new Error(friendlyAuthError(error.message));
    setRecovering(false);
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setRecovering(false);
  }, []);

  const retryWorkspace = useCallback(() => setWorkspaceAttempt((n) => n + 1), []);

  const value = useMemo<AuthContextValue>(() => {
    if (!supabase) {
      return {
        mode: "demo",
        ready: true,
        user: DEMO_USER,
        workspace: DEMO_WORKSPACE,
        workspaceError: null,
        recovering: false,
        signIn,
        signUp,
        resetPassword,
        updatePassword,
        signOut,
        retryWorkspace,
      };
    }
    const user = session ? { id: session.user.id, email: session.user.email ?? "" } : null;
    return {
      mode: "supabase",
      ready: sessionLoaded && (!user || workspace !== null || workspaceError !== null),
      user,
      workspace,
      workspaceError,
      recovering,
      signIn,
      signUp,
      resetPassword,
      updatePassword,
      signOut,
      retryWorkspace,
    };
  }, [
    session,
    sessionLoaded,
    workspace,
    workspaceError,
    recovering,
    signIn,
    signUp,
    resetPassword,
    updatePassword,
    signOut,
    retryWorkspace,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
