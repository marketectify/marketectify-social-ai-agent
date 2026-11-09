// Deno wiring for YouTube posting and comments (not unit tested: it only connects the tested logic to Google).
import type { LiHttpRequest, LiHttpResult } from "./linkedin.ts";
import { isOwnMediaUrl } from "./linkedin.ts";
import { YT_VIDEO_MAX_BYTES, type YtApiDeps } from "./youtube_api.ts";

const env = (name: string) => Deno.env.get(name) ?? "";

/** One call to Google. Errors are replaced by a plain message because their text can contain the full address. */
export async function ytHttp(req: LiHttpRequest): Promise<LiHttpResult> {
  try {
    const headers: Record<string, string> = { ...(req.headers ?? {}) };
    let body: BodyInit | undefined;
    if (req.form) {
      headers["content-type"] = "application/x-www-form-urlencoded";
      body = new URLSearchParams(req.form);
    } else if (req.json !== undefined) {
      headers["content-type"] = "application/json; charset=UTF-8";
      body = JSON.stringify(req.json);
    } else if (req.bytes) {
      body = req.bytes;
    }
    // The video itself can take a while to send.
    const res = await fetch(req.url, { method: req.method, headers, body, signal: AbortSignal.timeout(req.bytes ? 140_000 : 30_000) });
    const out: Record<string, string> = {};
    res.headers.forEach((v, k) => (out[k.toLowerCase()] = v));
    return { status: res.status, body: await res.json().catch(() => null), headers: out };
  } catch {
    throw new Error("Could not reach Google.");
  }
}

/** Downloads one of our own public videos (never any other address). */
export async function ytFetchVideo(url: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  if (!isOwnMediaUrl(url, env("SUPABASE_URL"))) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(60_000), redirect: "error" });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "video/mp4";
    if (!type.startsWith("video/")) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    return bytes.length > 0 && bytes.length <= YT_VIDEO_MAX_BYTES ? { bytes, type } : null;
  } catch {
    return null;
  }
}

export const makeYtApiDeps = (): YtApiDeps => ({
  http: ytHttp,
  fetchVideo: ytFetchVideo,
  clientId: env("GOOGLE_CLIENT_ID"),
  clientSecret: env("GOOGLE_CLIENT_SECRET"),
});
