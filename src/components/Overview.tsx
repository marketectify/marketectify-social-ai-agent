import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  FileEdit,
  Inbox as InboxIcon,
  Lock,
  MessageCircle,
  Palette,
  Plus,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { Post, TabId } from "../types";
import { usePosts } from "../context/PostsContext";
import { useMessages } from "../context/MessagesContext";
import { useAuth } from "../context/AuthContext";
import { usePlan } from "../context/PlanContext";
import { statusConfig } from "../lib/status";
import { formatFullDate, formatTime, formatWeekday } from "../lib/dates";
import { buildAttention, greeting, headline, setupSteps, weekStrip, type AttentionKind } from "../lib/dashboard";
import { loadDesigns } from "../lib/designStore";
import PostEditor from "./PostEditor";

interface OverviewProps {
  onNavigate: (tab: TabId) => void;
}

interface EditorState {
  post: Post | null;
  defaultDate?: Date;
}

const KIND_STYLE: Record<AttentionKind, { icon: LucideIcon; bar: string; icon_: string }> = {
  overdue: { icon: AlertTriangle, bar: "bg-red-500", icon_: "text-red-600 dark:text-red-400" },
  approve: { icon: Clock, bar: "bg-amber-500", icon_: "text-amber-700 dark:text-amber-400" },
  unread: { icon: MessageCircle, bar: "bg-blue-500", icon_: "text-blue-600 dark:text-blue-400" },
  unscheduled: { icon: FileEdit, bar: "bg-slate-400", icon_: "text-slate-600" },
};

function countDesigns(workspaceId: string): number {
  try {
    return loadDesigns(window.localStorage, workspaceId).length;
  } catch {
    return 0;
  }
}

