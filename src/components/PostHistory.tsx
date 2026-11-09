import { useMemo, useState } from "react";
import { AlertCircle, Check, Clock, ExternalLink, History, Loader2, Search } from "lucide-react";
import type { Platform, Post } from "../types";
import { platformLabels } from "../data";
import { platformIcons } from "./PlatformIcon";
import PostEditor from "./PostEditor";
import { usePosts } from "../context/PostsContext";
import { ALL_PLATFORMS } from "../lib/platforms";
import {
  filterHistory, historyCounts, historyGroup, historyTime, platformOutcomes,
  type HistoryGroup, type PlatformState,
} from "../lib/history";

const TABS: { id: HistoryGroup | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "published", label: "Posted" },
  { id: "scheduled", label: "Scheduled" },
  { id: "failed", label: "Failed" },
  { id: "draft", label: "Drafts" },
];

const STATE_UI: Record<PlatformState, { label: string; cls: string; Icon: typeof Check }> = {
  posted: { label: "Posted", cls: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30", Icon: Check },
  failed: { label: "Failed", cls: "bg-red-500/15 text-red-800 dark:text-red-300 border-red-500/30", Icon: AlertCircle },
  waiting: { label: "Will post", cls: "bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30", Icon: Clock },
  notsent: { label: "Not sent", cls: "bg-slate-500/15 text-slate-700 border-slate-500/30", Icon: Clock },
};

const GROUP_LABEL: Record<HistoryGroup, string> = { published: "Posted", scheduled: "Scheduled", failed: "Needs attention", draft: "Draft" };

function when(iso: string | null): string {
  if (!iso) return "No date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "No date";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function PostHistory() {
  const { posts, loading, error, reload } = usePosts();
  const [group, setGroup] = useState<HistoryGroup | "all">("all");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Post | null>(null);

  const counts = useMemo(() => historyCounts(posts), [posts]);
  const rows = useMemo(() => filterHistory(posts, { group, platform, query }), [posts, group, platform, query]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <History className="w-6 h-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
          Post History
        </h2>
        <p className="text-sm text-slate-600 mt-1">Every post, when it went out and on which platform. Open a post to see it or fix a failed one.</p>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div role="tablist" aria-label="Post status" className="flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100/50 border border-slate-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={group === t.id}
              onClick={() => setGroup(t.id)}
              className={`h-8 px-3 rounded-lg text-xs font-semibold transition-colors ${group === t.id ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100"}`}
            >
              {t.label} <span className="opacity-80">{counts[t.id]}</span>
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="history-platform">Platform</label>
        <select
          id="history-platform"
          value={platform}
          onChange={(e) => setPlatform(e.target.value as Platform | "all")}
          className="h-10 px-3 rounded-xl bg-slate-100/50 border border-slate-200/50 text-sm text-slate-800"
        >
          <option value="all">All platforms</option>
          {ALL_PLATFORMS.map((p) => (
            <option key={p} value={p}>{platformLabels[p]}</option>
          ))}
        </select>
        <div className="relative flex-1 lg:max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title or caption"
            aria-label="Search posts"
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-slate-100/50 border border-slate-200/50 text-sm text-slate-800 placeholder:text-slate-500"
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 text-sm text-red-800 dark:text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <span>{error}</span>
          <button onClick={() => void reload()} className="font-semibold underline">Try again</button>
        </div>
      )}

      {loading && posts.length === 0 ? (
        <p className="text-sm text-slate-600 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Loading your posts…</p>
      ) : rows.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center">
          <p className="text-sm font-semibold text-slate-900">{posts.length === 0 ? "No posts yet" : "No posts match these filters"}</p>
          <p className="text-sm text-slate-600 mt-1">
            {posts.length === 0 ? "Create a post and it will show up here with its full history." : "Try another status, platform or search word."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((p) => {
            const g = historyGroup(p);
            const outcomes = platformOutcomes(p);
            return (
              <li key={p.id} className="glass rounded-2xl p-4">
                <div className="flex gap-3">
                  {p.media?.kind === "image" ? (
                    <img src={p.media.url} alt="" className="w-16 h-16 rounded-lg object-cover bg-slate-100/50 border border-slate-200 shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-slate-100/50 border border-slate-200 shrink-0 flex items-center justify-center text-[10px] text-slate-500">
                      {p.media?.kind === "video" ? "Video" : "No picture"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <button onClick={() => setOpen(p)} className="text-sm font-semibold text-slate-900 hover:underline text-left truncate max-w-full">
                        {p.title || "Untitled post"}
                      </button>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${g === "failed" ? STATE_UI.failed.cls : g === "published" ? STATE_UI.posted.cls : g === "scheduled" ? STATE_UI.waiting.cls : STATE_UI.notsent.cls}`}>
                        {GROUP_LABEL[g]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {g === "published" || p.publishedAt ? "Posted" : "Planned"}: {when(historyTime(p))}
                    </p>
                    {p.caption && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{p.caption}</p>}
                    <ul className="flex flex-wrap gap-2 mt-2" aria-label="Result on each platform">
                      {outcomes.map((o) => {
                        const ui = STATE_UI[o.state];
                        const Icon = platformIcons[o.platform];
                        const chip = (
                          <span className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-xs font-medium ${ui.cls}`}>
                            <Icon className="w-3.5 h-3.5" />
                            {platformLabels[o.platform]}: {ui.label}
                            {o.link && <ExternalLink className="w-3 h-3" aria-hidden="true" />}
                          </span>
                        );
                        return (
                          <li key={o.platform}>
                            {o.link ? (
                              <a href={o.link} target="_blank" rel="noopener noreferrer" aria-label={`Open the ${platformLabels[o.platform]} post`}>{chip}</a>
                            ) : chip}
                          </li>
                        );
                      })}
                    </ul>
                    {g === "failed" && p.publishError && (
                      <p className="text-xs text-red-800 dark:text-red-300 mt-2">Reason: {p.publishError}</p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {open && <PostEditor key={open.id} post={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
