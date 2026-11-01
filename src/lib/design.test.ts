import { describe, expect, it } from "vitest";
import {
  PRESETS, TEMPLATES, blankDesign, duplicateElement, fitRect, fitTextHeights, gradientPoints, layoutText, moveLayer, newElement,
  newImageElement, parseDesign, pushHistory, redo, removeElement, replacePresent, resizeCanvas, snapMove, startHistory, textHeight,
  undo, updateElement, LIMITS, type Design, type TextEl,
} from "./design";

// 10px per character, so wrapping is easy to predict.
const measure = (t: string) => t.length * 10;
const canvas = { width: 1000, height: 1000 };

describe("layoutText", () => {
  it("keeps short text on one line", () => expect(layoutText("hello world", 500, "f", measure)).toEqual(["hello world"]));
  it("wraps on spaces", () => expect(layoutText("aaa bbb ccc", 70, "f", measure)).toEqual(["aaa bbb", "ccc"]));
  it("respects new lines and blank lines", () => expect(layoutText("a\n\nb", 500, "f", measure)).toEqual(["a", "", "b"]));
  it("breaks a word that is wider than the box", () => expect(layoutText("abcdefghij", 40, "f", measure)).toEqual(["abcd", "efgh", "ij"]));
  it("handles empty text and windows line endings", () => {
    expect(layoutText("", 100, "f", measure)).toEqual([""]);
    expect(layoutText("a\r\nb", 100, "f", measure)).toEqual(["a", "b"]);
  });
  it("collapses repeated spaces", () => expect(layoutText("a    b", 500, "f", measure)).toEqual(["a b"]));
  it("works with emoji and non Latin text", () => expect(layoutText("سلام دنیا 🚀", 500, "f", measure)).toHaveLength(1));
});

describe("snapMove", () => {
  const box = { w: 200, h: 100 };
  it("snaps the centre to the canvas centre and reports guides", () => {
    const r = snapMove(box, 395, 447, canvas, 8);
    expect(r).toMatchObject({ x: 400, y: 450, guides: { v: 500, h: 500 } });
  });
  it("snaps to the left edge", () => expect(snapMove(box, 5, 300, canvas, 8)).toMatchObject({ x: 0, guides: { v: 0 } }));
  it("does not snap when far away", () => expect(snapMove(box, 100, 100, canvas, 8)).toMatchObject({ x: 100, y: 100, guides: { v: null, h: null } }));
  it("keeps part of the box on the canvas", () => {
    const r = snapMove(box, -5000, 9000, canvas, 0);
    expect(r.x).toBeGreaterThan(-box.w);
    expect(r.y).toBeLessThan(canvas.height);
  });
});

describe("geometry helpers", () => {
  it("cover crops, contain letterboxes", () => {
    const cover = fitRect(200, 100, 100, 100, "cover");
    expect(cover).toMatchObject({ sx: 50, sy: 0, sw: 100, sh: 100, dw: 100, dh: 100 });
    const contain = fitRect(200, 100, 100, 100, "contain");
    expect(contain).toMatchObject({ dx: 0, dy: 25, dw: 100, dh: 50 });
    expect(fitRect(0, 0, 10, 10, "cover").dw).toBe(10);
  });
  it("gradient 180deg runs top to bottom", () => {
    const g = gradientPoints(100, 200, 180);
    expect(Math.round(g.x0)).toBe(50);
    expect(Math.round(g.y0)).toBe(0);
    expect(Math.round(g.y1)).toBe(200);
  });
});

describe("editing", () => {
  const base = (): Design => ({ ...blankDesign(), elements: [newElement("heading", canvas), newElement("paragraph", canvas), newElement("rect", canvas)] });
  it("creates sensible elements inside the canvas", () => {
    for (const k of ["heading", "paragraph", "rect", "ellipse"] as const) {
      const e = newElement(k, canvas, { x: 0, y: 0 });
      expect(e.x).toBeGreaterThanOrEqual(0);
      expect(e.y).toBeGreaterThanOrEqual(0);
      expect(e.w).toBeGreaterThan(0);
    }
    expect((newElement("ellipse", canvas) as any).shape).toBe("ellipse");
  });
  it("sizes images to fit and centres them at the drop point", () => {
    const img = newImageElement("data:image/png;base64,AA", { w: 4000, h: 2000 }, canvas, { x: 500, y: 500 });
    expect(img.w).toBeLessThanOrEqual(600);
    expect(img.w / img.h).toBeCloseTo(2, 1);
    expect(img.x + img.w / 2).toBeCloseTo(500, -1);
  });
  it("updates, removes, duplicates and reorders without touching the original", () => {
    const d = base();
    const id = d.elements[0].id;
    const updated = updateElement(d, id, { x: 5 } as any);
    expect(updated.elements[0].x).toBe(5);
    expect(d.elements[0].x).not.toBe(5);
    expect(removeElement(d, id).elements).toHaveLength(2);
    const dup = duplicateElement(d, id);
    expect(dup.design.elements).toHaveLength(4);
    expect(dup.newId).not.toBe(id);
    expect(moveLayer(d, id, "front").elements[2].id).toBe(id);
    expect(moveLayer(moveLayer(d, id, "front"), id, "back").elements[0].id).toBe(id);
    expect(moveLayer(d, d.elements[1].id, "up").elements[2].id).toBe(d.elements[1].id);
    expect(moveLayer(d, d.elements[1].id, "down").elements[0].id).toBe(d.elements[1].id);
    expect(moveLayer(d, "nope", "front")).toBe(d);
  });
  it("refuses to duplicate past the element limit", () => {
    let d = blankDesign();
    for (let i = 0; i < LIMITS.maxElements; i++) d = { ...d, elements: [...d.elements, newElement("rect", canvas)] };
    expect(duplicateElement(d, d.elements[0].id).newId).toBeNull();
  });
  it("resizes the canvas and scales content", () => {
    const d = { ...blankDesign(PRESETS[0]), elements: [newElement("heading", { width: 1080, height: 1080 })] };
    const r = resizeCanvas(d, 1080, 1920);
    expect(r.height).toBe(1920);
    expect(r.elements[0].w).toBe(d.elements[0].w);
    expect(r.elements[0].y).toBeGreaterThan(d.elements[0].y);
  });
  it("fits text height to its content, and leaves unchanged designs alone", () => {
    const t = { ...(newElement("paragraph", canvas) as TextEl), text: "x ".repeat(200), w: 300, fontSize: 20, h: 1 };
    const d = fitTextHeights({ ...blankDesign(), elements: [t] }, measure);
    expect(d.elements[0].h).toBeGreaterThan(100);
    expect(fitTextHeights(d, measure)).toBe(d);
    expect(textHeight(3, 20)).toBe(75);
  });
});

