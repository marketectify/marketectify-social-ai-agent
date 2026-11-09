import { renderDesign, type Design } from "./design";
import { loadImageMap } from "./designImages";

/** All the words written on a design, top to bottom, so the AI can write a caption that fits the picture. */
export function designText(design: Design): string {
  return design.elements
    .flatMap((e) => (e.type === "text" ? [{ y: e.y, x: e.x, text: e.text.replace(/\s+/g, " ").trim() }] : []))
    .filter((t) => t.text.length > 0)
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((t) => t.text)
    .join(". ");
}

/** A short description of a design for the "What is the post about?" box. Empty when the design has no words and no useful name. */
export function designTopic(name: string, design: Design, max = 1000): string {
  const words = designText(design);
  const title = /^untitled design$/i.test(name.trim()) ? "" : name.trim();
  const parts = [title && `Design: ${title}`, words && `Text on the picture: ${words}`].filter(Boolean);
  return parts.join("\n").slice(0, max);
}

/** Draw a saved design into a JPEG (at most `maxWidth` pixels wide) that a post can use as its picture. */
export async function renderDesignBlob(design: Design, maxWidth = 1080): Promise<Blob> {
  const srcs = design.elements.flatMap((e) => (e.type === "image" ? [e.src] : []));
  if (design.background.kind === "image") srcs.push(design.background.src);
  const images = await loadImageMap(srcs);
  const width = Math.min(design.width, maxWidth);
  const k = width / design.width;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(design.width * k);
  canvas.height = Math.round(design.height * k);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not draw the picture.");
  renderDesign(ctx, design, images, k);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("Could not create the picture.");
  return blob;
}
