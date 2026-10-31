import type { ImageMap } from "./design";

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_SIDE = 1600;

export class ImageError extends Error {}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new ImageError("This image could not be read."));
    img.src = src;
  });
}

/** Reads a picture the user chose, shrinks it (so saving stays light) and returns it as a data address. */
export async function processImageFile(file: File): Promise<{ src: string; w: number; h: number }> {
  if (!IMAGE_TYPES.includes(file.type)) throw new ImageError("Please choose a PNG, JPG, WebP or GIF picture.");
  if (file.size > MAX_UPLOAD_BYTES) throw new ImageError("This picture is larger than 15 MB. Please choose a smaller one.");
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const ratio = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * ratio));
    const h = Math.max(1, Math.round(img.naturalHeight * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageError("Your browser could not process this picture.");
    const keepAlpha = file.type === "image/png" || file.type === "image/webp" || file.type === "image/gif";
    if (!keepAlpha) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(img, 0, 0, w, h);
    let src = keepAlpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.88);
    if (keepAlpha && src.length > 2_500_000) src = canvas.toDataURL("image/webp", 0.9);
    if (!src.startsWith("data:image/")) throw new ImageError("Your browser could not process this picture.");
    return { src, w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function loadImageMap(srcs: string[]): Promise<ImageMap> {
  const map: ImageMap = new Map();
  await Promise.all(
    [...new Set(srcs)].map(async (src) => {
      try {
        const img = await loadImage(src);
        map.set(src, { img, w: img.naturalWidth, h: img.naturalHeight });
      } catch {
        /* a broken picture is skipped, the rest still exports */
      }
    }),
  );
  return map;
}

/** Turns a picture file into a JPEG data address that is small enough to attach to a post. */
export async function fileToPostImage(file: File): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type)) throw new ImageError("Please choose a PNG, JPG, WebP or GIF picture.");
  if (file.size > MAX_UPLOAD_BYTES) throw new ImageError("This picture is larger than 15 MB. Please choose a smaller one.");
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const ratio = Math.min(1, 1350 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageError("Your browser could not process this picture.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.88);
  } finally {
    URL.revokeObjectURL(url);
  }
}