describe("history", () => {
  it("undoes, redoes and drops redo after a new change", () => {
    const a = blankDesign(), b = { ...a, width: 1100 }, c = { ...a, width: 1200 };
    let h = startHistory(a);
    h = pushHistory(h, b);
    h = pushHistory(h, c);
    h = undo(h);
    expect(h.present).toBe(b);
    h = redo(h);
    expect(h.present).toBe(c);
    h = undo(undo(h));
    expect(h.present).toBe(a);
    expect(undo(h)).toBe(h);
    h = pushHistory(h, c);
    expect(h.future).toHaveLength(0);
    expect(redo(h)).toBe(h);
  });
  it("replacePresent adds no undo step, same state adds none either, history is capped", () => {
    const a = blankDesign();
    let h = replacePresent(startHistory(a), { ...a, width: 1500 });
    expect(h.past).toHaveLength(0);
    expect(pushHistory(h, h.present)).toBe(h);
    for (let i = 0; i < LIMITS.history + 20; i++) h = pushHistory(h, { ...a, width: 1000 + i });
    expect(h.past).toHaveLength(LIMITS.history);
  });
});

describe("templates", () => {
  it.each(PRESETS.map((p) => [p.id, p] as const))("every template builds inside the %s canvas and survives a save/load", (_id, preset) => {
    for (const t of TEMPLATES) {
      const d = t.build(preset);
      expect(d.width).toBe(preset.width);
      for (const e of d.elements) {
        expect(e.x).toBeGreaterThanOrEqual(0);
        expect(e.x + e.w).toBeLessThanOrEqual(d.width + 1);
      }
      expect(parseDesign(JSON.parse(JSON.stringify(d)))).not.toBeNull();
    }
  });
});

describe("parseDesign (loading from storage)", () => {
  const good = () => JSON.parse(JSON.stringify(TEMPLATES[1].build(PRESETS[0])));
  it("accepts a valid design", () => expect(parseDesign(good())?.elements.length).toBeGreaterThan(0));
  it.each([null, "x", 5, {}, { version: 2 }, { version: 1, width: 10, height: 10, elements: [] }, { version: 1, width: 1080, height: 1080, elements: "no" }])("rejects %j", (bad) => expect(parseDesign(bad)).toBeNull());
  it("rejects broken or unknown elements", () => {
    const d = good();
    d.elements[0] = { ...d.elements[0], type: "script" };
    expect(parseDesign(d)).toBeNull();
    const e = good();
    e.elements[0].x = "5";
    expect(parseDesign(e)).toBeNull();
  });
  it("neutralises unsafe values: colours, image sources, limits", () => {
    const d = good();
    d.elements[0].color = "red;background:url(x)";
    d.elements[0].fontSize = 99999;
    d.background = { kind: "image", src: "https://evil.example/x.png", overlay: 5 };
    const p = parseDesign(d)!;
    expect((p.elements[0] as TextEl).color).toBe("#0f172a");
    expect((p.elements[0] as TextEl).fontSize).toBe(LIMITS.maxFont);
    expect(p.background).toEqual({ kind: "solid", color: "#ffffff" });
    const withImage = parseDesign({ ...good(), elements: [{ id: "i", type: "image", x: 0, y: 0, w: 10, h: 10, src: "javascript:alert(1)" }] });
    expect(withImage).toBeNull();
    const okImage = parseDesign({ ...good(), background: { kind: "image", src: "data:image/png;base64,AAAA", overlay: 5 } })!;
    expect((okImage.background as any).overlay).toBe(0.8);
  });
  it("rejects too many elements", () => {
    const d = good();
    d.elements = Array.from({ length: LIMITS.maxElements + 1 }, (_, i) => ({ ...good().elements[0], id: "e" + i }));
    expect(parseDesign(d)).toBeNull();
  });
});