export default function Overview({ onNavigate }: OverviewProps) {
  const { posts, loading, error, reload } = usePosts();
  const { messages } = useMessages();
  const { workspace } = useAuth();
  const { isPro, showUpgrade } = usePlan();
  const [editor, setEditor] = useState<EditorState | null>(null);

  const now = useMemo(() => new Date(), [posts, messages]);
  const attention = useMemo(() => buildAttention(posts, messages, now), [posts, messages, now]);
  const week = useMemo(() => weekStrip(posts, now), [posts, now]);
  const weekCount = week.reduce((n, d) => n + d.posts.length, 0);
  const steps = useMemo(() => setupSteps(posts, countDesigns(workspace?.id ?? "demo")), [posts, workspace?.id]);
  const setupDone = steps.every((s) => s.done);

  const counts = useMemo(
    () => ({
      scheduled: posts.filter((p) => p.status === "approved" && p.scheduledAt && new Date(p.scheduledAt).getTime() >= now.getTime()).length,
      drafts: posts.filter((p) => p.status === "draft").length,
      published: posts.filter((p) => p.status === "published").length,
    }),
    [posts, now],
  );

  const openPost = (id: string) => {
    const post = posts.find((p) => p.id === id);
    if (post) setEditor({ post });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header: one sentence that says what the day looks like */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-slate-600">{formatFullDate(now)}</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1 break-words">
            {greeting(now.getHours())}, {workspace?.name ?? "there"}
          </h2>
          <p className="text-base text-slate-700 mt-1" aria-live="polite">
            {loading ? "Checking your posts and messages…" : headline(attention, weekCount)}
          </p>
        </div>
        <button
          onClick={() => setEditor({ post: null })}
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" aria-hidden="true" /> New post
        </button>
      </header>

      {error && (
        <div role="alert" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm border bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400">
          <span className="flex-1">{error}</span>
          <button onClick={() => void reload()} className="font-semibold underline">
            Try again
          </button>
        </div>
      )}

      {/* The next 7 days: the one thing on this page that is only possible with your data */}
      <section aria-labelledby="week-title">
        <div className="flex items-baseline justify-between mb-3">
          <h3 id="week-title" className="text-lg font-bold text-slate-900">Next 7 days</h3>
          <button onClick={() => onNavigate("calendar")} className="text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline inline-flex items-center gap-1">
            Open calendar <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
        <div className="glass rounded-2xl overflow-x-auto">
          <ol className="grid grid-flow-col auto-cols-[minmax(9.5rem,1fr)] md:grid-flow-row md:grid-cols-7 divide-x divide-slate-200/80 min-w-0">
            {week.map((day) => (
              <li key={day.date.toISOString()} className="flex flex-col min-h-[9.5rem]">
                <div className={`px-3 py-2 border-b border-slate-200/80 ${day.isToday ? "bg-blue-600 text-white" : ""}`}>
                  <p className={`text-xs font-medium ${day.isToday ? "text-white/90" : "text-slate-600"}`}>{day.isToday ? "Today" : formatWeekday(day.date)}</p>
                  <p className={`text-lg font-bold leading-tight ${day.isToday ? "text-white" : "text-slate-900"}`}>{day.date.getDate()}</p>
                </div>
                <div className="p-2 space-y-1.5 flex-1">
                  {loading ? (
                    <div className="h-8 rounded-lg bg-slate-100 animate-pulse" aria-hidden="true" />
                  ) : day.posts.length === 0 ? (
                    <button
                      onClick={() => setEditor({ post: null, defaultDate: day.date })}
                      aria-label={`Add a post on ${formatFullDate(day.date)}`}
                      className="w-full h-full min-h-[3.5rem] rounded-lg border border-dashed border-slate-300 text-slate-500 hover:text-blue-700 hover:border-blue-500/50 hover:bg-blue-500/5 inline-flex items-center justify-center transition-colors"
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                    </button>
                  ) : (
                    <>
                      {day.posts.slice(0, 3).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setEditor({ post: p })}
                          title={`${p.title} · ${statusConfig[p.status].label}`}
                          className={`w-full text-left rounded-lg px-2 py-1.5 text-white hover:brightness-110 transition ${statusConfig[p.status].chip}`}
                        >
                          <span className="block text-[11px] font-semibold truncate">{p.title}</span>
                          <span className="block text-[10px] text-white/90">{p.scheduledAt ? formatTime(new Date(p.scheduledAt)) : ""}</span>
                        </button>
                      ))}
                      {day.posts.length > 3 && <p className="text-[11px] text-slate-600 px-1">+{day.posts.length - 3} more</p>}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Needs you */}
        <section className="lg:col-span-2" aria-labelledby="needs-title">
          <h3 id="needs-title" className="text-lg font-bold text-slate-900 mb-3">Needs you</h3>
          {loading ? (
            <div className="space-y-2" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : attention.length === 0 ? (
            <div className="glass rounded-2xl p-6 flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold text-slate-900">Nothing is waiting for you.</p>
                <p className="text-sm text-slate-600 mt-1">A good time to plan ahead: write a few captions with AI and schedule them for next week.</p>
                <button onClick={() => onNavigate("studio")} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline">
                  <Sparkles className="w-4 h-4" aria-hidden="true" /> Write captions with AI
                </button>
              </div>
            </div>
          ) : (
            <ul className="glass rounded-2xl divide-y divide-slate-200/80 overflow-hidden">
              {attention.map((item) => {
                const style = KIND_STYLE[item.kind];
                const Icon = style.icon;
                return (
                  <li key={item.id} className="flex items-center gap-3 pr-3 sm:pr-4 relative">
                    <span className={`self-stretch w-1 shrink-0 ${style.bar}`} aria-hidden="true" />
                    <Icon className={`w-5 h-5 shrink-0 ${style.icon_}`} aria-hidden="true" />
                    <div className="flex-1 min-w-0 py-3">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-600 truncate">{item.detail}</p>
                    </div>
                    <button
                      onClick={() => (item.postId ? openPost(item.postId) : item.tab && onNavigate(item.tab))}
                      className="shrink-0 h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-100/70 transition-colors"
                    >
                      {item.action}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Quick starts */}
          <h3 className="text-lg font-bold text-slate-900 mt-8 mb-3">Start something</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Start icon={Sparkles} label="Write with AI" hint="Captions, scripts, ideas" onClick={() => onNavigate("studio")} />
            <Start icon={Palette} label="Design a picture" hint="Drag and drop designer" onClick={() => onNavigate("design")} />
            <Start icon={InboxIcon} label="Answer messages" hint="AI writes the first draft" onClick={() => onNavigate("inbox")} />
          </div>

          <p className="text-sm text-slate-600 mt-6">
            <span className="font-semibold text-slate-900">{counts.scheduled}</span> scheduled ·{" "}
            <span className="font-semibold text-slate-900">{counts.drafts}</span> drafts ·{" "}
            <span className="font-semibold text-slate-900">{counts.published}</span> published
          </p>
        </section>

        {/* Right column: plan and first steps */}
        <aside className="space-y-6" aria-label="Your plan and first steps">
          <section className="glass rounded-2xl p-5" aria-labelledby="plan-title">
            <h3 id="plan-title" className="text-sm font-bold text-slate-900 flex items-center gap-2">
              {isPro ? "Pro plan" : "Free plan"}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPro ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}>
                {isPro ? "ACTIVE" : "CURRENT"}
              </span>
            </h3>
            {isPro ? (
              <p className="text-sm text-slate-600 mt-2">AI pictures are unlocked. AI videos will join your plan when they are ready.</p>
            ) : (
              <>
                <ul className="mt-3 space-y-1.5 text-sm text-slate-700">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" aria-hidden="true" /> AI captions, scripts and reply drafts</li>
                  <li className="flex items-center gap-2"><Lock className="w-4 h-4 text-slate-500" aria-hidden="true" /> AI pictures</li>
                  <li className="flex items-center gap-2"><Lock className="w-4 h-4 text-slate-500" aria-hidden="true" /> AI videos</li>
                </ul>
                <button
                  onClick={() => showUpgrade()}
                  className="mt-4 w-full h-10 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  See Pro plan
                </button>
              </>
            )}
          </section>

          {!setupDone && !loading && (
            <section className="glass rounded-2xl p-5" aria-labelledby="setup-title">
              <h3 id="setup-title" className="text-sm font-bold text-slate-900">First steps</h3>
              <p className="text-xs text-slate-600 mt-1">{steps.filter((s) => s.done).length} of {steps.length} done</p>
              <ol className="mt-3 space-y-3">
                {steps.map((s) => (
                  <li key={s.id} className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${s.done ? "bg-emerald-600 border-emerald-600" : "border-slate-300"}`}
                      aria-label={s.done ? "Done" : "Not done yet"}
                    >
                      {s.done && <Check className="w-3 h-3 text-white" aria-hidden="true" />}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${s.done ? "text-slate-500 line-through" : "text-slate-900"}`}>{s.label}</p>
                      {!s.done && (
                        <>
                          <p className="text-xs text-slate-600">{s.hint}</p>
                          <button
                            onClick={() => (s.newPost ? setEditor({ post: null }) : s.tab && onNavigate(s.tab))}
                            className="mt-1 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline"
                          >
                            {s.action}
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </aside>
      </div>

      {editor && <PostEditor key={editor.post?.id ?? "new"} post={editor.post} defaultDate={editor.defaultDate} onClose={() => setEditor(null)} />}
    </div>
  );
}

function Start({ icon: Icon, label, hint, onClick }: { icon: LucideIcon; label: string; hint: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="glass-light rounded-xl p-4 text-left flex items-start gap-3 hover:border-blue-500/40 transition-colors"
    >
      <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        <span className="block text-xs text-slate-600">{hint}</span>
      </span>
    </button>
  );
}
