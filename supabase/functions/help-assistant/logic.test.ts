import { describe, expect, it } from "vitest";
import { buildHelpRequest, handleHelp, validateChat, HELP_LIMITS, HELP_SYSTEM_INSTRUCTION } from "./logic";
import type { Deps } from "../generate-content/logic";

const SECRET = "SECRET-KEY-VALUE-123";
const ok = (text: string) => ({ status: 200, body: { candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }] } });

function makeDeps(over: Partial<Deps> = {}) {
  const calls = { gemini: [] as { model: string; body: unknown }[], consumed: 0, released: 0, logs: [] as string[] };
  const deps: Deps = {
    models: ["m-a", "m-b"],
    dailyLimit: 5,
    geminiConfigured: true,
    getUser: async (a) => (a === "Bearer good" ? { id: "u1" } : null),
    consumeQuota: async () => ({ allowed: true, used: ++calls.consumed }),
    releaseQuota: async () => {
      calls.released++;
    },
    callGemini: async (model, body) => {
      calls.gemini.push({ model, body });
      return ok("Design Studio tab kholein aur Heading drag karein.");
    },
    log: (m) => calls.logs.push(m),
    ...over,
  };
  return { deps, calls };
}

const post = (body: unknown, auth: string | null = "Bearer good", method = "POST") =>
  new Request("https://x.test/help", {
    method,
    headers: auth ? { authorization: auth } : {},
    body: method === "POST" ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
  });

const chat = (text = "Design Studio kya hai?") => ({ messages: [{ role: "user", text }] });

describe("validateChat", () => {
  it("accepts a normal question", () => {
    const r = validateChat(chat());
    expect(r.ok && r.messages).toEqual([{ role: "user", text: "Design Studio kya hai?" }]);
  });
  it("rejects bad shapes, empty, too long and a last message from the model", () => {
    expect(validateChat(null).ok).toBe(false);
    expect(validateChat({ messages: [] }).ok).toBe(false);
    expect(validateChat({ messages: [{ role: "admin", text: "x" }] }).ok).toBe(false);
    expect(validateChat({ messages: [{ role: "user", text: "   " }] }).ok).toBe(false);
    expect(validateChat(chat("a".repeat(HELP_LIMITS.messageMax + 1))).ok).toBe(false);
    expect(validateChat({ messages: [{ role: "user", text: "hi" }, { role: "model", text: "hello" }] }).ok).toBe(false);
  });
  it("keeps only the latest messages and starts with the user", () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 === 0 ? "user" : "model", text: `m${i}` }));
    messages.push({ role: "user", text: "last" });
    const r = validateChat({ messages });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.messages.length).toBeLessThanOrEqual(HELP_LIMITS.maxMessages);
      expect(r.messages[0].role).toBe("user");
      expect(r.messages.at(-1)?.text).toBe("last");
    }
  });
  it("strips control characters", () => {
    const r = validateChat(chat("hello\u0000world"));
    expect(r.ok && r.messages[0].text).toBe("hello world");
  });
});

describe("buildHelpRequest", () => {
  it("puts the guide in the system instruction and the chat in contents", () => {
    const body = buildHelpRequest([{ role: "user", text: "hi" }]) as any;
    expect(body.systemInstruction.parts[0].text).toBe(HELP_SYSTEM_INSTRUCTION);
    expect(HELP_SYSTEM_INSTRUCTION).toContain("Design Studio");
    expect(HELP_SYSTEM_INSTRUCTION).toContain("GEMINI_API_KEY");
    expect(body.contents).toEqual([{ role: "user", parts: [{ text: "hi" }] }]);
  });
  it("never contains a secret value", () => {
    expect(JSON.stringify(buildHelpRequest([{ role: "user", text: "hi" }]))).not.toContain(SECRET);
  });
});

