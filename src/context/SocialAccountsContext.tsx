import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { AIError } from "../lib/ai";
import { listAccounts, refreshYouTube, removeAccount, startYouTubeConnect, type SocialAccount } from "../lib/socialAccounts";
import type { Platform } from "../types";

interface Value {
  accounts: SocialAccount[];
  loading: boolean;
  /** Platforms that can be connected right now. */
  connectable: Platform[];
  get: (platform: Platform) => SocialAccount | undefined;
  connect: (platform: Platform) => Promise<void>;
  disconnect: (id: string) => Promise<void>;
  /** Re-reads channel numbers from the platform, then reloads. Resolves false if a reconnect is needed. */
  refresh: () => Promise<{ ok: boolean; message?: string }>;
  reload: () => Promise<void>;
}

const Ctx = createContext<Value | null>(null);

export function SocialAccountsProvider({ children }: { children: ReactNode }) {
  const { mode, workspace } = useAuth();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(mode === "supabase");
  const workspaceId = workspace?.id;

  const reload = useCallback(async () => {
    if (!supabase || !workspaceId) return;
    try {
      setAccounts(await listAccounts(supabase, workspaceId));
    } catch {
      // The table may not exist yet (database step not run). The bar then simply shows "Connect".
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const connect = useCallback(async (platform: Platform) => {
    if (!supabase) throw new AIError("demo_mode", "Connecting accounts needs a signed-in account (not available in demo mode).");
    if (platform !== "youtube") throw new AIError("not_available", "This platform is not available yet.");
    window.location.assign(await startYouTubeConnect(supabase));
  }, []);

  const disconnect = useCallback(
    async (id: string) => {
      if (!supabase) return;
      await removeAccount(supabase, id);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (!supabase) return { ok: false };
    try {
      await refreshYouTube(supabase);
      await reload();
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Could not refresh." };
    }
  }, [reload]);

  const value = useMemo<Value>(
    () => ({
      accounts,
      loading,
      connectable: mode === "supabase" ? ["youtube"] : [],
      get: (p) => accounts.find((a) => a.platform === p),
      connect,
      disconnect,
      refresh,
      reload,
    }),
    [accounts, loading, mode, connect, disconnect, refresh, reload],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSocialAccounts(): Value {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSocialAccounts must be used inside <SocialAccountsProvider>");
  return ctx;
}
