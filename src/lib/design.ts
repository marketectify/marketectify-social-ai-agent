// The post designer's engine: data model, text layout, snapping, undo/redo, starter templates and
// PNG rendering. Everything except `renderDesign` is pure, so it is unit tested without a browser.

export type FontFamily = "sans" | "serif" | "mono" | "display";

export const FONT_STACKS: Record<FontFamily, string> = {
  sans: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", Times, serif',
  mono: 'ui-monospace, Menlo, Consolas, "Courier New", monospace',
  display: 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif',
};
export const FONT_LABELS: Record<FontFamily, string> = { sans: "Modern", serif: "Classic", mono: "Typewriter", display: "Bold display" };

export interface Preset {
  id: string;
  label: string;
  width: number;
  height: number;
}
export const PRESETS: Preset[] = [
  { id: "square", label: "Square post (1080 x 1080)", width: 1080, height: 1080 },
  { id: "portrait", label: "Portrait post (1080 x 1350)", width: 1080, height: 1350 },
  { id: "story", label: "Story / Reel / Short (1080 x 1920)", width: 1080, height: 1920 },
  { id: "landscape", label: "Landscape / Facebook (1200 x 630)", width: 1200, height: 630 },
];

interface Base {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
}
export interface TextEl extends Base {
  type: "text";
  text: string;
  fontSize: number;
  fontWeight: 400 | 700 | 900;
  color: string;
  align: "left" | "center" | "right";
  font: FontFamily;
}
export interface ImageEl extends Base {
  type: "image";
  src: string;
  fit: "cover" | "contain";
  radius: number;
}
export interface ShapeEl extends Base {
  type: "shape";
  shape: "rect" | "ellipse";
  fill: string;
  radius: number;
}
export type El = TextEl | ImageEl | ShapeEl;

export type Background =
  | { kind: "solid"; color: string }
  | { kind: "gradient"; from: string; to: string; angle: number }
  | { kind: "image"; src: string; overlay: number };

export interface Design {
  version: 1;
  width: number;
  height: number;
  background: Background;
  elements: El[];
}

export const LIMITS = { maxElements: 40, maxText: 2000, minSize: 24, maxFont: 400, minFont: 8, history: 100 } as const;
export const LINE_HEIGHT = 1.25;

