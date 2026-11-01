// Deno wiring for the YouTube functions (not unit tested: it only connects the tested logic to Google and Supabase).
// Secrets (Supabase dashboard -> Edge Functions -> Secrets):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET   from Google Cloud -> Credentials -> OAuth client
//   OAUTH_STATE_SECRET                       any long random text (signs the sign-in state)
//   SITE_URL                                 https://social-ai.marketectify.com
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.
// The service role key stays inside these functions. The browser never sees tokens.

import { createClient } from "npm:@supabase/supabase-js@2";
import type { YtDeps } from "./youtube.ts";

const env = (name: string) => Deno.env.get(name) ?? "";

export function makeDeps(): YtDeps {
  const supabaseUrl = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const clientId = env("GOOGLE_CLIENT_ID");
  const clientSecret = env("GOOGLE_CLIENT_SECRET");
  const stateSecret = env("OAUTH_STATE_SECRET");
  const siteUrl = env("SITE_URL") || "https://social-ai.marketectify.com";
  const redirectUri = `${supabaseUrl}/functions/v1/youtube-callback`;

  const userClient = (authorization: string) =>
    createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  const admin = () => createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  async function tokenRequest(params: Record<string, string>) {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, body: body as Record<string, any> };
  }

  return {
    configured: Boolean(clientId && clientSecret && stateSecret && supabaseUrl && serviceKey),
    siteUrl,
    clientId,
    stateSecret,
    redirectUri,
    now: () => Date.now(),

    async getUser(authorization) {
      if (!authorization) return null;
      const token = authorization.replace(/^Bearer\s+/i, "");
      const { data, error } = await userClient(authorization).auth.getUser(token);
      return error || !data.user ? null : { id: data.user.id };
    },

    async getWorkspaceId(authorization) {
      const { data, error } = await userClient(authorization)
        .from("workspaces")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1);
      if (error) throw new Error(error.message);
      return data?.[0]?.id ?? null;
    },

    async exchangeCode(code) {
      const { ok, body } = await tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
      if (!ok || typeof body.access_token !== "string") return { ok: false, code: String(body.error ?? "failed") };
      return {
        ok: true,
        accessToken: body.access_token,
        refreshToken: typeof body.refresh_token === "string" ? body.refresh_token : undefined,
        expiresIn: Number(body.expires_in) || 3600,
        scope: String(body.scope ?? ""),
      };
    },

    async refreshAccessToken(refreshToken) {
      const { ok, body } = await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
      if (!ok || typeof body.access_token !== "string") return null;
      return { accessToken: body.access_token, expiresIn: Number(body.expires_in) || 3600 };
    },

    async fetchChannel(accessToken) {
      const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true", {
        headers: { authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(20_000),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    },

    async saveAccount(row) {
      const record: Record<string, unknown> = {
        workspace_id: row.workspaceId,
        platform: "youtube",
        external_id: row.channel.externalId,
        display_name: row.channel.name,
        handle: row.channel.handle,
        avatar_url: row.channel.avatarUrl,
        subscribers: row.channel.subscribers,
        video_count: row.channel.videos,
        view_count: row.channel.views,
        stats_updated_at: new Date().toISOString(),
        access_token: row.accessToken,
        token_expires_at: row.expiresAt,
        scopes: row.scope,
        connected_at: new Date().toISOString(),
      };
      // Google only sends a refresh token on first consent. Never overwrite a saved one with nothing.
      if (row.refreshToken) record.refresh_token = row.refreshToken;
      const { error } = await admin().from("social_accounts").upsert(record, { onConflict: "workspace_id,platform" });
      if (error) throw new Error(error.message);
    },

    async loadAccount(workspaceId) {
      const { data, error } = await admin()
        .from("social_accounts")
        .select("access_token,refresh_token,token_expires_at")
        .eq("workspace_id", workspaceId)
        .eq("platform", "youtube")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data
        ? { accessToken: data.access_token, refreshToken: data.refresh_token, tokenExpiresAt: data.token_expires_at }
        : null;
    },

    async updateStats(workspaceId, patch) {
      const record: Record<string, unknown> = {
        display_name: patch.channel.name,
        handle: patch.channel.handle,
        avatar_url: patch.channel.avatarUrl,
        subscribers: patch.channel.subscribers,
        video_count: patch.channel.videos,
        view_count: patch.channel.views,
        stats_updated_at: new Date().toISOString(),
      };
      if (patch.accessToken) record.access_token = patch.accessToken;
      if (patch.expiresAt) record.token_expires_at = patch.expiresAt;
      const { error } = await admin().from("social_accounts").update(record).eq("workspace_id", workspaceId).eq("platform", "youtube");
      if (error) throw new Error(error.message);
    },

    // Logs never contain tokens, codes or channel data.
    log: (message) => console.error(message),
  };
}
