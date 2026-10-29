// Supabase Edge Function: generate-content
//
// The browser sends the brief (topic, tone, language ...). This function checks the
// user is signed in, counts the daily quota, asks Google Gemini and returns clean JSON.
//
// The Gemini key lives ONLY here, as the secret GEMINI_API_KEY. It is never sent to the browser.
// Secrets (Supabase dashboard -> Edge Functions -> Secrets):
//   GEMINI_API_KEY   required   your Google AI Studio key
//   GEMINI_MODEL     optional   one model, or a comma separated list tried in order
//   AI_DAILY_LIMIT   optional   generations per user per day (default 60)
// SUPABASE_URL and SUPABASE_ANON_KEY are provided by Supabase automatically.

import { createClient } from "npm:@supabase/supabase-js@2";
import { handleRequest, parseDailyLimit, parseModelList, type Deps } from "./logic.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const geminiKey = Deno.env.get("GEMINI_API_KEY") ?? "";

function userClient(authorization: string) {
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const deps: Deps = {
  models: parseModelList(Deno.env.get("GEMINI_MODEL")),
  dailyLimit: parseDailyLimit(Deno.env.get("AI_DAILY_LIMIT")),
  geminiConfigured: geminiKey.length > 0,

  async getUser(authorization) {
    if (!authorization) return null;
    const token = authorization.replace(/^Bearer\s+/i, "");
    const { data, error } = await userClient(authorization).auth.getUser(token);
    return error || !data.user ? null : { id: data.user.id };
  },

  async consumeQuota(authorization, limit) {
    const { data, error } = await userClient(authorization).rpc("consume_ai_quota", { p_limit: limit });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return { allowed: Boolean(row?.is_allowed), used: Number(row?.used_today ?? 0) };
  },

  async releaseQuota(authorization) {
    const { error } = await userClient(authorization).rpc("release_ai_quota");
    if (error) throw new Error(error.message);
  },

  async callGemini(model, body) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": geminiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45_000),
      },
    );
    let parsed: unknown = null;
    try {
      parsed = await response.json();
    } catch {
      // Non-JSON answer: leave body null, the status code still tells what happened.
    }
    return { status: response.status, body: parsed };
  },

  // Logs never contain the key or the user's text.
  log: (message) => console.error(message),
};

Deno.serve((req) => handleRequest(req, deps));
