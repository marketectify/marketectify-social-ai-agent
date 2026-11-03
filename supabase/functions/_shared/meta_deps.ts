// Deno wiring for the Facebook / Instagram functions (not unit tested: it only connects the tested logic to Meta and Supabase).
// Secrets (Supabase dashboard -> Edge Functions -> Secrets):
//   META_APP_ID, META_APP_SECRET   from developers.facebook.com -> your app -> App settings -> Basic
//   META_LOGIN_CONFIG_ID           optional: Configuration ID when the app uses "Facebook Login for Business"
//   OAUTH_STATE_SECRET             same long random text as for YouTube
//   SITE_URL                       https://social-ai.marketectify.com
//   CRON_SECRET                    any long random text; the scheduler sends it in the x-cron-secret header
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.

import { createClient } from "npm:@supabase/supabase-js@2";
import { GRAPH_VERSION, type MetaDeps, type MetaAccountRow, type PostRow } from "./meta.ts";

const env = (name: string) => Deno.env.get(name) ?? "";

export function makeMetaDeps(): MetaDeps {
  const supabaseUrl = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const appId = env("META_APP_ID");
  const appSecret = env("META_APP_SECRET");
  const stateSecret = env("OAUTH_STATE_SECRET");
  const siteUrl = env("SITE_URL") || "https://social-ai.marketectify.com";
  const redirectUri = `${supabaseUrl}/functions/v1/meta-callback`;

  const userClient = (authorization: string) =>
    createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  const admin = () => createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const postFromRow = (r: any): PostRow => ({
    id: r.id,
    workspaceId: r.workspace_id,
    caption: r.caption ?? "",
    hashtags: Array.isArray(r.hashtags) ? r.hashtags : [],
    platforms: Array.isArray(r.platforms) ? r.platforms : [],
    status: r.status,
    mediaUrl: typeof r.media_url === "string" && r.media_url.startsWith("https://") ? r.media_url : null,
    externalIds: r.external_ids && typeof r.external_ids === "object" ? r.external_ids : {},
  });
  const POST_COLUMNS = "id,workspace_id,caption,hashtags,platforms,status,media_url,external_ids";

  return {
    configured: Boolean(appId && appSecret && stateSecret && supabaseUrl && serviceKey),
    siteUrl,
    appId,
    configId: env("META_LOGIN_CONFIG_ID"),
    stateSecret,
    cronSecret: env("CRON_SECRET"),
    redirectUri,
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

    async graph(method, path, params, token) {
      // Tokens travel in a header, never in the address. Codes and the app secret (login steps only) go in the body.
      const all: Record<string, string> = { ...params };
      const headers: Record<string, string> = {};
      if (token) headers.authorization = `Bearer ${token}`;
      else {
        all.client_id = appId;
        all.client_secret = appSecret;
      }
      const base = `https://graph.facebook.com/${GRAPH_VERSION}/${path}`;
      try {
        const res =
          method === "GET" && token
            ? await fetch(`${base}?${new URLSearchParams(all).toString()}`, { headers, signal: AbortSignal.timeout(25_000) })
            : await fetch(method === "GET" ? `${base}?${new URLSearchParams(all).toString()}` : base, {
                method,
                headers: method === "POST" ? { ...headers, "content-type": "application/x-www-form-urlencoded" } : headers,
                body: method === "POST" ? new URLSearchParams(all) : undefined,
                signal: AbortSignal.timeout(25_000),
              });
        return { status: res.status, body: await res.json().catch(() => null) };
      } catch {
        // The original error text can contain the full address (with secrets). Replace it.
        throw new Error("Could not reach Meta.");
      }
    },

    async saveAccounts(workspaceId, rows) {
      const now = new Date().toISOString();
      const records = rows.map((r) => ({
        workspace_id: workspaceId,
        platform: r.platform,
        external_id: r.externalId,
        display_name: r.displayName,
        handle: r.handle,
        avatar_url: r.avatarUrl,
        subscribers: r.followers,
        video_count: r.mediaCount,
        view_count: 0,
        stats_updated_at: now,
        access_token: r.token,
        refresh_token: null,
        token_expires_at: null,
        scopes: "meta",
        connected_at: now,
      }));
      const { error } = await admin().from("social_accounts").upsert(records, { onConflict: "workspace_id,platform" });
      if (error) throw new Error(error.message);
      // Instagram not linked to this Page any more: remove a stale Instagram row.
      if (!rows.some((r) => r.platform === "instagram")) {
        await admin().from("social_accounts").delete().eq("workspace_id", workspaceId).eq("platform", "instagram");
      }
    },

    async loadAccount(workspaceId, platform) {
      const { data, error } = await admin()
        .from("social_accounts")
        .select("platform,external_id,display_name,handle,avatar_url,subscribers,video_count,access_token")
        .eq("workspace_id", workspaceId)
        .eq("platform", platform)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data || !data.access_token) return null;
      const row: MetaAccountRow = {
        platform,
        externalId: data.external_id,
        displayName: data.display_name,
        handle: data.handle ?? "",
        avatarUrl: data.avatar_url ?? "",
        followers: data.subscribers,
        mediaCount: Number(data.video_count) || 0,
        token: data.access_token,
      };
      return row;
    },

    async loadPost(workspaceId, postId) {
      const { data, error } = await admin().from("posts").select(POST_COLUMNS).eq("id", postId).eq("workspace_id", workspaceId).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? postFromRow(data) : null;
    },

    async claimPost(postId) {
      // Only one run may publish a post. A claim older than 10 minutes is considered dead (the run crashed).
      const stale = new Date(Date.now() - 10 * 60_000).toISOString();
      const { data, error } = await admin()
        .from("posts")
        .update({ publish_started_at: new Date().toISOString() })
        .eq("id", postId)
        .or(`publish_started_at.is.null,publish_started_at.lt.${stale}`)
        .select("id");
      if (error) throw new Error(error.message);
      return (data ?? []).length === 1;
    },

    async releasePost(postId) {
      const { error } = await admin().from("posts").update({ publish_started_at: null }).eq("id", postId);
      if (error) throw new Error(error.message);
    },

    async markPost(postId, patch) {
      const record: Record<string, unknown> = { publish_error: patch.error ?? null };
      if (patch.externalIds) record.external_ids = patch.externalIds;
      if (patch.published) {
        record.status = "published";
        record.published_at = new Date().toISOString();
      }
      const { error } = await admin().from("posts").update(record).eq("id", postId);
      if (error) throw new Error(error.message);
    },

    async importComments(workspaceId, comments) {
      // Only comments that are not stored yet (the unique index also protects against races).
      const ids = comments.map((c) => c.externalId);
      const { data: existing, error: e1 } = await admin().from("messages").select("external_id").eq("workspace_id", workspaceId).in("external_id", ids);
      if (e1) throw new Error(e1.message);
      const have = new Set((existing ?? []).map((r: any) => r.external_id));
      const fresh = comments.filter((c) => !have.has(c.externalId));
      if (fresh.length === 0) return 0;
      const { error } = await admin().from("messages").upsert(
        fresh.map((c) => ({
          workspace_id: workspaceId,
          platform: c.platform,
          kind: "comment",
          sender_name: c.senderName,
          sender_handle: c.senderHandle,
          body: c.body,
          status: "unread",
          received_at: c.receivedAt,
          external_id: c.externalId,
        })),
        { onConflict: "workspace_id,platform,external_id", ignoreDuplicates: true },
      );
      if (error) throw new Error(error.message);
      return fresh.length;
    },

    async loadMessage(workspaceId, messageId) {
      const { data, error } = await admin().from("messages").select("id,workspace_id,platform,external_id,status").eq("id", messageId).eq("workspace_id", workspaceId).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { id: data.id, workspaceId: data.workspace_id, platform: data.platform, externalId: data.external_id, status: data.status } : null;
    },

    async markReplied(messageId, reply) {
      const { error } = await admin().from("messages").update({ status: "replied", reply, replied_at: new Date().toISOString() }).eq("id", messageId);
      if (error) throw new Error(error.message);
    },

    async listDuePosts(nowIso, limit) {
      // Posts that already failed once (publish_error set) are not retried by the scheduler: a person presses "Publish now".
      const { data, error } = await admin()
        .from("posts")
        .select(POST_COLUMNS)
        .eq("status", "approved")
        .is("publish_error", null)
        .lte("scheduled_at", nowIso)
        .overlaps("platforms", ["facebook", "instagram"])
        .order("scheduled_at", { ascending: true })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []).map(postFromRow);
    },

    async listMetaWorkspaces() {
      const { data, error } = await admin().from("social_accounts").select("workspace_id").in("platform", ["facebook", "instagram"]);
      if (error) throw new Error(error.message);
      return [...new Set((data ?? []).map((r: any) => r.workspace_id as string))];
    },

    // Logs never contain tokens, codes or comments.
    log: (message) => console.error(message),
  };
}
