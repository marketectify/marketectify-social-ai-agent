import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, BringToFront, Circle, Copy, Download, FolderOpen, Heading, ImagePlus, Palette,
  Redo2, Save, SendToBack, Square, Trash2, Type, Undo2,
} from "lucide-react";
import {
  FONT_LABELS, FONT_STACKS, LIMITS, PRESETS, TEMPLATES, blankDesign, duplicateElement, fitTextHeights, fontString, layoutText,
  lineHeightPx, moveLayer, newElement, newImageElement, pushHistory, redo, removeElement, renderDesign, replacePresent, resizeCanvas, snapMove,
  startHistory, undo, updateElement, type Design, type El, type FontFamily, type Guides, type History, type NewKind, type TextEl,
} from "../lib/design";
import { IMAGE_TYPES, ImageError, loadImageMap, processImageFile } from "../lib/designImages";
import { loadDesigns, saveDesigns, upsertDesign, type SavedDesign } from "../lib/designStore";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

const SWATCHES = ["#ffffff", "#0f172a", "#2563eb", "#1e40af", "#38bdf8", "#eff6ff", "#dc2626", "#16a34a", "#f59e0b", "#7c3aed"];
const DRAG_KIND = "application/x-design-kind";

// One shared canvas for measuring text, so layout is identical on screen and in the exported picture.
let measureCtx: CanvasRenderingContext2D | null = null;
const measure = (text: string, font: string): number => {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  if (!measureCtx) return text.length * 10;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
};

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

type Drag =
  | { mode: "move"; id: string; startX: number; startY: number; origX: number; origY: number; start: Design }
  | { mode: "resize"; id: string; startX: number; startY: number; origW: number; origH: number; start: Design };

