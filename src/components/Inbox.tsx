import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bot,
  Check,
  Clock,
  Copy,
  Inbox as InboxIcon,
  Info,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { Message, MessageKind, Platform } from "../types";
import { platformLabels } from "../data";
import { platformIcons } from "./PlatformIcon";
import { useAuth } from "../context/AuthContext";
import { useMessages } from "../context/MessagesContext";
import { useToast } from "../context/ToastContext";
import { MESSAGE_LIMITS } from "../lib/messagesRepo";
import { timeAgo } from "../lib/dates";
import { AIError, LANGUAGES, TONES, generate, type ReplyResult } from "../lib/ai";

const PLATFORMS: Platform[] = ["facebook", "instagram", "tiktok", "youtube"];

const platformColor: Record<Platform, string> = {
  facebook: "text-blue-600 dark:text-blue-400",
  instagram: "text-pink-600 dark:text-pink-400",
  tiktok: "text-cyan-700 dark:text-cyan-300",
  youtube: "text-red-600 dark:text-red-400",
};

const AVATARS = ["bg-blue-600", "bg-sky-700", "bg-indigo-600", "bg-pink-600", "bg-cyan-700", "bg-emerald-700"];
const avatarColor = (name: string) => AVATARS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % AVATARS.length];
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

type StatusFilter = "all" | "unread" | "replied";

