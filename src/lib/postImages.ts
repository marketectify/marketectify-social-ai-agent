/** Helpers for the picture attached to a post. No browser-only code, so they are easy to test. */

export const IMAGE_LIMITS = {
  /** Largest picture we store (after the browser has shrunk it). */
  maxBytes: 4 * 1024 * 1024,
} as const;

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const ALLOWED_IMAGE_TYPES = Object.keys(MIME_EXT);

/** Reads `data:image/png;base64,...`. Returns null for anything that is not a safe picture address. */
export function parseImageDataUrl(value: string): { mime: string; ext: string; base64: string; bytes: number } | null {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!m) return null;
  const base64 = m[2];
  const bytes = Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
  return { mime: m[1], ext: MIME_EXT[m[1]], base64, bytes };
}

export function isImageTooLarge(value: string): boolean {
  const parsed = parseImageDataUrl(value);
  return !parsed || parsed.bytes > IMAGE_LIMITS.maxBytes;
}

export function dataUrlToBlob(value: string): Blob {
  const parsed = parseImageDataUrl(value);
  if (!parsed) throw new Error("This picture format is not supported. Use JPG, PNG or WebP.");
  if (parsed.bytes > IMAGE_LIMITS.maxBytes) throw new Error("This picture is too large (maximum 4 MB).");
  const binary = atob(parsed.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: parsed.mime });
}

/** What a post's `image` value means. */
export function imageKind(value: string | null | undefined): "none" | "new" | "existing" {
  if (!value) return "none";
  return value.startsWith("data:") ? "new" : "existing";
}