export default function Designer() {
  const { workspace } = useAuth();
  const toast = useToast();
  const workspaceId = workspace?.id ?? "demo";

  const [history, setHistory] = useState<History>(() => startHistory(blankDesign()));
  const design = history.present;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [guides, setGuides] = useState<Guides>({ v: null, h: null });
  const [saved, setSaved] = useState<SavedDesign[]>(() => loadDesigns(storage(), workspaceId));
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [name, setName] = useState("Untitled design");
  const [exporting, setExporting] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [stageWidth, setStageWidth] = useState(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const lastEdit = useRef<{ key: string; at: number } | null>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const bgInput = useRef<HTMLInputElement>(null);

  // --- size of the on-screen preview ---------------------------------------------------------
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const read = () => {
      const w = el.clientWidth - 24; // minus the padding of the frame
      if (w > 0) setStageWidth(w);
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const maxHeight = typeof window === "undefined" ? 700 : Math.max(360, window.innerHeight - 260);
  const scale = stageWidth > 0 ? Math.min(stageWidth / design.width, maxHeight / design.height, 1) : 0.3;

  // --- history helpers -----------------------------------------------------------------------
  const normalize = useCallback((d: Design) => fitTextHeights(d, measure), []);

  /** Applies a change. Changes with the same `key` made within a second become one undo step. */
  const commit = useCallback(
    (update: (d: Design) => Design, key?: string) => {
      setHistory((h) => {
        const next = normalize(update(h.present));
        if (next === h.present) return h;
        const now = Date.now();
        const merge = key && lastEdit.current?.key === key && now - lastEdit.current.at < 1000;
        lastEdit.current = key ? { key, at: now } : null;
        return merge ? replacePresent(h, next) : pushHistory(h, next);
      });
    },
    [normalize],
  );

  const selected = design.elements.find((e) => e.id === selectedId) ?? null;
  useEffect(() => {
    if (selectedId && !design.elements.some((e) => e.id === selectedId)) setSelectedId(null);
  }, [design, selectedId]);

  // --- adding things -------------------------------------------------------------------------
  const addElement = (kind: NewKind, at?: { x: number; y: number }) => {
    if (design.elements.length >= LIMITS.maxElements) return toast.error(`A design can hold up to ${LIMITS.maxElements} items.`);
    const el = newElement(kind, design, at);
    commit((d) => normalize({ ...d, elements: [...d.elements, el] }));
    setSelectedId(el.id);
  };

  const addImageFile = async (file: File, at?: { x: number; y: number }) => {
    if (design.elements.length >= LIMITS.maxElements) return toast.error(`A design can hold up to ${LIMITS.maxElements} items.`);
    try {
      const img = await processImageFile(file);
      const el = newImageElement(img.src, { w: img.w, h: img.h }, design, at);
      commit((d) => ({ ...d, elements: [...d.elements, el] }));
      setSelectedId(el.id);
    } catch (e) {
      toast.error(e instanceof ImageError ? e.message : "Could not add this picture.");
    }
  };

  const setBackgroundImage = async (file: File) => {
    try {
      const img = await processImageFile(file);
      commit((d) => ({ ...d, background: { kind: "image", src: img.src, overlay: d.background.kind === "image" ? d.background.overlay : 0.25 } }));
    } catch (e) {
      toast.error(e instanceof ImageError ? e.message : "Could not use this picture.");
    }
  };

  // --- drag and drop onto the canvas ---------------------------------------------------------
  const toDesignPoint = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || scale <= 0) return undefined;
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropping(false);
    const at = toDesignPoint(e.clientX, e.clientY);
    const file = Array.from(e.dataTransfer.files).find((f) => IMAGE_TYPES.includes(f.type));
    if (file) {
      void addImageFile(file, at);
      return;
    }
    if (e.dataTransfer.files.length > 0) {
      toast.error("Please drop a PNG, JPG, WebP or GIF picture.");
      return;
    }
    const kind = e.dataTransfer.getData(DRAG_KIND) as NewKind;
    if (["heading", "paragraph", "rect", "ellipse"].includes(kind)) addElement(kind, at);
  };

  // --- moving and resizing -------------------------------------------------------------------
  const startDrag = (e: React.PointerEvent, el: El, mode: "move" | "resize") => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setSelectedId(el.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current =
      mode === "move"
        ? { mode, id: el.id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y, start: design }
        : { mode, id: el.id, startX: e.clientX, startY: e.clientY, origW: el.w, origH: el.h, start: design };
  };

  const onDragMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || scale <= 0) return;
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    setHistory((h) => {
      const el = h.present.elements.find((x) => x.id === d.id);
      if (!el) return h;
      if (d.mode === "move") {
        const snapped = e.altKey ? { x: d.origX + dx, y: d.origY + dy, guides: { v: null, h: null } } : snapMove(el, d.origX + dx, d.origY + dy, h.present, 10 / scale);
        setGuides(snapped.guides);
        return replacePresent(h, updateElement(h.present, d.id, { x: Math.round(snapped.x), y: Math.round(snapped.y) }));
      }
      const w = Math.max(LIMITS.minSize, Math.round(d.origW + dx));
      let patch: Partial<El> = { w };
      if (el.type === "image") patch = { w, h: Math.max(LIMITS.minSize, Math.round((d.origH / d.origW) * w)) };
      else if (el.type === "shape") patch = { w, h: Math.max(LIMITS.minSize, Math.round(d.origH + dy)) };
      return replacePresent(h, normalize(updateElement(h.present, d.id, patch)));
    });
  };

  const endDrag = () => {
    const d = dragRef.current;
    dragRef.current = null;
    setGuides({ v: null, h: null });
    if (!d) return;
    // One undo step for the whole drag.
    setHistory((h) => (h.present === d.start ? h : { past: [...h.past, d.start].slice(-LIMITS.history), present: h.present, future: [] }));
    lastEdit.current = null;
  };

  // --- keyboard ------------------------------------------------------------------------------
  const onKeyDown = (e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      setHistory((h) => (e.shiftKey ? redo(h) : undo(h)));
    } else if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      setHistory(redo);
    } else if (!selected) {
      return;
    } else if (mod && e.key.toLowerCase() === "d") {
      e.preventDefault();
      duplicate();
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      commit((d) => removeElement(d, selected.id));
    } else if (e.key === "Escape") {
      setSelectedId(null);
    } else if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      commit((d) => updateElement(d, selected.id, { x: selected.x + dx, y: selected.y + dy }), `nudge-${selected.id}`);
    }
  };

  const duplicate = () => {
    if (!selected) return;
    const r = duplicateElement(design, selected.id);
    if (!r.newId) return toast.error(`A design can hold up to ${LIMITS.maxElements} items.`);
    commit(() => r.design);
    setSelectedId(r.newId);
  };

  // --- saving, opening, exporting -------------------------------------------------------------
  const renderToCanvas = async (width: number): Promise<HTMLCanvasElement> => {
    const srcs = design.elements.flatMap((e) => (e.type === "image" ? [e.src] : []));
    if (design.background.kind === "image") srcs.push(design.background.src);
    const images = await loadImageMap(srcs);
    const canvas = document.createElement("canvas");
    const k = width / design.width;
    canvas.width = Math.round(design.width * k);
    canvas.height = Math.round(design.height * k);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser could not draw the picture.");
    renderDesign(ctx, design, images, k);
    return canvas;
  };

  const exportPng = async () => {
    setExporting(true);
    try {
      const canvas = await renderToCanvas(design.width);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Could not create the picture.");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(name.trim() || "design").replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-").slice(0, 60) || "design"}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast.success("Picture downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export the picture.");
    } finally {
      setExporting(false);
    }
  };

  const saveCurrent = async () => {
    try {
      const thumb = (await renderToCanvas(240)).toDataURL("image/jpeg", 0.7);
      const id = currentId ?? `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const next = upsertDesign(saved, { id, name: name.trim().slice(0, 80) || "Untitled design", updatedAt: new Date().toISOString(), thumb, design });
      if (!saveDesigns(storage(), workspaceId, next)) {
        toast.error("This browser has no room left to save. Delete an old design or use smaller pictures.");
        return;
      }
      setSaved(next);
      setCurrentId(id);
      toast.success("Design saved in this browser");
    } catch {
      toast.error("Could not save the design.");
    }
  };

  const openSaved = (item: SavedDesign) => {
    setHistory(startHistory(item.design));
    setCurrentId(item.id);
    setName(item.name);
    setSelectedId(null);
  };
  const deleteSaved = (id: string) => {
    const next = saved.filter((d) => d.id !== id);
    saveDesigns(storage(), workspaceId, next);
    setSaved(next);
    if (currentId === id) setCurrentId(null);
  };
  const applyTemplate = (id: string) => {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    const preset = PRESETS.find((p) => p.width === design.width && p.height === design.height) ?? PRESETS[0];
    commit(() => normalize(t.build(preset)));
    setSelectedId(null);
  };

  const presetId = PRESETS.find((p) => p.width === design.width && p.height === design.height)?.id ?? PRESETS[0].id;
  const bg = design.background;
  const bgStyle: React.CSSProperties =
    bg.kind === "solid"
      ? { background: bg.color }
      : bg.kind === "gradient"
        ? { background: `linear-gradient(${bg.angle}deg, ${bg.from}, ${bg.to})` }
        : { background: "#0f172a" };

  const inputCls = "w-full h-9 px-2.5 rounded-lg bg-slate-100/50 border border-slate-200/60 text-sm text-slate-800 focus:outline-none focus:border-blue-500/50";
  const btnCls = "inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200/70 text-xs font-medium text-slate-700 hover:bg-slate-100/60 disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="space-y-4 animate-fade-in" onKeyDown={onKeyDown}>
      <div className="flex flex-col gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Palette className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Design Studio
          </h2>
          <p className="text-sm text-slate-600 mt-1">Drag a heading, paragraph, picture or shape onto the canvas, choose a background, then download the picture.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="design-size">Canvas size</label>
          <select id="design-size" value={presetId} onChange={(e) => { const p = PRESETS.find((x) => x.id === e.target.value); if (p) commit((d) => resizeCanvas(d, p.width, p.height)); }} className={`${inputCls} w-auto`}>
            {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <label className="sr-only" htmlFor="design-template">Start from a template</label>
          <select id="design-template" value="" onChange={(e) => applyTemplate(e.target.value)} className={`${inputCls} w-auto`}>
            <option value="" disabled>Start from template…</option>
            {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <button onClick={() => setHistory(undo)} disabled={history.past.length === 0} className={btnCls} aria-label="Undo" title="Undo (Ctrl+Z)"><Undo2 className="w-4 h-4" /></button>
          <button onClick={() => setHistory(redo)} disabled={history.future.length === 0} className={btnCls} aria-label="Redo" title="Redo (Ctrl+Y)"><Redo2 className="w-4 h-4" /></button>
          <label className="sr-only" htmlFor="design-name">Design name</label>
          <input id="design-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className={`${inputCls} w-40`} />
          <button onClick={() => void saveCurrent()} className={btnCls}><Save className="w-4 h-4" /> Save</button>
          <button onClick={() => void exportPng()} disabled={exporting} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            <Download className="w-4 h-4" /> {exporting ? "Preparing…" : "Download PNG"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_280px] gap-4">
        {/* Left: things to add + background */}
        <div className="space-y-4">
          <div className="glass rounded-2xl p-4 space-y-2">
            <h3 className="text-sm font-semibold text-slate-900">Add to canvas</h3>
            <p className="text-[11px] text-slate-500">Drag onto the canvas, or click to add in the middle.</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["heading", "Heading", Heading],
                ["paragraph", "Paragraph", Type],
                ["rect", "Box", Square],
                ["ellipse", "Circle", Circle],
              ] as const).map(([kind, label, Icon]) => (
                <button key={kind} draggable onDragStart={(e) => { e.dataTransfer.setData(DRAG_KIND, kind); e.dataTransfer.effectAllowed = "copy"; }} onClick={() => addElement(kind)} className="flex flex-col items-center gap-1 py-3 rounded-xl border border-slate-200/70 text-xs font-medium text-slate-700 hover:bg-blue-500/10 hover:border-blue-500/40 cursor-grab active:cursor-grabbing">
                  <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  {label}
                </button>
              ))}
            </div>
            <button onClick={() => imageInput.current?.click()} className={`${btnCls} w-full`}><ImagePlus className="w-4 h-4" /> Add picture</button>
            <p className="text-[11px] text-slate-500">You can also drop a picture file straight onto the canvas.</p>
            <input ref={imageInput} type="file" accept={IMAGE_TYPES.join(",")} hidden aria-label="Choose a picture" onChange={(e) => { const f = e.target.files?.[0]; if (f) void addImageFile(f); e.target.value = ""; }} />
          </div>

          <div className="glass rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Background</h3>
            <div className="grid grid-cols-3 gap-1" role="group" aria-label="Background type">
              {(["solid", "gradient", "image"] as const).map((k) => (
                <button key={k} aria-pressed={bg.kind === k} onClick={() => {
                  if (k === "solid") commit((d) => ({ ...d, background: { kind: "solid", color: d.background.kind === "solid" ? d.background.color : "#ffffff" } }));
                  else if (k === "gradient") commit((d) => ({ ...d, background: { kind: "gradient", from: "#2563eb", to: "#1e40af", angle: 160 } }));
                  else bgInput.current?.click();
                }} className={`h-8 rounded-lg text-xs font-medium capitalize ${bg.kind === k ? "bg-blue-500/20 text-blue-700 dark:text-blue-300" : "text-slate-600 hover:bg-slate-100/60"}`}>{k === "solid" ? "Colour" : k === "gradient" ? "Blend" : "Picture"}</button>
              ))}
            </div>
            <input ref={bgInput} type="file" accept={IMAGE_TYPES.join(",")} hidden aria-label="Choose a background picture" onChange={(e) => { const f = e.target.files?.[0]; if (f) void setBackgroundImage(f); e.target.value = ""; }} />
            {bg.kind === "solid" && (
              <ColorField label="Background colour" value={bg.color} onChange={(c) => commit((d) => ({ ...d, background: { kind: "solid", color: c } }), "bg")} />
            )}
            {bg.kind === "gradient" && (
              <div className="space-y-2">
                <ColorField label="From" value={bg.from} onChange={(c) => commit((d) => ({ ...d, background: { ...(d.background as typeof bg), from: c } }), "bg-from")} />
                <ColorField label="To" value={bg.to} onChange={(c) => commit((d) => ({ ...d, background: { ...(d.background as typeof bg), to: c } }), "bg-to")} />
                <Slider label="Direction" value={bg.angle} min={0} max={360} step={5} suffix="°" onChange={(v) => commit((d) => ({ ...d, background: { ...(d.background as typeof bg), angle: v } }), "bg-angle")} />
              </div>
            )}
            {bg.kind === "image" && (
              <div className="space-y-2">
                <Slider label="Darken picture" value={Math.round(bg.overlay * 100)} min={0} max={80} step={5} suffix="%" onChange={(v) => commit((d) => ({ ...d, background: { ...(d.background as typeof bg), overlay: v / 100 } }), "bg-overlay")} />
                <button onClick={() => bgInput.current?.click()} className={`${btnCls} w-full`}>Change picture</button>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5" aria-label="Quick colours">
              {SWATCHES.map((c) => (
                <button key={c} aria-label={`Use colour ${c}`} onClick={() => commit((d) => ({ ...d, background: { kind: "solid", color: c } }))} className="w-6 h-6 rounded-md border border-slate-300/70" style={{ background: c }} />
              ))}
            </div>
          </div>
        </div>

        {/* Centre: canvas */}
        <div className="min-w-0">
          <div ref={wrapRef} className="glass rounded-2xl p-3 flex justify-center items-start overflow-hidden">
            <div
              ref={stageRef}
              data-testid="design-stage"
              className={`relative shrink-0 shadow-lg overflow-hidden touch-none ${dropping ? "ring-4 ring-blue-500/50" : ""}`}
              style={{ width: design.width * scale, height: design.height * scale }}
              onPointerDown={() => setSelectedId(null)}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setDropping(true); }}
              onDragLeave={() => setDropping(false)}
              onDrop={onDrop}
            >
              <div style={{ position: "absolute", left: 0, top: 0, width: design.width, height: design.height, transform: `scale(${scale})`, transformOrigin: "top left", ...bgStyle }}>
                {bg.kind === "image" && (
                  <>
                    <img src={bg.src} alt="" draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                    {bg.overlay > 0 && <div style={{ position: "absolute", inset: 0, background: `rgba(15,23,42,${bg.overlay})` }} />}
                  </>
                )}
                {design.elements.map((el) => (
                  <ElementView key={el.id} el={el} scale={scale} selected={el.id === selectedId} onPointerDown={(e) => startDrag(e, el, "move")} onResizeDown={(e) => startDrag(e, el, "resize")} onPointerMove={onDragMove} onPointerUp={endDrag} />
                ))}
                {guides.v !== null && <div style={{ position: "absolute", left: guides.v, top: 0, width: 2 / scale, height: "100%", background: "#ec4899", pointerEvents: "none" }} />}
                {guides.h !== null && <div style={{ position: "absolute", top: guides.h, left: 0, height: 2 / scale, width: "100%", background: "#ec4899", pointerEvents: "none" }} />}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Click an item to edit it. Arrow keys nudge (Shift = 10 px), Delete removes, hold Alt while dragging to turn snapping off.</p>
        </div>

        {/* Right: inspector + saved */}
        <div className="space-y-4">
          <div className="glass rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">{selected ? (selected.type === "text" ? "Text" : selected.type === "image" ? "Picture" : "Shape") : "Item settings"}</h3>
            {!selected && <p className="text-xs text-slate-500">Select an item on the canvas to change its text, colours and size.</p>}
            {selected?.type === "text" && <TextInspector el={selected} commit={commit} inputCls={inputCls} />}
            {selected?.type === "image" && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-600 block">Fit
                  <select value={selected.fit} onChange={(e) => commit((d) => updateElement(d, selected.id, { fit: e.target.value as "cover" | "contain" }))} className={`${inputCls} mt-1`}>
                    <option value="cover">Fill the box (crop)</option>
                    <option value="contain">Show whole picture</option>
                  </select>
                </label>
                <Slider label="Rounded corners" value={selected.radius} min={0} max={Math.round(Math.min(selected.w, selected.h) / 2)} step={2} onChange={(v) => commit((d) => updateElement(d, selected.id, { radius: v }), `r-${selected.id}`)} />
              </div>
            )}
            {selected?.type === "shape" && (
              <div className="space-y-2">
                <ColorField label="Fill colour" value={selected.fill} onChange={(c) => commit((d) => updateElement(d, selected.id, { fill: c }), `f-${selected.id}`)} />
                {selected.shape === "rect" && <Slider label="Rounded corners" value={selected.radius} min={0} max={Math.round(Math.min(selected.w, selected.h) / 2)} step={2} onChange={(v) => commit((d) => updateElement(d, selected.id, { radius: v }), `r-${selected.id}`)} />}
              </div>
            )}
            {selected && (
              <>
                <Slider label="Transparency" value={Math.round((1 - selected.opacity) * 100)} min={0} max={90} step={5} suffix="%" onChange={(v) => commit((d) => updateElement(d, selected.id, { opacity: 1 - v / 100 }), `o-${selected.id}`)} />
                <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Layer order">
                  <button className={btnCls} aria-label="Bring to front" title="Bring to front" onClick={() => commit((d) => moveLayer(d, selected.id, "front"))}><BringToFront className="w-4 h-4" /></button>
                  <button className={btnCls} aria-label="Move forward" title="Forward" onClick={() => commit((d) => moveLayer(d, selected.id, "up"))}><ArrowUp className="w-4 h-4" /></button>
                  <button className={btnCls} aria-label="Move backward" title="Backward" onClick={() => commit((d) => moveLayer(d, selected.id, "down"))}><ArrowDown className="w-4 h-4" /></button>
                  <button className={btnCls} aria-label="Send to back" title="Send to back" onClick={() => commit((d) => moveLayer(d, selected.id, "back"))}><SendToBack className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button className={btnCls} onClick={duplicate}><Copy className="w-4 h-4" /> Duplicate</button>
                  <button className={`${btnCls} text-red-700 dark:text-red-300`} onClick={() => commit((d) => removeElement(d, selected.id))}><Trash2 className="w-4 h-4" /> Delete</button>
                </div>
              </>
            )}
          </div>

          <div className="glass rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><FolderOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" /> My designs</h3>
            {saved.length === 0 ? (
              <p className="text-xs text-slate-500">Nothing saved yet. Designs are saved in this browser, on this computer.</p>
            ) : (
              <ul className="space-y-2">
                {saved.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <button onClick={() => openSaved(s)} className="flex items-center gap-2 flex-1 min-w-0 text-left rounded-lg hover:bg-slate-100/60 p-1">
                      {s.thumb ? <img src={s.thumb} alt="" className="w-10 h-10 rounded object-cover border border-slate-200/70" /> : <div className="w-10 h-10 rounded bg-slate-200" />}
                      <span className="min-w-0"><span className="block text-xs font-medium text-slate-800 truncate">{s.name}</span><span className="block text-[10px] text-slate-500">{new Date(s.updatedAt).toLocaleDateString()}</span></span>
                    </button>
                    <button onClick={() => deleteSaved(s.id)} aria-label={`Delete ${s.name}`} className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-500/10"><Trash2 className="w-3.5 h-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------

function ElementView({
  el, scale, selected, onPointerDown, onResizeDown, onPointerMove, onPointerUp,
}: {
  el: El;
  scale: number;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onResizeDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
}) {
  const handle = 16 / Math.max(scale, 0.05);
  const label = el.type === "text" ? `Text: ${el.text.slice(0, 30)}` : el.type === "image" ? "Picture" : "Shape";
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={selected}
      data-el-id={el.id}
      data-el-type={el.type}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ position: "absolute", left: el.x, top: el.y, width: el.w, height: el.h, opacity: el.opacity, cursor: "move", touchAction: "none", outline: selected ? `${2 / Math.max(scale, 0.05)}px solid #2563eb` : "none", outlineOffset: 0 }}
    >
      {el.type === "text" && <TextLines el={el} />}
      {el.type === "image" && <img src={el.src} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: el.fit, borderRadius: el.radius, display: "block", pointerEvents: "none" }} />}
      {el.type === "shape" && <div style={{ width: "100%", height: "100%", background: el.fill, borderRadius: el.shape === "ellipse" ? "50%" : el.radius, pointerEvents: "none" }} />}
      {selected && (
        <div
          aria-label="Resize"
          data-testid="resize-handle"
          onPointerDown={onResizeDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{ position: "absolute", right: -handle / 2, bottom: -handle / 2, width: handle, height: handle, background: "#fff", border: `${2 / Math.max(scale, 0.05)}px solid #2563eb`, borderRadius: 3, cursor: "nwse-resize", touchAction: "none" }}
        />
      )}
    </div>
  );
}