export default function Inbox() {
  const { mode } = useAuth();
  const { messages, loading, error, reload, addMessage, updateMessage, deleteMessage } = useMessages();
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const unreadCount = messages.filter((m) => m.status === "unread").length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messages.filter((m) => {
      if (statusFilter === "unread" && m.status !== "unread") return false;
      if (statusFilter === "replied" && m.status !== "replied") return false;
      if (platformFilter !== "all" && m.platform !== platformFilter) return false;
      if (q && !`${m.senderName} ${m.senderHandle} ${m.body}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [messages, statusFilter, platformFilter, query]);

  const selected = messages.find((m) => m.id === selectedId) ?? null;

  const select = (m: Message) => {
    setAdding(false);
    setSelectedId(m.id);
    if (m.status === "unread") void updateMessage(m.id, { status: "read" }).catch(() => undefined);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <InboxIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Inbox
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Customer comments and DMs with AI reply drafts · {unreadCount} unread
          </p>
        </div>
        <button
          onClick={() => {
            setAdding(true);
            setSelectedId(null);
          }}
          className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add message
        </button>
      </div>

      <div role="status" className="flex gap-2 items-start text-xs text-slate-700 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
        <p>
          Facebook, Instagram, TikTok and YouTube are not connected yet, so messages do not arrive here by themselves.
          Paste a comment or DM with <strong className="font-semibold">Add message</strong>, let the AI draft the reply,
          copy it, post it on the platform, then mark it as replied.
        </p>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-3 text-sm text-red-800 dark:text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <p className="flex-1">
            {error} If you just set up the database, run <code>0003_messages.sql</code> (see docs/SETUP.md).
          </p>
          <button onClick={() => void reload()} className="text-xs font-semibold underline">
            Try again
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-340px)] lg:min-h-[480px]">
        {/* List */}
        <div className="w-full lg:w-80 shrink-0 glass rounded-2xl flex flex-col overflow-hidden max-h-[420px] lg:max-h-none">
          <div className="p-3 border-b border-slate-200/80 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="search"
                aria-label="Search messages"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search messages..."
                className="w-full h-9 pl-8 pr-3 rounded-lg bg-slate-100/50 border border-slate-200/50 text-xs text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>
            <div className="flex gap-1.5" role="group" aria-label="Filter by status">
              {(["all", "unread", "replied"] as StatusFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  aria-pressed={statusFilter === f}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                    statusFilter === f ? "bg-blue-500/20 text-blue-700 dark:text-blue-300" : "text-slate-600 hover:bg-slate-100/60"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5" role="group" aria-label="Filter by platform">
              <button
                onClick={() => setPlatformFilter("all")}
                aria-pressed={platformFilter === "all"}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium ${platformFilter === "all" ? "bg-slate-200/70 text-slate-900" : "text-slate-600 hover:bg-slate-100/60"}`}
              >
                All
              </button>
              {PLATFORMS.map((p) => {
                const Icon = platformIcons[p];
                return (
                  <button
                    key={p}
                    onClick={() => setPlatformFilter(platformFilter === p ? "all" : p)}
                    aria-pressed={platformFilter === p}
                    aria-label={platformLabels[p]}
                    title={platformLabels[p]}
                    className={`p-1.5 rounded-lg transition-colors ${platformFilter === p ? "bg-slate-200/70" : "hover:bg-slate-100/60"}`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${platformColor[p]}`} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {loading && messages.length === 0 ? (
              <p className="p-4 text-sm text-slate-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading messages…
              </p>
            ) : visible.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                {messages.length === 0 ? "No messages yet. Use Add message to paste the first one." : "No messages match these filters."}
              </div>
            ) : (
              visible.map((m) => {
                const Icon = platformIcons[m.platform];
                const active = m.id === selectedId;
                return (
                  <button
                    key={m.id}
                    onClick={() => select(m)}
                    className={`w-full flex items-start gap-3 p-3 border-b border-slate-200/40 transition-all text-left border-l-2 ${
                      active ? "bg-blue-500/10 border-l-blue-500" : "hover:bg-slate-100/40 border-l-transparent"
                    }`}
                  >
                    <div className={`relative w-10 h-10 rounded-full ${avatarColor(m.senderName)} flex items-center justify-center shrink-0`}>
                      <span className="text-xs font-bold text-white">{initials(m.senderName)}</span>
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-surface flex items-center justify-center">
                        <Icon className={`w-2.5 h-2.5 ${platformColor[m.platform]}`} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${m.status === "unread" ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>
                          {m.senderName}
                        </p>
                        <span className="text-[10px] text-slate-500 shrink-0">{timeAgo(m.receivedAt)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-blue-500/15 text-blue-700 dark:text-blue-300">
                          {m.kind === "dm" ? "DM" : "Comment"}
                        </span>
                        {m.status === "replied" && <Check className="w-3 h-3 text-emerald-700 dark:text-emerald-400 shrink-0" aria-label="Replied" />}
                        <p className="text-xs text-slate-500 truncate">{m.body}</p>
                      </div>
                    </div>
                    {m.status === "unread" && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2" aria-label="Unread" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex-1 glass rounded-2xl flex flex-col overflow-hidden min-h-[360px]">
          {adding ? (
            <AddMessageForm
              onCancel={() => setAdding(false)}
              onSave={async (input) => {
                const created = await addMessage(input);
                toast.success("Message added");
                setAdding(false);
                setSelectedId(created.id);
              }}
            />
          ) : selected ? (
            <Conversation
              key={selected.id}
              message={selected}
              demo={mode === "demo"}
              onMarkReplied={async (reply) => {
                await updateMessage(selected.id, { status: "replied", reply, repliedAt: new Date().toISOString() });
                toast.success("Marked as replied");
              }}
              onMarkUnreplied={async () => {
                await updateMessage(selected.id, { status: "read", repliedAt: null });
              }}
              onDelete={async () => {
                await deleteMessage(selected.id);
                setSelectedId(null);
                toast.success("Message deleted");
              }}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-500">
              <InboxIcon className="w-10 h-10 mb-3 opacity-50" />
              <p className="text-sm">Select a message to read it and draft a reply.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Conversation({
  message,
  demo,
  onMarkReplied,
  onMarkUnreplied,
  onDelete,
}: {
  message: Message;
  demo: boolean;
  onMarkReplied: (reply: string) => Promise<void>;
  onMarkUnreplied: () => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { workspace } = useAuth();
  const toast = useToast();
  const Icon = platformIcons[message.platform];
  const brand = workspace?.name ?? "";

  const [draft, setDraft] = useState(message.reply ?? "");
  const [tone, setTone] = useState<(typeof TONES)[number]>("Professional");
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>("English");
  const [options, setOptions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const replied = message.status === "replied";

  const draftWithAI = async () => {
    if (aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await generate({
        kind: "reply",
        topic: message.body,
        tone,
        audience: message.kind === "dm" ? "A customer who sent a direct message" : "A customer who left a comment",
        language,
        platform: message.platform,
        brand,
      });
      if (!alive.current) return;
      const replies = (res.result as ReplyResult).replies.map((r) => r.text);
      setOptions(replies);
      if (replies[0] && !draft.trim()) setDraft(replies[0]);
    } catch (e) {
      if (alive.current) setAiError(e instanceof AIError ? e.message : "Something went wrong. Please try again.");
    } finally {
      if (alive.current) setAiLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft);
      toast.success("Reply copied. Paste it on " + platformLabels[message.platform]);
    } catch {
      toast.error("Could not copy. Select the text and copy it manually.");
    }
  };

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 p-4 border-b border-slate-200/80">
        <div className={`w-10 h-10 rounded-full ${avatarColor(message.senderName)} flex items-center justify-center shrink-0`}>
          <span className="text-xs font-bold text-white">{initials(message.senderName)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">{message.senderName}</p>
          <p className="text-xs text-slate-500 truncate">{message.senderHandle || (message.kind === "dm" ? "Direct message" : "Comment")}</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100/50">
          <Icon className={`w-3.5 h-3.5 ${platformColor[message.platform]}`} />
          <span className="text-xs font-medium text-slate-700">{platformLabels[message.platform]}</span>
        </div>
        {confirmDelete ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => wrap(onDelete)}
              disabled={busy}
              className="px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
            >
              Delete
            </button>
            <button onClick={() => setConfirmDelete(false)} className="px-2 py-1.5 rounded-lg text-xs text-slate-600 hover:bg-slate-100/60">
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} aria-label="Delete message" className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-500/10">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        <div className="max-w-[85%]">
          <div className="bg-slate-100/60 rounded-2xl rounded-tl-sm p-3.5">
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap break-words">{message.body}</p>
          </div>
          <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {timeAgo(message.receivedAt)} · {message.kind === "dm" ? "Direct message" : "Comment"}
          </p>
        </div>

        {replied && message.reply && (
          <div className="max-w-[85%] ml-auto">
            <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm p-3.5">
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.reply}</p>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 text-right">
              Replied {message.repliedAt ? timeAgo(message.repliedAt) : ""}
            </p>
          </div>
        )}

        {options.length > 0 && (
          <div className="space-y-2" aria-live="polite">
            <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> AI reply options
            </p>
            {options.map((o, i) => (
              <div key={i} className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-3">
                <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{o}</p>
                <button onClick={() => setDraft(o)} className="mt-2 px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200/70 text-slate-700 hover:bg-slate-100/60">
                  Use this reply
                </button>
              </div>
            ))}
          </div>
        )}
        {aiError && (
          <div role="alert" className="flex gap-2 items-start text-sm text-red-800 dark:text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{aiError}</p>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-200/80 space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-600">
            <span className="block mb-1">Tone</span>
            <select value={tone} onChange={(e) => setTone(e.target.value as typeof tone)} className="h-9 px-2 rounded-lg bg-slate-100/50 border border-slate-200/50 text-xs text-slate-800">
              {TONES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-600">
            <span className="block mb-1">Language</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value as typeof language)} className="h-9 px-2 rounded-lg bg-slate-100/50 border border-slate-200/50 text-xs text-slate-800">
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <button
            onClick={draftWithAI}
            disabled={demo || aiLoading}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300 text-xs font-semibold hover:bg-blue-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
            {options.length > 0 ? "Draft again with AI" : "Draft reply with AI"}
          </button>
        </div>
        {demo && <p className="text-xs text-amber-800 dark:text-amber-300">AI drafts need a signed-in account (not available in demo mode).</p>}

        <textarea
          aria-label="Your reply"
          value={draft}
          maxLength={MESSAGE_LIMITS.reply}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write your reply, or let the AI draft one…"
          rows={3}
          className="w-full px-4 py-3 rounded-xl bg-slate-100/50 border border-slate-200/50 text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 resize-none"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-slate-500">
            Copy the reply, post it on {platformLabels[message.platform]}, then mark it as replied.
          </p>
          <div className="flex gap-2">
            <button onClick={copy} disabled={!draft.trim()} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200/70 text-xs font-medium text-slate-700 hover:bg-slate-100/60 disabled:opacity-40">
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
            {replied ? (
              <button onClick={() => wrap(onMarkUnreplied)} disabled={busy} className="h-9 px-3 rounded-lg border border-slate-200/70 text-xs font-medium text-slate-700 hover:bg-slate-100/60 disabled:opacity-40">
                Mark as not replied
              </button>
            ) : null}
            <button
              onClick={() => wrap(() => onMarkReplied(draft.trim()))}
              disabled={!draft.trim() || busy}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {replied ? "Update reply" : "Mark as replied"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

function AddMessageForm({
  onSave,
  onCancel,
}: {
  onSave: (input: {
    platform: Platform;
    kind: MessageKind;
    senderName: string;
    senderHandle: string;
    body: string;
    receivedAt: string;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [kind, setKind] = useState<MessageKind>("comment");
  const [senderName, setSenderName] = useState("");
  const [senderHandle, setSenderHandle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName.trim()) return setError("Enter who sent the message.");
    if (!body.trim()) return setError("Paste the message text.");
    setError(null);
    setSaving(true);
    try {
      await onSave({
        platform,
        kind,
        senderName: senderName.trim(),
        senderHandle: senderHandle.trim(),
        body: body.trim(),
        receivedAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the message.");
      setSaving(false);
    }
  };

  const field = "w-full h-10 px-3 rounded-xl bg-slate-100/50 border border-slate-200/50 text-sm text-slate-800 focus:outline-none focus:border-blue-500/50";
  return (
    <form onSubmit={submit} className="flex-1 overflow-y-auto p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">Add a message</h3>
        <button type="button" onClick={onCancel} aria-label="Close" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100/60">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs font-medium text-slate-600">
          Platform
          <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className={`${field} mt-1.5`}>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {platformLabels[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Type
          <select value={kind} onChange={(e) => setKind(e.target.value as MessageKind)} className={`${field} mt-1.5`}>
            <option value="comment">Comment</option>
            <option value="dm">Direct message</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Sender name
          <input id="msg-name" value={senderName} maxLength={MESSAGE_LIMITS.name} onChange={(e) => setSenderName(e.target.value)} className={`${field} mt-1.5`} placeholder="Sara Khan" />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Handle (optional)
          <input value={senderHandle} maxLength={MESSAGE_LIMITS.handle} onChange={(e) => setSenderHandle(e.target.value)} className={`${field} mt-1.5`} placeholder="@sarakhan" />
        </label>
      </div>
      <label className="block text-xs font-medium text-slate-600">
        Message
        <textarea
          id="msg-body"
          value={body}
          maxLength={MESSAGE_LIMITS.body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="Paste the comment or DM here"
          className="mt-1.5 w-full px-4 py-3 rounded-xl bg-slate-100/50 border border-slate-200/50 text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 resize-none"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-10 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-100/60">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save message
        </button>
      </div>
    </form>
  );
}
