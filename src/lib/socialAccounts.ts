import { FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { AIError, readFunctionError } from "./ai";
import { ALL_PLATFORMS } from "./platforms";
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

const PLATFORMS: Platform[] = ALL_PLATFORMS;

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

// ---------------------------------------------------------------------------
// Facebook + Instagram (Meta)
// ---------------------------------------------------------------------------

async function metaError(error: unknown): Promise<AIError> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      const e = body?.error;
      if (e && typeof e.message === "string") return new AIError(String(e.code ?? "error"), e.message);
    } catch {
      /* fall through */
    }
    return new AIError("error", "The server returned an unexpected answer. Please try again.");
  }
  return new AIError("network", "Could not reach the server. Check your internet connection and try again.");
}

/** Asks the server for the Facebook login address (one login connects the Page and its Instagram account). */
export async function startMetaConnect(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.functions.invoke("meta-auth", { body: {}, timeout: 30_000 });
  if (error) throw await metaError(error);
  const url = (data as { url?: unknown } | null)?.url;
  if (typeof url !== "string" || !url.startsWith("https://www.facebook.com/")) {
    throw new AIError("error", "Unexpected answer from the server. Please try again.");
  }
  return url;
}

/** Asks the server for the LinkedIn sign-in address (personal profile posting). */
export async function startLinkedInConnect(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.functions.invoke("linkedin-auth", { body: {}, timeout: 30_000 });
  if (error) throw await metaError(error);
  const url = (data as { url?: unknown } | null)?.url;
  if (typeof url !== "string" || !url.startsWith("https://www.linkedin.com/")) {
    throw new AIError("error", "Unexpected answer from the server. Please try again.");
  }
  return url;
}

/** Asks the server for the Google sign-in address for Google Business Profile. */
export async function startGbpConnect(client: SupabaseClient): Promise<string> {
  const { data, error } = await client.functions.invoke("gbp-auth", { body: {}, timeout: 30_000 });
  if (error) throw await metaError(error);
  const url = (data as { url?: unknown } | null)?.url;
  if (typeof url !== "string" || !url.startsWith("https://accounts.google.com/")) {
    throw new AIError("error", "Unexpected answer from the server. Please try again.");
  }
  return url;
}

export interface PublishOutcome {
  platform: "facebook" | "instagram" | "linkedin" | "gbp";
  ok: boolean;
  message?: string;
}

/** Publishes an approved post to its Facebook / Instagram platforms right now. */
export async function publishPostNow(client: SupabaseClient, postId: string): Promise<{ outcomes: PublishOutcome[]; published: boolean }> {
  const { data, error } = await client.functions.invoke("meta-api", { body: { action: "publish", postId }, timeout: 120_000 });
  if (error) throw await metaError(error);
  const d = data as { outcomes?: unknown; published?: unknown } | null;
  return { outcomes: Array.isArray(d?.outcomes) ? (d!.outcomes as PublishOutcome[]) : [], published: d?.published === true };
}

/** Pulls new comments from Facebook and Instagram into the Inbox. */
export async function syncMetaComments(client: SupabaseClient): Promise<{ imported: number; problems: string[] }> {
  const { data, error } = await client.functions.invoke("meta-api", { body: { action: "sync" }, timeout: 60_000 });
  if (error) throw await metaError(error);
  const d = data as { imported?: unknown; problems?: unknown } | null;
  return {
    imported: typeof d?.imported === "number" ? d.imported : 0,
    problems: Array.isArray(d?.problems) ? d!.problems.filter((x): x is string => typeof x === "string") : [],
  };
}

/** Sends a reply to a comment on Facebook / Instagram and marks the message as replied. */
export async function replyOnPlatform(client: SupabaseClient, messageId: string, text: string): Promise<void> {
  const { error } = await client.functions.invoke("meta-api", { body: { action: "reply", messageId, text }, timeout: 30_000 });
  if (error) throw await metaError(error);
}

const META_ERRORS: Record<string, string> = {
  denied: "You cancelled the Facebook connection.",
  bad_state: "The connection link expired. Please press Connect again.",
  token_failed: "Facebook did not accept the sign-in. Press Connect and try again.",
  pages_failed: "Facebook did not let the app read your Pages. When Facebook asks, choose your Pages and allow every permission.",
  no_page: "No Facebook Page was found. Create a Page (or choose your Page in the Facebook window) and connect again.",
  meta_unreachable: "Could not reach Facebook. Please try again.",
  save_failed: "Connected, but saving failed. Has the 0011_meta.sql database setup been run?",
  not_configured: "Facebook and Instagram are not set up on the server yet (missing Meta secrets).",
};

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

const GBP_ERRORS: Record<string, string> = {
  denied: "You cancelled the Google Business connection.",
  bad_state: "The connection link expired. Please press Connect again.",
  token_failed: "Google did not accept the sign-in. Press Connect and try again.",
  api_access: "Google refused access to Business Profile. Your Google Cloud project needs approved Business Profile API access (see docs/SETUP.md, step 14).",
  no_location: "No business location was found for this Google account. Use the Google account that manages your Business Profile.",
  google_unreachable: "Could not reach Google. Please try again.",
  save_failed: "Connected, but saving failed. Has the 0012_more_platforms.sql database setup been run?",
  not_configured: "Google Business is not set up on the server yet (missing Google secrets).",
};

const LINKEDIN_ERRORS: Record<string, string> = {
  denied: "You cancelled the LinkedIn connection.",
  bad_state: "The connection link expired. Please press Connect again.",
  token_failed: "LinkedIn did not accept the sign-in. Press Connect and try again.",
  profile_failed: "LinkedIn did not share your profile. Check that \"Sign In with LinkedIn using OpenID Connect\" is added to the app.",
  linkedin_unreachable: "Could not reach LinkedIn. Please try again.",
  save_failed: "Connected, but saving failed. Has the 0012_more_platforms.sql database setup been run?",
  not_configured: "LinkedIn is not set up on the server yet (missing LinkedIn secrets).",
};

export function connectErrorMessage(code: string, provider: "youtube" | "meta" | "linkedin" | "gbp" = "youtube"): string {
  if (provider === "gbp") return GBP_ERRORS[code] ?? "Could not connect Google Business. Please try again.";
  if (provider === "linkedin") return LINKEDIN_ERRORS[code] ?? "Could not connect LinkedIn. Please try again.";
  if (provider === "meta") return META_ERRORS[code] ?? "Could not connect Facebook. Please try again.";
  return CONNECT_ERRORS[code] ?? "Could not connect YouTube. Please try again.";
}

export function formatCount(n: number | null): string {
  if (n === null) return "hidden";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}K`;
  return String(n);
}