let counter = 0;
export function uid(): string {
  counter += 1;
  return `el-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const HEX = /^#[0-9a-fA-F]{6}$/;
export const safeColor = (c: unknown, fallback: string) => (typeof c === "string" && HEX.test(c) ? c : fallback);

// ---------------------------------------------------------------------------
// Text layout (used by BOTH the on-screen preview and the PNG export, so they always match)
// ---------------------------------------------------------------------------

export type Measure = (text: string, font: string) => number;

export function fontString(el: Pick<TextEl, "fontWeight" | "fontSize" | "font">): string {
  return `${el.fontWeight} ${el.fontSize}px ${FONT_STACKS[el.font]}`;
}

export function layoutText(text: string, maxWidth: number, font: string, measure: Measure): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate, font) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      if (measure(word, font) <= maxWidth) {
        line = word;
        continue;
      }
      // A single word wider than the box: break it by characters.
      let chunk = "";
      for (const ch of word) {
        if (chunk && measure(chunk + ch, font) > maxWidth) {
          lines.push(chunk);
          chunk = ch;
        } else chunk += ch;
      }
      line = chunk;
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

export const lineHeightPx = (fontSize: number) => Math.round(fontSize * LINE_HEIGHT);
export const textHeight = (lineCount: number, fontSize: number) => Math.max(1, lineCount) * lineHeightPx(fontSize);

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export interface Guides {
  v: number | null; // x of a vertical guide line
  h: number | null; // y of a horizontal guide line
}

/** Moves a box and snaps it to the canvas centre and edges when close. Keeps at least a little of it on the canvas. */
export function snapMove(
  box: { w: number; h: number },
  x: number,
  y: number,
  canvas: { width: number; height: number },
  threshold: number,
): { x: number; y: number; guides: Guides } {
  const guides: Guides = { v: null, h: null };
  const xs = [
    { at: canvas.width / 2, pos: (canvas.width - box.w) / 2 },
    { at: 0, pos: 0 },
    { at: canvas.width, pos: canvas.width - box.w },
  ];
  const ys = [
    { at: canvas.height / 2, pos: (canvas.height - box.h) / 2 },
    { at: 0, pos: 0 },
    { at: canvas.height, pos: canvas.height - box.h },
  ];
  let nx = x;
  let ny = y;
  // Check the box's left edge, centre and right edge against each target.
  let best = threshold + 1;
  for (const t of xs) {
    for (const edge of [0, box.w / 2, box.w]) {
      const d = Math.abs(x + edge - t.at);
      if (d <= threshold && d < best) {
        best = d;
        nx = t.at - edge;
        guides.v = t.at;
      }
    }
  }
  best = threshold + 1;
  for (const t of ys) {
    for (const edge of [0, box.h / 2, box.h]) {
      const d = Math.abs(y + edge - t.at);
      if (d <= threshold && d < best) {
        best = d;
        ny = t.at - edge;
        guides.h = t.at;
      }
    }
  }
  const margin = 24;
  nx = clamp(nx, margin - box.w, canvas.width - margin);
  ny = clamp(ny, margin - box.h, canvas.height - margin);
  return { x: nx, y: ny, guides };
}

export function fitRect(srcW: number, srcH: number, boxW: number, boxH: number, mode: "cover" | "contain") {
  if (srcW <= 0 || srcH <= 0) return { sx: 0, sy: 0, sw: 1, sh: 1, dx: 0, dy: 0, dw: boxW, dh: boxH };
  const scale = mode === "cover" ? Math.max(boxW / srcW, boxH / srcH) : Math.min(boxW / srcW, boxH / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  if (mode === "cover") {
    const sw = boxW / scale;
    const sh = boxH / scale;
    return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh, dx: 0, dy: 0, dw: boxW, dh: boxH };
  }
  return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: (boxW - dw) / 2, dy: (boxH - dh) / 2, dw, dh };
}

/** Start and end points of a CSS style linear gradient for a box (angle in degrees, 180 = top to bottom). */
export function gradientPoints(w: number, h: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const len = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
  const cx = w / 2;
  const cy = h / 2;
  return { x0: cx - (dx * len) / 2, y0: cy - (dy * len) / 2, x1: cx + (dx * len) / 2, y1: cy + (dy * len) / 2 };
}

// ---------------------------------------------------------------------------
// Element creation and editing
// ---------------------------------------------------------------------------

export type NewKind = "heading" | "paragraph" | "rect" | "ellipse";

export function newElement(kind: NewKind, canvas: { width: number; height: number }, at?: { x: number; y: number }): El {
  const W = canvas.width;
  const cx = at?.x ?? W / 2;
  const cy = at?.y ?? canvas.height / 2;
  const place = (w: number, h: number) => ({
    x: Math.round(clamp(cx - w / 2, 0, Math.max(0, W - w))),
    y: Math.round(clamp(cy - h / 2, 0, Math.max(0, canvas.height - h))),
  });
  if (kind === "heading") {
    const w = Math.round(W * 0.8);
    const fontSize = Math.round(W * 0.085);
    return { id: uid(), type: "text", ...place(w, textHeight(1, fontSize)), w, h: textHeight(1, fontSize), opacity: 1, text: "Your heading", fontSize, fontWeight: 900, color: "#0f172a", align: "center", font: "sans" };
  }
  if (kind === "paragraph") {
    const w = Math.round(W * 0.7);
    const fontSize = Math.round(W * 0.036);
    return { id: uid(), type: "text", ...place(w, textHeight(3, fontSize)), w, h: textHeight(3, fontSize), opacity: 1, text: "Write a short supporting paragraph here.", fontSize, fontWeight: 400, color: "#334155", align: "center", font: "sans" };
  }
  const w = Math.round(W * 0.4);
  const h = kind === "ellipse" ? w : Math.round(W * 0.25);
  return { id: uid(), type: "shape", ...place(w, h), w, h, opacity: 1, shape: kind === "ellipse" ? "ellipse" : "rect", fill: "#2563eb", radius: kind === "rect" ? 24 : 0 };
}

export function newImageElement(src: string, natural: { w: number; h: number }, canvas: { width: number; height: number }, at?: { x: number; y: number }): ImageEl {
  const maxW = canvas.width * 0.6;
  const maxH = canvas.height * 0.6;
  const scale = Math.min(maxW / natural.w, maxH / natural.h, 1.5);
  const w = Math.max(LIMITS.minSize, Math.round(natural.w * scale));
  const h = Math.max(LIMITS.minSize, Math.round(natural.h * scale));
  const cx = at?.x ?? canvas.width / 2;
  const cy = at?.y ?? canvas.height / 2;
  return { id: uid(), type: "image", src, fit: "cover", radius: 0, opacity: 1, w, h, x: Math.round(clamp(cx - w / 2, 0, Math.max(0, canvas.width - w))), y: Math.round(clamp(cy - h / 2, 0, Math.max(0, canvas.height - h))) };
}

export function updateElement(design: Design, id: string, patch: Partial<El>): Design {
  return { ...design, elements: design.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as El) : e)) };
}
export function removeElement(design: Design, id: string): Design {
  return { ...design, elements: design.elements.filter((e) => e.id !== id) };
}
export function duplicateElement(design: Design, id: string): { design: Design; newId: string | null } {
  const el = design.elements.find((e) => e.id === id);
  if (!el || design.elements.length >= LIMITS.maxElements) return { design, newId: null };
  const copy = { ...el, id: uid(), x: el.x + 30, y: el.y + 30 } as El;
  return { design: { ...design, elements: [...design.elements, copy] }, newId: copy.id };
}
export function moveLayer(design: Design, id: string, dir: "front" | "back" | "up" | "down"): Design {
  const list = [...design.elements];
  const i = list.findIndex((e) => e.id === id);
  if (i === -1) return design;
  const [el] = list.splice(i, 1);
  const target = dir === "front" ? list.length : dir === "back" ? 0 : dir === "up" ? Math.min(list.length, i + 1) : Math.max(0, i - 1);
  list.splice(target, 0, el);
  return { ...design, elements: list };
}

/** Resizes a design to another preset and moves everything proportionally. */
export function resizeCanvas(design: Design, width: number, height: number): Design {
  const sx = width / design.width;
  const sy = height / design.height;
  const s = Math.min(sx, sy);
  return {
    ...design,
    width,
    height,
    elements: design.elements.map((e) => {
      const base = { ...e, x: Math.round(e.x * sx), y: Math.round(e.y * sy), w: Math.round(e.w * sx) };
      if (e.type === "text") return { ...base, fontSize: clamp(Math.round(e.fontSize * s), LIMITS.minFont, LIMITS.maxFont), h: Math.round(e.h * s) } as El;
      return { ...base, h: Math.round(e.h * sy) } as El;
    }),
  };
}

// ---------------------------------------------------------------------------
// Undo / redo
// ---------------------------------------------------------------------------

export interface History {
  past: Design[];
  present: Design;
  future: Design[];
}
export const startHistory = (design: Design): History => ({ past: [], present: design, future: [] });
export function pushHistory(h: History, next: Design): History {
  if (next === h.present) return h;
  return { past: [...h.past, h.present].slice(-LIMITS.history), present: next, future: [] };
}
/** Replaces the present without adding an undo step (for typing and dragging in progress). */
export const replacePresent = (h: History, next: Design): History => ({ ...h, present: next });
export function undo(h: History): History {
  if (h.past.length === 0) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}
export function redo(h: History): History {
  if (h.future.length === 0) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}

// ---------------------------------------------------------------------------
// Starter templates
// ---------------------------------------------------------------------------

export function blankDesign(preset: Preset = PRESETS[0]): Design {
  return { version: 1, width: preset.width, height: preset.height, background: { kind: "solid", color: "#ffffff" }, elements: [] };
}

export interface Template {
  id: string;
  label: string;
  build: (preset: Preset) => Design;
}

const text = (p: Partial<TextEl> & Pick<TextEl, "text" | "x" | "y" | "w" | "fontSize">): TextEl => ({
  id: uid(), type: "text", h: 0, opacity: 1, fontWeight: 400, color: "#0f172a", align: "center", font: "sans", ...p,
}) as TextEl;

export const TEMPLATES: Template[] = [
  { id: "blank", label: "Blank", build: (p) => blankDesign(p) },
  {
    id: "announcement",
    label: "Announcement",
    build: (p) => {
      const W = p.width, H = p.height;
      return {
        version: 1, width: W, height: H,
        background: { kind: "gradient", from: "#2563eb", to: "#1e40af", angle: 160 },
        elements: [
          text({ text: "BIG NEWS", x: W * 0.1, y: H * 0.22, w: W * 0.8, fontSize: Math.round(W * 0.05), fontWeight: 700, color: "#bfdbfe" }),
          text({ text: "Something new is coming", x: W * 0.1, y: H * 0.3, w: W * 0.8, fontSize: Math.round(W * 0.1), fontWeight: 900, color: "#ffffff" }),
          text({ text: "Tell people what is launching and why it matters to them.", x: W * 0.15, y: H * 0.62, w: W * 0.7, fontSize: Math.round(W * 0.036), color: "#dbeafe" }),
        ].map((e) => ({ ...e, x: Math.round(e.x), y: Math.round(e.y), w: Math.round(e.w) })),
      };
    },
  },
  {
    id: "quote",
    label: "Quote",
    build: (p) => {
      const W = p.width, H = p.height;
      return {
        version: 1, width: W, height: H,
        background: { kind: "solid", color: "#eff6ff" },
        elements: [
          text({ text: "“", x: W * 0.1, y: H * 0.12, w: W * 0.2, fontSize: Math.round(W * 0.25), fontWeight: 900, color: "#2563eb", align: "left", font: "serif" }),
          text({ text: "Good content is a conversation, not a broadcast.", x: W * 0.12, y: H * 0.34, w: W * 0.76, fontSize: Math.round(W * 0.07), fontWeight: 700, color: "#0f172a", font: "serif" }),
          text({ text: "Your Name", x: W * 0.12, y: H * 0.72, w: W * 0.76, fontSize: Math.round(W * 0.035), fontWeight: 700, color: "#2563eb" }),
        ].map((e) => ({ ...e, x: Math.round(e.x), y: Math.round(e.y), w: Math.round(e.w) })),
      };
    },
  },
  {
    id: "sale",
    label: "Sale",
    build: (p) => {
      const W = p.width, H = p.height;
      const circle: ShapeEl = { id: uid(), type: "shape", shape: "ellipse", x: Math.round(W * 0.25), y: Math.round(H * 0.22), w: Math.round(W * 0.5), h: Math.round(W * 0.5), opacity: 1, fill: "#ffffff", radius: 0 };
      return {
        version: 1, width: W, height: H,
        background: { kind: "solid", color: "#dc2626" },
        elements: [
          circle,
          text({ text: "20% OFF", x: W * 0.25, y: H * 0.22 + W * 0.17, w: W * 0.5, fontSize: Math.round(W * 0.09), fontWeight: 900, color: "#dc2626", font: "display" }),
          text({ text: "Weekend sale", x: W * 0.1, y: H * 0.68, w: W * 0.8, fontSize: Math.round(W * 0.08), fontWeight: 900, color: "#ffffff" }),
          text({ text: "Only until Sunday. Link in bio.", x: W * 0.1, y: H * 0.8, w: W * 0.8, fontSize: Math.round(W * 0.036), color: "#fee2e2" }),
        ].map((e) => ({ ...e, x: Math.round(e.x), y: Math.round(e.y), w: Math.round(e.w) })),
      };
    },
  },
];

/** Gives every text element the height its content needs. Call after layout changes. */
export function fitTextHeights(design: Design, measure: Measure): Design {
  let changed = false;
  const elements = design.elements.map((e) => {
    if (e.type !== "text") return e;
    const lines = layoutText(e.text, e.w, fontString(e), measure);
    const h = textHeight(lines.length, e.fontSize);
    if (h === e.h) return e;
    changed = true;
    return { ...e, h };
  });
  return changed ? { ...design, elements } : design;
}

// ---------------------------------------------------------------------------
// Loading saved designs safely
// ---------------------------------------------------------------------------

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isDataImage = (s: unknown): s is string => typeof s === "string" && /^data:image\/(png|jpeg|webp|gif);base64,/.test(s);

export function parseDesign(input: unknown): Design | null {
  if (!input || typeof input !== "object") return null;
  const d = input as Record<string, any>;
  if (d.version !== 1 || !isNum(d.width) || !isNum(d.height) || d.width < 200 || d.width > 4000 || d.height < 200 || d.height > 4000) return null;
  const bg = d.background;
  let background: Background;
  if (bg?.kind === "gradient") background = { kind: "gradient", from: safeColor(bg.from, "#2563eb"), to: safeColor(bg.to, "#1e40af"), angle: isNum(bg.angle) ? clamp(bg.angle, 0, 360) : 160 };
  else if (bg?.kind === "image" && isDataImage(bg.src)) background = { kind: "image", src: bg.src, overlay: isNum(bg.overlay) ? clamp(bg.overlay, 0, 0.8) : 0 };
  else background = { kind: "solid", color: safeColor(bg?.color, "#ffffff") };
  if (!Array.isArray(d.elements) || d.elements.length > LIMITS.maxElements) return null;
  const elements: El[] = [];
  for (const raw of d.elements) {
    if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || ![raw.x, raw.y, raw.w, raw.h].every(isNum)) return null;
    const base = { id: raw.id.slice(0, 60), x: raw.x, y: raw.y, w: clamp(raw.w, 1, 8000), h: clamp(raw.h, 1, 8000), opacity: isNum(raw.opacity) ? clamp(raw.opacity, 0, 1) : 1 };
    if (raw.type === "text" && typeof raw.text === "string") {
      elements.push({
        ...base, type: "text", text: raw.text.slice(0, LIMITS.maxText), fontSize: isNum(raw.fontSize) ? clamp(raw.fontSize, LIMITS.minFont, LIMITS.maxFont) : 40,
        fontWeight: raw.fontWeight === 700 || raw.fontWeight === 900 ? raw.fontWeight : 400, color: safeColor(raw.color, "#0f172a"),
        align: raw.align === "left" || raw.align === "right" ? raw.align : "center", font: raw.font in FONT_STACKS ? raw.font : "sans",
      });
    } else if (raw.type === "image" && isDataImage(raw.src)) {
      elements.push({ ...base, type: "image", src: raw.src, fit: raw.fit === "contain" ? "contain" : "cover", radius: isNum(raw.radius) ? clamp(raw.radius, 0, 2000) : 0 });
    } else if (raw.type === "shape") {
      elements.push({ ...base, type: "shape", shape: raw.shape === "ellipse" ? "ellipse" : "rect", fill: safeColor(raw.fill, "#2563eb"), radius: isNum(raw.radius) ? clamp(raw.radius, 0, 2000) : 0 });
    } else return null;
  }
  return { version: 1, width: d.width, height: d.height, background, elements };
}

// ---------------------------------------------------------------------------
// Rendering to a canvas (PNG export and thumbnails)
// ---------------------------------------------------------------------------

export type ImageMap = Map<string, { img: CanvasImageSource; w: number; h: number }>;

function roundedPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function renderDesign(ctx: CanvasRenderingContext2D, design: Design, images: ImageMap, scale = 1): void {
  ctx.save();
  ctx.scale(scale, scale);
  const { width: W, height: H, background: bg } = design;
  if (bg.kind === "solid") {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, W, H);
  } else if (bg.kind === "gradient") {
    const g = gradientPoints(W, H, bg.angle);
    const grad = ctx.createLinearGradient(g.x0, g.y0, g.x1, g.y1);
    grad.addColorStop(0, bg.from);
    grad.addColorStop(1, bg.to);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, W, H);
    const im = images.get(bg.src);
    if (im) {
      const f = fitRect(im.w, im.h, W, H, "cover");
      ctx.drawImage(im.img, f.sx, f.sy, f.sw, f.sh, 0, 0, W, H);
    }
    if (bg.overlay > 0) {
      ctx.fillStyle = `rgba(15,23,42,${bg.overlay})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  const measure: Measure = (t, font) => {
    ctx.font = font;
    return ctx.measureText(t).width;
  };

  for (const e of design.elements) {
    ctx.save();
    ctx.globalAlpha = e.opacity;
    if (e.type === "shape") {
      ctx.fillStyle = e.fill;
      if (e.shape === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2, e.w / 2, e.h / 2, 0, 0, Math.PI * 2);
      } else roundedPath(ctx, e.x, e.y, e.w, e.h, e.radius);
      ctx.fill();
    } else if (e.type === "image") {
      const im = images.get(e.src);
      if (im) {
        roundedPath(ctx, e.x, e.y, e.w, e.h, e.radius);
        ctx.clip();
        const f = fitRect(im.w, im.h, e.w, e.h, e.fit);
        ctx.drawImage(im.img, f.sx, f.sy, f.sw, f.sh, e.x + f.dx, e.y + f.dy, f.dw, f.dh);
      }
    } else {
      const font = fontString(e);
      const lines = layoutText(e.text, e.w, font, measure);
      const lh = lineHeightPx(e.fontSize);
      ctx.font = font;
      ctx.fillStyle = e.color;
      ctx.textBaseline = "middle";
      ctx.textAlign = e.align;
      const x = e.align === "left" ? e.x : e.align === "right" ? e.x + e.w : e.x + e.w / 2;
      lines.forEach((line, i) => ctx.fillText(line, x, e.y + i * lh + lh / 2));
    }
    ctx.restore();
  }
  ctx.restore();
}
