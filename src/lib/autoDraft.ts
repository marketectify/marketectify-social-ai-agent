import type { Message } from "../types";

/** Most drafts written in one go, so a long inbox cannot use up the daily AI limit. */
export const AUTO_DRAFT_BATCH = 5;
const MAX_STORED = 200;

export interface AutoDraftState {
  enabled: boolean;
  /** Message id -> the reply the AI suggested. */
  drafts: Record<string, string>;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const key = (workspaceId: string) => `marketectify.autodraft.v1.${workspaceId}`;

export function loadAutoDraft(storage: StorageLike | null, workspaceId: string): AutoDraftState {
  try {
    const raw = storage?.getItem(key(workspaceId));
    if (!raw) return { enabled: false, drafts: {} };
    const parsed = JSON.parse(raw) as { enabled?: unknown; drafts?: unknown };
    const drafts: Record<string, string> = {};
    if (parsed.drafts && typeof parsed.drafts === "object") {
      for (const [id, text] of Object.entries(parsed.drafts as Record<string, unknown>)) {
        if (typeof text === "string" && text.trim()) drafts[id] = text;
      }
    }
    return { enabled: parsed.enabled === true, drafts };
  } catch {
    return { enabled: false, drafts: {} };
  }
}

export function saveAutoDraft(storage: StorageLike | null, workspaceId: string, state: AutoDraftState): void {
  try {
    const ids = Object.keys(state.drafts);
    const drafts = ids.length > MAX_STORED ? Object.fromEntries(ids.slice(-MAX_STORED).map((id) => [id, state.drafts[id]])) : state.drafts;
    storage?.setItem(key(workspaceId), JSON.stringify({ enabled: state.enabled, drafts }));
  } catch {
    /* storage full or blocked: the drafts are only a convenience */
  }
}

/** Messages that still need a first reply and have no draft yet, newest first. */
export function pickForDrafting(messages: Message[], drafts: Record<string, string>, max = AUTO_DRAFT_BATCH): Message[] {
  return messages
    .filter((m) => m.status !== "replied" && !(m.reply ?? "").trim() && !drafts[m.id] && m.body.trim().length >= 3)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    .slice(0, max);
}

/** Forgets drafts of messages that were deleted or already answered. */
export function pruneDrafts(drafts: Record<string, string>, messages: Message[]): Record<string, string> {
  const open = new Set(messages.filter((m) => m.status !== "replied").map((m) => m.id));
  return Object.fromEntries(Object.entries(drafts).filter(([id]) => open.has(id)));
}
