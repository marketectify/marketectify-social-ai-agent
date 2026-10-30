import { describe, expect, it } from "vitest";
import { loadDesigns, saveDesigns, upsertDesign, type SavedDesign } from "./designStore";
import { TEMPLATES, PRESETS } from "./design";

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const item = (id: string, at: string): SavedDesign => ({ id, name: "N" + id, updatedAt: at, thumb: "data:image/jpeg;base64,AA", design: TEMPLATES[1].build(PRESETS[0]) });

describe("design store", () => {
  it("saves and loads newest first, per workspace", () => {
    const s = mem();
    expect(saveDesigns(s, "w1", [item("a", "2026-01-01T00:00:00Z"), item("b", "2026-02-01T00:00:00Z")])).toBe(true);
    expect(loadDesigns(s, "w1").map((d) => d.id)).toEqual(["b", "a"]);
    expect(loadDesigns(s, "w2")).toEqual([]);
  });
  it("replaces an existing design and puts it first", () => {
    const list = upsertDesign([item("a", "1"), item("b", "2")], { ...item("b", "3"), name: "Renamed" });
    expect(list.map((d) => d.id)).toEqual(["b", "a"]);
    expect(list[0].name).toBe("Renamed");
  });
  it("survives corrupt data and skips broken entries", () => {
    const s = mem();
    s.setItem("marketectify.designs.v1.w", "{not json");
    expect(loadDesigns(s, "w")).toEqual([]);
    s.setItem("marketectify.designs.v1.w", JSON.stringify([{ id: "x", name: "n", design: { version: 9 } }, item("ok", "2026-01-01T00:00:00Z")]));
    expect(loadDesigns(s, "w").map((d) => d.id)).toEqual(["ok"]);
  });
  it("reports a full or blocked storage instead of throwing", () => {
    const full = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
    expect(saveDesigns(full, "w", [item("a", "1")])).toBe(false);
    expect(saveDesigns(null, "w", [])).toBe(false);
    expect(loadDesigns(null, "w")).toEqual([]);
  });
});
