import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostMedia } from "../types";

export const MEDIA_BUCKET = "post-media";
/** Largest file accepted for a post picture (videos get their own limit later). */
export const MEDIA_MAX_BYTES = 8 * 1024 * 1024;

/** Where post pictures are kept. Two implementations: browser (demo) and Supabase Storage. */
export interface MediaStore {
  upload(file: Blob, kind: PostMedia["kind"]): Promise<PostMedia>;
  /** Best effort: never throws, a leftover file is harmless. */
  remove(url: string): Promise<void>;
}

function extensionFor(type: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "video/mp4") return "mp4";
  return type.startsWith("video/") ? "mp4" : "jpg";
}

function newName(): string {
  const c = globalThis.crypto;
  return c && typeof c.randomUUID === "function" ? c.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the picture."));
    reader.readAsDataURL(file);
  });
}

/** Demo mode: the picture becomes a data address stored with the post in this browser. */
export function createLocalMediaStore(): MediaStore {
  return {
    async upload(file, kind) {
      if (kind !== "image") throw new Error("Videos need the database connection. They are not available in demo mode.");
      if (file.size > MEDIA_MAX_BYTES) throw new Error("The picture is too large.");
      return { url: await readAsDataUrl(file), kind };
    },
    async remove() {},
  };
}

/** The storage path inside the bucket, taken from a public address. Null when it is not ours. */
export function pathFromPublicUrl(url: string): string | null {
  const marker = `/${MEDIA_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const path = decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
  return path && !path.includes("..") ? path : null;
}

/** Real mode: files go to the public bucket `post-media`, in a folder named after the workspace. */
export function createSupabaseMediaStore(client: SupabaseClient, workspaceId: string): MediaStore {
  return {
    async upload(file, kind) {
      if (file.size > MEDIA_MAX_BYTES * (kind === "video" ? 8 : 1)) throw new Error("The file is too large.");
      const type = file.type || (kind === "video" ? "video/mp4" : "image/jpeg");
      const path = `${workspaceId}/${newName()}.${extensionFor(type)}`;
      const { error } = await client.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: type, upsert: false, cacheControl: "31536000" });
      if (error) {
        throw new Error(
          /bucket not found/i.test(error.message)
            ? "Picture storage is not set up yet. Run the 0008 SQL file (see docs/SETUP.md)."
            : `Could not upload the picture: ${error.message}`,
        );
      }
      const { data } = client.storage.from(MEDIA_BUCKET).getPublicUrl(path);
      return { url: data.publicUrl, kind };
    },
    async remove(url) {
      try {
        const path = pathFromPublicUrl(url);
        if (path && path.startsWith(`${workspaceId}/`)) await client.storage.from(MEDIA_BUCKET).remove([path]);
      } catch {
        /* leftover file is harmless */
      }
    },
  };
}
