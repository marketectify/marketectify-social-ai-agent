import { useEffect, useRef, useState } from "react";
import { LifeBuoy, Send, X, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { askHelp, HELP_LIMITS, SUGGESTIONS, type ChatMessage } from "../lib/helpChat";

interface Line extends ChatMessage {
  id: number;
  failed?: boolean;
}

/** Floating help chat (bottom right). Answers questions about the app using Gemini. */
export default function HelpAssistant() {
  const { mode } = useAuth();
  const demo = mode === "demo";
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [lines, busy, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy || demo) return;
    const userLine: Line = { id: nextId.current++, role: "user", text: question };
    const history = [...lines.filter((l) => !l.failed), userLine];
    setLines([...lines, userLine]);
    setInput("");
    setBusy(true);
    try {
      const res = await askHelp(history);
      setUsage(res.usage);
      setLines((prev) => [...prev, { id: nextId.current++, role: "model", text: res.reply }]);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong. Please try again.";
      setLines((prev) => [...prev, { id: nextId.current++, role: "model", text: message, failed: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open help assistant"
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 h-12 px-4 rounded-full bg-blue-600 text-white text-sm font-semibold shadow-lg hover:bg-blue-700 transition-colors"
        >
          <LifeBuoy className="w-5 h-5" aria-hidden="true" />
          <span className="hidden sm:inline">Help</span>
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="Help assistant"
          className="fixed z-50 bottom-0 right-0 sm:bottom-5 sm:right-5 w-full sm:w-[400px] h-[min(560px,100dvh)] sm:h-[560px] sm:rounded-2xl glass border border-slate-200/80 shadow-2xl flex flex-col overflow-hidden bg-surface"
        >
          <header className="flex items-center gap-2 px-4 h-14 shrink-0 border-b border-slate-200/70">
            <LifeBuoy className="w-5 h-5 text-blue-600" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-slate-900 leading-tight">Help assistant</h2>
              <p className="text-[11px] text-slate-600 truncate">
                {usage ? `AI uses today: ${usage.used}/${usage.limit}` : "Ask how anything in this app works"}
              </p>
            </div>
            {lines.length > 0 && (
              <button
                type="button"
                onClick={() => setLines([])}
                aria-label="Clear chat"
                className="p-2 rounded-lg text-slate-600 hover:bg-slate-100/60"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close help assistant"
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100/60"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" aria-live="polite">
            {demo && (
              <p role="status" className="text-xs text-amber-900 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                The assistant is switched off in demo mode because it needs a signed-in account and the database connection.
              </p>
            )}
            {lines.length === 0 && !demo && (
              <div className="space-y-2">
                <p className="text-sm text-slate-700">Assalam o alaikum! Mujh se is app ke baare mein kuch bhi poochein.</p>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="block w-full text-left text-xs px-3 py-2 rounded-xl border border-slate-200/80 text-slate-700 hover:bg-slate-100/60"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {lines.map((l) => (
              <div key={l.id} className={`flex ${l.role === "user" ? "justify-end" : "justify-start"}`}>
                <p
                  role={l.failed ? "alert" : undefined}
                  className={`max-w-[85%] whitespace-pre-wrap break-words text-sm rounded-2xl px-3 py-2 ${
                    l.role === "user"
                      ? "bg-blue-600 text-white"
                      : l.failed
                        ? "bg-red-500/10 border border-red-500/30 text-red-800 dark:text-red-300"
                        : "bg-slate-100/70 text-slate-800"
                  }`}
                >
                  {l.text}
                </p>
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-slate-600" role="status">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Soch raha hoon…
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            className="flex items-end gap-2 p-3 shrink-0 border-t border-slate-200/70"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              maxLength={HELP_LIMITS.messageMax}
              disabled={demo}
              aria-label="Your question"
              placeholder="Apna sawal likhein…"
              className="flex-1 resize-none max-h-24 rounded-xl px-3 py-2 text-sm bg-slate-100/50 border border-slate-200/60 text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50"
            />
            <button
              type="submit"
              disabled={busy || demo || !input.trim()}
              aria-label="Send question"
              className="h-10 w-10 shrink-0 inline-flex items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
