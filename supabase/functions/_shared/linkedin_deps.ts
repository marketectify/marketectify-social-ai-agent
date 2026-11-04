// Deno wiring for the LinkedIn functions (not unit tested: it only connects the tested logic to LinkedIn and Supabase).
// Secrets (Supabase dashboard -> Edge Functions -> Secrets):
//   LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET   from developer.linkedin.com -> your app -> Auth
//   OAUTH_STATE_SECRET                           same long random text as for YouTube
//   SITE_URL                                     https://social-ai.marketectify.com
//   LINKEDIN_API_VERSION                         optional, a month like 202610 (default in linkedin.ts)
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.

import { createClient } from "npm:@supabase/supabase-js@2";
import { DEFAULT_LI_VERSION, LI_IMAGE_MAX_BYTES, isOwnMediaUrl, type LiDeps, type LiHttpRequest, type LiHttpResult } from "./linkedin.ts";

const env = (name: string) => Deno.env.get(name) ?? "";

/** One call to LinkedIn. Errors are replaced by a plain message because their text can contain the full address. */
export async function liHttp(req: LiHttpRequest): Promise<LiHttpResult> {
  try {
    const headers: Record<string, string> = { ...(req.headers ?? {}) };
    let body: BodyInit | undefined;
    if (req.form) {
      headers["content-type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams(req.form);
    } else if (req.json !== undefined) {
      body = JSON.stringify(req.json);
    } else if (req.bytes) {
      body = req.bytes;
    }
    const res = await fetch(req.url, { method: req.method, headers, body, signal: AbortSignal.timeout(30_000) });
    const out: Record<string, string> = {};
    res.headers.forEach((v, k) => (out[k.toLowerCase()] = v));
    return { status: res.status, body: await res.json().catch(() => null), headers: out };
  } catch {
    throw new Error("Could not reach LinkedIn.");
  }
}

/** Downloads one of our own public pictures (never any other address, so this cannot be pointed at someone else's server). */
export async function liFetchMedia(url: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  if (!isOwnMediaUrl(url, env("SUPABASE_URL"))) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: "error" });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return bytes.length > 0 && bytes.length <= LI_IMAGE_MAX_BYTES ? { bytes, type } : null;
  } catch {
    return null;
  }
}

export const linkedInVersion = () => env("LINKEDIN_API_VERSION") || DEFAULT_LI_VERSION;

export function makeLinkedInDeps(): LiDeps {
  const supabaseUrl = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const clientId = env("LINKEDIN_CLIENT_ID");
  const clientSecret = env("LINKEDIN_CLIENT_SECRET");
  const stateSecret = env("OAUTH_STATE_SECRET");
  const siteUrl = env("SITE_URL") || "https://social-ai.marketectify.com";

  const userClient = (authorization: string) =>
    createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  const admin = () => createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  return {
    configured: Boolean(clientId && clientSecret && stateSecret && supabaseUrl && serviceKey),
    siteUrl,
    clientId,
    clientSecret,
    stateSecret,
    redirectUri: `${supabaseUrl}/functions/v1/linkedin-callback`,
    apiVersion: linkedInVersion(),
    now: () => Date.now(),

    async getUser(authorization) {
      if (!authorization) return null;
      const token = authorization.replace(/^Bearer\s+/i, "");
      const { data, error } = await userClient(authorization).auth.getUser(token);
      return error || !data.user ? null : { id: data.user.id };
    },

    async getWorkspaceId(authorization) {
      const { data, error } = await userClient(authorization).from("workspaces").select("id").order("created_at", { ascending: true }).limit(1);
      if (error) throw new Error(error.message);
      return data?.[0]?.id ?? null;
    },

    http: liHttp,
    fetchMedia: liFetchMedia,

    async saveAccount(workspaceId, row) {
      const now = new Date().toISOString();
      const { error } = await admin().from("social_accounts").upsert(
        {
          workspace_id: workspaceId,
          platform: "linkedin",
          external_id: row.externalId,
          display_name: row.displayName,
          handle: "",
          avatar_url: row.avatarUrl,
          subscribers: null,
          video_count: 0,
          view_count: 0,
          stats_updated_at: now,
          access_token: row.token,
          refresh_token: null,
          token_expires_at: row.expiresAt,
          scopes: "openid profile w_member_social",
          connected_at: now,
        },
        { onConflict: "workspace_id,platform" },
      );
      if (error) throw new Error(error.message);
    },

    log: (message) => console.error(message),
  };
}
