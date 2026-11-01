import { describe, expect, it } from "vitest";
import { AUTO_DRAFT_BATCH, loadAutoDraft, pickForDrafting, pruneDrafts, saveAutoDraft } from "./autoDraft";
import type { Message } from "../types";

const msg = (id: string, over: Partial<Message> = {}): Message => ({
  id, platform: "instagram", kind: "comment", senderName: "A", senderHandle: "@a", body: "What is the price?",
  status: "unread", reply: null, receivedAt: `2026-11-0${id.length}T10:00:00Z`, repliedAt: null, isLead: false, ...over,
});
const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

describe("pickForDrafting", () => {
  it("skips replied messages, messages with a reply or a draft, and too-short text", () => {
    const list = [msg("a"), msg("bb", { status: "replied" }), msg("ccc", { reply: "done" }), msg("dddd"), msg("eeeee", { body: "hi" }), msg("ffffff", { status: "read" })];
    expect(pickForDrafting(list, { dddd: "draft" }).map((m) => m.id)).toEqual(["ffffff", "a"]);
  });
  it("takes the newest first and never more than the batch size", () => {
    const list = Array.from({ length: 9 }, (_, i) => msg("x".repeat(i + 1)));
    const picked = pickForDrafting(list, {});
    expect(picked).toHaveLength(AUTO_DRAFT_BATCH);
    expect(picked[0].id).toBe("x".repeat(9));
  });
});

describe("pruneDrafts", () => {
  it("drops drafts of deleted or replied messages", () => {
    expect(pruneDrafts({ a: "1", b: "2", c: "3" }, [msg("a"), msg("b", { status: "replied" })])).toEqual({ a: "1" });
  });
});

describe("storage", () => {
  it("round-trips and ignores bad data", () => {
    const s = memory();
    expect(loadAutoDraft(s, "w")).toEqual({ enabled: false, drafts: {} });
    saveAutoDraft(s, "w", { enabled: true, drafts: { a: "hello", b: "  " } });
    expect(loadAutoDraft(s, "w")).toEqual({ enabled: true, drafts: { a: "hello" } });
    expect(loadAutoDraft(s, "other")).toEqual({ enabled: false, drafts: {} });
    s.setItem("marketectify.autodraft.v1.bad", "{not json");
    expect(loadAutoDraft(s, "bad")).toEqual({ enabled: false, drafts: {} });
    expect(() => saveAutoDraft(null, "w", { enabled: true, drafts: {} })).not.toThrow();
  });
});
