// Deno wiring for the Google Business functions (not unit tested: it only connects the tested logic to Google and Supabase).
// Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (same as YouTube), OAUTH_STATE_SECRET, SITE_URL.
// The Google OAuth client must also list this redirect URI: https://<project>.supabase.co/functions/v1/gbp-callback

import { createClient } from "npm:@supabase/supabase-js@2";
import type { GbpDeps, GbpHttpRequest, GbpHttpResult } from "./gbp.ts";

const env = (name: string) => Deno.env.get(name) ?? "";

/** One call to Google. Errors are replaced by a plain message because their text can contain the full address. */
export async function gbpHttp(req: GbpHttpRequest): Promise<GbpHttpResult> {
  try {
    const headers: Record<string, string> = { ...(req.headers ?? {}) };
    let body: BodyInit | undefined;
    if (req.form) {
      headers["content-type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams(req.form);
    } else if (req.json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(req.json);
    }
    const res = await fetch(req.url, { method: req.method, headers, body, signal: AbortSignal.timeout(30_000) });
    return { status: res.status, body: await res.json().catch(() => null), headers: {} };
  } catch {
    throw new Error("Could not reach Google.");
  }
}

export const gbpClientId = () => env("GOOGLE_CLIENT_ID");
export const gbpClientSecret = () => env("GOOGLE_CLIENT_SECRET");

export function makeGbpDeps(): GbpDeps {
  const supabaseUrl = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const clientId = gbpClientId();
  const clientSecret = gbpClientSecret();
  const stateSecret = env("OAUTH_STATE_SECRET");

  const userClient = (authorization: string) =>
    createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  const admin = () => createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  return {
    configured: Boolean(clientId && clientSecret && stateSecret && supabaseUrl && serviceKey),
    siteUrl: env("SITE_URL") || "https://social-ai.marketectify.com",
    clientId,
    clientSecret,
    stateSecret,
    redirectUri: `${supabaseUrl}/functions/v1/gbp-callback`,
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

    http: gbpHttp,

    async saveAccount(workspaceId, row) {
      const now = new Date().toISOString();
      const { error } = await admin().from("social_accounts").upsert(
        {
          workspace_id: workspaceId,
          platform: "gbp",
          external_id: row.externalId,
          display_name: row.displayName,
          handle: "",
          avatar_url: "",
          subscribers: null,
          video_count: 0,
          view_count: 0,
          stats_updated_at: now,
          access_token: row.accessToken,
          refresh_token: row.refreshToken,
          token_expires_at: row.expiresAt,
          scopes: "business.manage",
          connected_at: now,
        },
        { onConflict: "workspace_id,platform" },
      );
      if (error) throw new Error(error.message);
    },

    log: (message) => console.error(message),
  };
}
