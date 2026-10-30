import type { SupabaseClient } from "@supabase/supabase-js";
import { AIError, readFunctionError } from "./ai";
import type { Platform } from "../types";

export interface SocialAccount {
  id: string;
  platform: Platform;
  displayName: string;
  handle: string;
  avatarUrl: string;
  subscribers: number | null;
  videoCount: number;
  viewCount: number;
  statsUpdatedAt: string | null;
}

/** Only harmless columns. The login tokens are never readable from the browser (see 0005_social_accounts.sql). */
const COLUMNS = "id,platform,display_name,handle,avatar_url,subscribers,video_count,view_count,stats_updated_at";

interface Row {
  id: string;
  platform: string;
  display_name: string;
  handle: string;
  avatar_url: string;
  subscribers: number | null;
  video_count: number;
  view_count: number;
  stats_updated_at: string | null;
}

const PLATFORMS: Platform[] = ["facebook", "instagram", "tiktok", "youtube"];

export function fromRow(r: Row): SocialAccount {
  return {
    id: r.id,
    platform: PLATFORMS.includes(r.platform as Platform) ? (r.platform as Platform) : "youtube",
    displayName: r.display_name,
    handle: r.handle ?? "",
    avatarUrl: typeof r.avatar_url === "string" && r.avatar_url.startsWith("https://") ? r.avatar_url : "",
    subscribers: r.subscribers === null || r.subscribers === undefined ? null : Number(r.subscribers),
    videoCount: Number(r.video_count) || 0,
    viewCount: Number(r.view_count) || 0,
    statsUpdatedAt: r.stats_updated_at,
  };
}

export async function listAccounts(client: SupabaseClient, workspaceId: string): Promise<SocialAccount[]> {
  const { data, error } = await client.from("social_accounts").select(COLUMNS).eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);
  return (data as Row[]).map(fromRow);
}

export async function removeAccount(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("social_accounts").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Asks the server for the Google consent page address. */
export async function startYouTubeConnect(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.functions.invoke("youtube-auth", { body: {}, timeout: 30_000 });
  if (error) throw await readFunctionError(error);
  const url = (data as { url?: unknown } | null)?.url;
  if (typeof url !== "string" || !url.startsWith("https://accounts.google.com/")) {
    throw new AIError("error", "Unexpected answer from the server. Please try again.");
  }
  return url;
}

export async function refreshYouTube(client: SupabaseClient): Promise<void> {
  const { error } = await client.functions.invoke("youtube-refresh", { body: {}, timeout: 30_000 });
  if (error) throw await readFunctionError(error);
}

const CONNECT_ERRORS: Record<string, string> = {
  denied: "You cancelled the YouTube connection.",
  bad_state: "The connection link expired. Please press Connect again.",
  token_failed: "Google did not accept the sign-in. Press Connect and try again.",
  google_unreachable: "Could not reach Google. Please try again.",
  api_disabled: "YouTube Data API v3 is not enabled in your Google Cloud project, or your Google account is not added as a test user.",
  no_channel: "This Google account has no YouTube channel. Create a channel first, then connect again.",
  save_failed: "Connected, but saving failed. Has the 0005_social_accounts.sql database setup been run?",
  not_configured: "YouTube is not set up on the server yet (missing Google secrets).",
};

export function connectErrorMessage(code: string): string {
  return CONNECT_ERRORS[code] ?? "Could not connect YouTube. Please try again.";
}

export function formatCount(n: number | null): string {
  if (n === null) return "hidden";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return String(n);
}
