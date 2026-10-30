import { parseDesign, type Design } from "./design";

export interface SavedDesign {
  id: string;
  name: string;
  updatedAt: string;
  /** Small JPEG preview (data address). */
  thumb: string;
  design: Design;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const key = (workspaceId: string) => `marketectify.designs.v1.${workspaceId}`;

export function loadDesigns(storage: StorageLike | null, workspaceId: string): SavedDesign[] {
  try {
    const raw = storage?.getItem(key(workspaceId));
    if (!raw) return [];
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const out: SavedDesign[] = [];
    for (const item of list) {
      const design = parseDesign((item as { design?: unknown })?.design);
      if (!design || typeof item.id !== "string" || typeof item.name !== "string") continue;
      out.push({
        id: item.id,
        name: item.name.slice(0, 80),
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date(0).toISOString(),
        thumb: typeof item.thumb === "string" && item.thumb.startsWith("data:image/") ? item.thumb : "",
        design,
      });
    }
    return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

/** Returns false when the browser storage is full or blocked, so the screen can say so. */
export function saveDesigns(storage: StorageLike | null, workspaceId: string, designs: SavedDesign[]): boolean {
  try {
    if (!storage) return false;
    storage.setItem(key(workspaceId), JSON.stringify(designs));
    return true;
  } catch {
    return false;
  }
}

export function upsertDesign(list: SavedDesign[], item: SavedDesign): SavedDesign[] {
  const rest = list.filter((d) => d.id !== item.id);
  return [item, ...rest];
}
