import { useRef, useState } from "react";
import {
  AlertCircle,
  Bookmark,
  Check,
  ChevronDown,
  Copy,
  Hash,
  Heart,
  Image as ImageIcon,
  Info,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Video,
  Wand2,
} from "lucide-react";
import type { Platform } from "../types";
import { platformLabels } from "../data";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import PostEditor from "./PostEditor";
import {
  AIError,
  LANGUAGES,
  LIMITS,
  PLATFORM_FOCUS,
  TONES,
  generate,
  type CaptionsResult,
  type GenerateRequest,
  type Generated,
  type Kind,
  type ScriptResult,
  type VisualResult,
} from "../lib/ai";

const AUDIENCES = ["Small business owners", "Marketing agencies", "Content creators", "E-commerce brands", "Startups"];

const ENGINES: { kind: Kind; title: string; subtitle: string; icon: typeof Hash; color: string }[] = [
  { kind: "captions", title: "Captions & hashtags", subtitle: "3 ready-to-post variations", icon: Hash, color: "bg-blue-600" },
  { kind: "script", title: "Reel / short video script", subtitle: "Hook, scenes, voiceover and call to action", icon: Video, color: "bg-sky-700" },
  { kind: "visual", title: "Visual ideas & image prompts", subtitle: "Concepts plus prompts for any image tool", icon: ImageIcon, color: "bg-indigo-600" },
];

type Results = Partial<Record<Kind, Generated>>;