describe("handleHelp", () => {
  it("answers a signed-in user and reports usage", async () => {
    const { deps, calls } = makeDeps();
    const res = await handleHelp(post(chat()), deps);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toContain("Heading");
    expect(body.model).toBe("m-a");
    expect(body.usage).toEqual({ used: 1, limit: 5 });
    expect(calls.gemini).toHaveLength(1);
  });
  it("handles CORS preflight and wrong methods", async () => {
    const { deps } = makeDeps();
    expect((await handleHelp(post(null, null, "OPTIONS"), deps)).status).toBe(204);
    expect((await handleHelp(new Request("https://x.test", { method: "GET" }), deps)).status).toBe(405);
  });
  it("rejects users who are not signed in, without using quota or Gemini", async () => {
    const { deps, calls } = makeDeps();
    expect((await handleHelp(post(chat(), null), deps)).status).toBe(401);
    expect((await handleHelp(post(chat(), "Bearer bad"), deps)).status).toBe(401);
    expect(calls.consumed + calls.gemini.length).toBe(0);
  });
  it("says when the Gemini key is missing", async () => {
    const { deps } = makeDeps({ geminiConfigured: false });
    const res = await handleHelp(post(chat()), deps);
    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe("ai_not_configured");
  });
  it("returns 400 for bad JSON / bad chat and 413 for huge bodies", async () => {
    const { deps, calls } = makeDeps();
    expect((await handleHelp(post("{nope"), deps)).status).toBe(400);
    expect((await handleHelp(post({ messages: [] }), deps)).status).toBe(400);
    expect((await handleHelp(post("x".repeat(HELP_LIMITS.bodyBytes + 1)), deps)).status).toBe(413);
    expect(calls.consumed).toBe(0);
  });
  it("stops at the daily limit", async () => {
    const { deps, calls } = makeDeps({ consumeQuota: async () => ({ allowed: false, used: 5 }) });
    const res = await handleHelp(post(chat()), deps);
    expect(res.status).toBe(429);
    expect((await res.json()).error.code).toBe("quota_exceeded");
    expect(calls.gemini).toHaveLength(0);
  });
  it("tries the next model when one is missing (404)", async () => {
    const { deps, calls } = makeDeps({
      callGemini: async (model) => (model === "m-a" ? { status: 404, body: {} } : ok("ok jawab")),
    });
    const res = await handleHelp(post(chat()), deps);
    expect(res.status).toBe(200);
    expect((await res.json()).model).toBe("m-b");
    expect(calls.released).toBe(0);
  });
  it("gives the use back when the AI fails", async () => {
    for (const [status, code] of [[403, "ai_key_invalid"], [429, "ai_busy"], [500, "ai_unavailable"]] as const) {
      const { deps, calls } = makeDeps({ callGemini: async () => ({ status, body: { error: { message: `leak ${SECRET}` } } }) });
      const res = await handleHelp(post(chat()), deps);
      expect((await res.json()).error.code).toBe(code);
      expect(calls.released).toBe(1);
      expect(JSON.stringify(calls.logs)).not.toContain(SECRET);
    }
  });
  it("reports all-models-missing and network failures", async () => {
    const a = makeDeps({ callGemini: async () => ({ status: 404, body: {} }) });
    expect((await (await handleHelp(post(chat()), a.deps)).json()).error.code).toBe("ai_model_missing");
    const b = makeDeps({ callGemini: async () => { throw new Error("down"); } });
    expect((await (await handleHelp(post(chat()), b.deps)).json()).error.code).toBe("ai_unreachable");
  });
  it("reports blocked and empty answers", async () => {
    const blocked = makeDeps({ callGemini: async () => ({ status: 200, body: { promptFeedback: { blockReason: "SAFETY" } } }) });
    expect((await handleHelp(post(chat()), blocked.deps)).status).toBe(422);
    const empty = makeDeps({ callGemini: async () => ({ status: 200, body: {} }) });
    expect((await handleHelp(post(chat()), empty.deps)).status).toBe(502);
  });
  it("clips very long answers", async () => {
    const { deps } = makeDeps({ callGemini: async () => ok("a".repeat(HELP_LIMITS.replyMax + 500)) });
    expect((await (await handleHelp(post(chat()), deps)).json()).reply).toHaveLength(HELP_LIMITS.replyMax);
  });
});