function TextLines({ el }: { el: TextEl }) {
  const lines = useMemo(() => layoutText(el.text, el.w, fontString(el), measure), [el]);
  const lh = lineHeightPx(el.fontSize);
  return (
    <div style={{ pointerEvents: "none", userSelect: "none" }}>
      {lines.map((line, i) => (
        <div key={i} style={{ height: lh, lineHeight: `${lh}px`, whiteSpace: "pre", textAlign: el.align, font: fontString(el), color: el.color }}>
          {line}
        </div>
      ))}
    </div>
  );
}

function TextInspector({ el, commit, inputCls }: { el: TextEl; commit: (u: (d: Design) => Design, key?: string) => void; inputCls: string }) {
  const set = (patch: Partial<TextEl>, key?: string) => commit((d) => updateElement(d, el.id, patch), key ? `${key}-${el.id}` : undefined);
  const alignBtn = (a: TextEl["align"], Icon: typeof AlignLeft, label: string) => (
    <button aria-label={label} aria-pressed={el.align === a} onClick={() => set({ align: a })} className={`h-9 rounded-lg border text-xs flex items-center justify-center ${el.align === a ? "bg-blue-500/20 border-blue-500/40 text-blue-700 dark:text-blue-300" : "border-slate-200/70 text-slate-700 hover:bg-slate-100/60"}`}>
      <Icon className="w-4 h-4" />
    </button>
  );
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-slate-600 block">Text
        <textarea data-testid="text-input" value={el.text} maxLength={LIMITS.maxText} rows={3} onChange={(e) => set({ text: e.target.value }, "text")} className="mt-1 w-full px-2.5 py-2 rounded-lg bg-slate-100/50 border border-slate-200/60 text-sm text-slate-800 focus:outline-none focus:border-blue-500/50 resize-y" />
      </label>
      <label className="text-xs font-medium text-slate-600 block">Font
        <select value={el.font} onChange={(e) => set({ font: e.target.value as FontFamily })} className={`${inputCls} mt-1`} style={{ fontFamily: FONT_STACKS[el.font] }}>
          {(Object.keys(FONT_STACKS) as FontFamily[]).map((f) => <option key={f} value={f}>{FONT_LABELS[f]}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-medium text-slate-600 block">Weight
          <select value={el.fontWeight} onChange={(e) => set({ fontWeight: Number(e.target.value) as TextEl["fontWeight"] })} className={`${inputCls} mt-1`}>
            <option value={400}>Regular</option>
            <option value={700}>Bold</option>
            <option value={900}>Extra bold</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600 block">Size
          <input type="number" min={LIMITS.minFont} max={LIMITS.maxFont} value={el.fontSize} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) set({ fontSize: Math.min(LIMITS.maxFont, Math.max(LIMITS.minFont, Math.round(n))) }, "size"); }} className={`${inputCls} mt-1`} />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Alignment">
        {alignBtn("left", AlignLeft, "Align left")}
        {alignBtn("center", AlignCenter, "Align centre")}
        {alignBtn("right", AlignRight, "Align right")}
      </div>
      <ColorField label="Text colour" value={el.color} onChange={(c) => set({ color: c }, "color")} />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs font-medium text-slate-600">
      {label}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} className="w-12 h-8 rounded-md border border-slate-200/70 bg-transparent cursor-pointer" />
    </label>
  );
}

function Slider({ label, value, min, max, step, suffix = "", onChange }: { label: string; value: number; min: number; max: number; step: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      <span className="flex justify-between"><span>{label}</span><span className="text-slate-500">{value}{suffix}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-blue-600" />
    </label>
  );
}