export default function Studio() {
  const { mode, workspace } = useAuth();
  const toast = useToast();
  const brand = workspace?.name ?? "Your brand";
  const demo = mode === "demo";

  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<GenerateRequest["tone"]>("Engaging");
  const [audience, setAudience] = useState(AUDIENCES[0]);
  const [language, setLanguage] = useState<GenerateRequest["language"]>("English");
  const [platform, setPlatform] = useState<GenerateRequest["platform"]>("instagram");

  const [results, setResults] = useState<Results>({});
  const [loading, setLoading] = useState<Kind | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Kind, string>>>({});
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);
  const [selected, setSelected] = useState(0);
  const [editorInitial, setEditorInitial] = useState<null | { title: string; caption: string; hashtags: string[]; platforms: Platform[] }>(null);
  const busy = useRef(false);

  const topicOk = topic.trim().length >= LIMITS.topicMin;
  const canGenerate = !demo && topicOk && !loading;

  const run = async (kind: Kind) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(kind);
    setErrors((e) => ({ ...e, [kind]: undefined }));
    try {
      const res = await generate({ kind, topic: topic.trim(), tone, audience: audience.trim() || "General audience", language, platform, brand });
      setResults((r) => ({ ...r, [kind]: res }));
      setUsage(res.usage);
      if (kind === "captions") setSelected(0);
    } catch (e) {
      const message = e instanceof AIError ? e.message : "Something went wrong. Please try again.";
      setErrors((prev) => ({ ...prev, [kind]: message }));
    } finally {
      busy.current = false;
      setLoading(null);
    }
  };

  const captions = (results.captions?.result as CaptionsResult | undefined)?.captions ?? [];
  const chosen = captions[Math.min(selected, Math.max(captions.length - 1, 0))];
  const script = results.script?.result as ScriptResult | undefined;
  const visual = results.visual?.result as VisualResult | undefined;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Could not copy. Select the text and copy it manually.");
    }
  };

  const createPost = (caption: string, hashtags: string[]) =>
    setEditorInitial({
      title: topic.trim().slice(0, 80),
      caption,
      hashtags,
      platforms: [platform] as Platform[],
    });

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          AI Content Studio
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Describe your idea once. Get captions, a video script and visual ideas written for your brand, in your language.
        </p>
      </div>

      {demo && (
        <div role="status" className="flex gap-2 items-start text-sm text-amber-900 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            AI generation is switched off in demo mode because it needs a signed-in account. Connect the database and the
            Gemini key (see <code>docs/SETUP.md</code>) to turn it on.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="space-y-5">
          <div className="glass rounded-2xl p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="studio-topic" className="text-sm font-semibold text-slate-900">
                  What is the post about?
                </label>
                <span className={`text-xs ${topic.length > LIMITS.topicMax ? "text-red-600" : "text-slate-500"}`}>
                  {topic.length}/{LIMITS.topicMax}
                </span>
              </div>
              <textarea
                id="studio-topic"
                value={topic}
                maxLength={LIMITS.topicMax}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Launching our new summer collection with 20% off for the first 48 hours"
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-slate-100/50 border border-slate-200/50 text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SelectField label="Tone" value={tone} options={TONES} onChange={(v) => setTone(v as typeof tone)} />
              <SelectField label="Language" value={language} options={LANGUAGES} onChange={(v) => setLanguage(v as typeof language)} />
              <SelectField
                label="Main platform"
                value={platform}
                options={PLATFORM_FOCUS}
                labels={platformLabels as Record<string, string>}
                onChange={(v) => setPlatform(v as typeof platform)}
              />
              <div>
                <label htmlFor="studio-audience" className="text-xs font-medium text-slate-600 mb-1.5 block">
                  Target audience
                </label>
                <input
                  id="studio-audience"
                  list="studio-audiences"
                  value={audience}
                  maxLength={LIMITS.audienceMax}
                  onChange={(e) => setAudience(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-slate-100/50 border border-slate-200/50 text-sm text-slate-800 focus:outline-none focus:border-blue-500/50 transition-all"
                />
                <datalist id="studio-audiences">
                  {AUDIENCES.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Written for <strong className="font-semibold text-slate-700">{brand}</strong>.
              {usage && (
                <>
                  {" "}
                  Used {usage.used} of {usage.limit} generations today.
                </>
              )}
            </p>
          </div>

          <div className="glass rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Generate
            </h3>
            {!demo && !topicOk && <p className="text-xs text-slate-500">Write at least {LIMITS.topicMin} characters about the post to begin.</p>}
            {ENGINES.map((en) => (
              <EngineButton
                key={en.kind}
                {...en}
                loading={loading === en.kind}
                done={Boolean(results[en.kind])}
                disabled={!canGenerate}
                onClick={() => run(en.kind)}
              />
            ))}
          </div>

          <div className="space-y-4" aria-live="polite">
            {(Object.keys(errors) as Kind[]).map((k) =>
              errors[k] ? (
                <div key={k} role="alert" className="flex gap-2 items-start text-sm text-red-800 dark:text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p className="flex-1">{errors[k]}</p>
                  <button onClick={() => run(k)} disabled={!canGenerate} className="text-xs font-semibold underline disabled:opacity-50">
                    Try again
                  </button>
                </div>
              ) : null,
            )}

            {captions.length > 0 && (
              <OutputCard title="Captions & hashtags" icon={Hash} onRegenerate={() => run("captions")} disabled={!canGenerate} regenerating={loading === "captions"}>
                <div className="space-y-3">
                  {captions.map((c, i) => (
                    <div
                      key={i}
                      className={`rounded-xl border p-3 transition-colors ${i === selected ? "border-blue-500/60 bg-blue-500/5" : "border-slate-200/60"}`}
                    >
                      <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{c.text}</p>
                      {c.hashtags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {c.hashtags.map((t) => (
                            <span key={t} className="px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-500/20">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 mt-3">
                        <SmallButton onClick={() => setSelected(i)} active={i === selected}>
                          {i === selected ? "Shown in preview" : "Preview"}
                        </SmallButton>
                        <SmallButton onClick={() => copy(`${c.text}\n\n${c.hashtags.join(" ")}`.trim())} icon={Copy}>
                          Copy
                        </SmallButton>
                        <SmallButton onClick={() => createPost(c.text, c.hashtags)} icon={Plus} primary>
                          Create post
                        </SmallButton>
                      </div>
                    </div>
                  ))}
                </div>
              </OutputCard>
            )}

            {script && (
              <OutputCard title={`Reel script (~${script.durationSeconds}s)`} icon={Video} onRegenerate={() => run("script")} disabled={!canGenerate} regenerating={loading === "script"}>
                <div className="space-y-2 text-sm text-slate-800">
                  <p><span className="font-semibold text-blue-700 dark:text-blue-300">Hook:</span> {script.hook}</p>
                  {script.scenes.map((s, i) => (
                    <div key={i} className="rounded-lg border border-slate-200/60 p-2.5">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">{s.time}</p>
                      <p><span className="font-medium">Visual:</span> {s.visual}</p>
                      <p><span className="font-medium">Voiceover:</span> {s.voiceover}</p>
                    </div>
                  ))}
                  <p><span className="font-semibold text-blue-700 dark:text-blue-300">Call to action:</span> {script.cta}</p>
                  {script.musicMood && <p className="text-xs text-slate-600">Music: {script.musicMood}</p>}
                </div>
                <div className="mt-3">
                  <SmallButton
                    icon={Copy}
                    onClick={() =>
                      copy(
                        [`Hook: ${script.hook}`, ...script.scenes.map((s) => `[${s.time}] ${s.visual}\nVoiceover: ${s.voiceover}`), `CTA: ${script.cta}`].join("\n\n"),
                      )
                    }
                  >
                    Copy script
                  </SmallButton>
                </div>
              </OutputCard>
            )}

            {visual && (
              <OutputCard title="Visual ideas" icon={ImageIcon} onRegenerate={() => run("visual")} disabled={!canGenerate} regenerating={loading === "visual"}>
                <div className="space-y-3">
                  {visual.ideas.map((v, i) => (
                    <div key={i} className="rounded-xl border border-slate-200/60 p-3 text-sm text-slate-800">
                      <p className="font-semibold text-slate-900">{v.title}</p>
                      <p className="mt-1">{v.description}</p>
                      {v.imagePrompt && (
                        <p className="mt-2 text-xs text-slate-600 bg-slate-100/60 rounded-lg p-2">
                          <span className="font-semibold">Image prompt:</span> {v.imagePrompt}
                        </p>
                      )}
                      {v.imagePrompt && (
                        <div className="mt-2">
                          <SmallButton icon={Copy} onClick={() => copy(v.imagePrompt)}>
                            Copy prompt
                          </SmallButton>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </OutputCard>
            )}
          </div>
        </div>

        <div className="xl:sticky xl:top-24 self-start">
          <div className="glass rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Live preview</h3>
            <PostPreview
              brand={brand}
              caption={chosen?.text ?? ""}
              hashtags={chosen?.hashtags ?? []}
              headline={script?.hook ?? visual?.ideas[0]?.title ?? (topic.trim() || "Your idea appears here")}
            />
          </div>
        </div>
      </div>

      {editorInitial && <PostEditor post={null} initial={editorInitial} onClose={() => setEditorInitial(null)} />}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  labels,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  labels?: Record<string, string>;
  onChange: (v: string) => void;
}) {
  const id = `studio-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-slate-600 mb-1.5 block">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 px-3 pr-8 rounded-xl bg-slate-100/50 border border-slate-200/50 text-sm text-slate-800 focus:outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {labels?.[opt] ?? opt}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
      </div>
    </div>
  );
}

function EngineButton({
  icon: Icon,
  title,
  subtitle,
  color,
  loading,
  done,
  disabled,
  onClick,
}: {
  icon: typeof Hash;
  title: string;
  subtitle: string;
  color: string;
  loading: boolean;
  done: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-busy={loading}
      className="w-full flex items-center gap-3 p-3.5 rounded-xl glass-light hover:border-slate-300 transition-all text-left disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shrink-0`}>
        {loading ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : done ? <Check className="w-5 h-5 text-white" /> : <Icon className="w-5 h-5 text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-[11px] text-slate-500">{loading ? "Writing…" : done ? "Done. Click to generate again" : subtitle}</p>
      </div>
    </button>
  );
}

function SmallButton({
  children,
  onClick,
  icon: Icon,
  primary,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon?: typeof Copy;
  primary?: boolean;
  active?: boolean;
}) {
  const style = primary
    ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
    : active
      ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30"
      : "text-slate-700 border-slate-200/70 hover:bg-slate-100/60";
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${style}`}>
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </button>
  );
}

function OutputCard({
  title,
  icon: Icon,
  children,
  onRegenerate,
  disabled,
  regenerating,
}: {
  title: string;
  icon: typeof Hash;
  children: React.ReactNode;
  onRegenerate: () => void;
  disabled: boolean;
  regenerating: boolean;
}) {
  return (
    <div className="glass rounded-2xl p-5 animate-slide-in">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          {title}
        </h4>
        <button
          onClick={onRegenerate}
          disabled={disabled}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`} />
          Regenerate
        </button>
      </div>
      {children}
    </div>
  );
}

function PostPreview({ brand, caption, hashtags, headline }: { brand: string; caption: string; hashtags: string[]; headline: string }) {
  const initials = brand
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <div className="max-w-sm mx-auto rounded-2xl overflow-hidden bg-surface border border-slate-200/50">
      <div className="flex items-center gap-2.5 p-3">
        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white">{initials || "M"}</div>
        <p className="flex-1 text-sm font-semibold text-slate-900 truncate">{brand}</p>
        <MoreHorizontal className="w-5 h-5 text-slate-600" />
      </div>
      <div className="aspect-[4/5] bg-blue-600 relative flex items-center justify-center">
        <div className="absolute inset-0 bg-black/10" />
        <p className="relative text-white font-bold text-lg text-center px-6 break-words">{headline}</p>
      </div>
      <div className="flex items-center gap-4 p-3">
        <Heart className="w-6 h-6 text-slate-700" />
        <MessageCircle className="w-6 h-6 text-slate-700" />
        <Send className="w-6 h-6 text-slate-700" />
        <Bookmark className="w-6 h-6 text-slate-700 ml-auto" />
      </div>
      <div className="px-3 pb-4 min-h-[3.5rem]">
        {caption ? (
          <>
            <p className="text-sm text-slate-900 whitespace-pre-wrap break-words">
              <span className="font-semibold">{brand}</span> {caption}
            </p>
            {hashtags.length > 0 && <p className="text-xs text-blue-600 dark:text-blue-400 mt-1.5 break-words">{hashtags.join(" ")}</p>}
          </>
        ) : (
          <p className="text-sm text-slate-500">Generate captions and pick one to see it here.</p>
        )}
      </div>
    </div>
  );
}
