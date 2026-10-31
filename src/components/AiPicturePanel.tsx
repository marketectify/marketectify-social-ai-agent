import { useState } from "react";
import { Loader2, Lock, Sparkles } from "lucide-react";
import { usePlan } from "../context/PlanContext";
import { AIError } from "../lib/ai";
import { generateImage, nearestAspect, IMAGE_LIMITS, IMAGE_STYLES, type ImageStyle } from "../lib/aiImage";

const STYLE_LABELS: Record<ImageStyle, string> = {
  photo: "Photo",
  illustration: "Illustration",
  "3d": "3D render",
  flat: "Flat graphic",
  poster: "Poster background",
};

interface Props {
  /** Size of the design, so the picture gets a matching shape. */
  width: number;
  height: number;
  /** Receives the finished picture. `as` says where the user wants it. */
  onPicture: (file: File, as: "item" | "background") => void | Promise<void>;
}

/** "AI picture" box in the Design Studio: describe a picture, get one made by Gemini. */
export default function AiPicturePanel({ width, height, onPicture }: Props) {
  const { isPro, requirePro, showUpgrade } = usePlan();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState<ImageStyle>("photo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ file: File; url: string } | null>(null);
  const [usage, setUsage] = useState<{ used: number; limit: number } | null>(null);

  const make = async () => {
    if (busy) return;
    if (!requirePro("ai-picture")) return; // free accounts see the upgrade window
    setBusy(true);
    setError(null);
    try {
      const out = await generateImage({ prompt, style, aspect: nearestAspect(width, height) });
      setUsage(out.usage);
      setResult((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return { file: out.file, url: URL.createObjectURL(out.file) };
      });
    } catch (e) {
      if (e instanceof AIError && e.code === "upgrade_required") showUpgrade("ai-picture");
      else setError(e instanceof Error ? e.message : "Could not make the picture. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const use = async (as: "item" | "background") => {
    if (!result) return;
    await onPicture(result.file, as);
  };

  const field = "w-full rounded-lg px-2.5 py-2 text-xs bg-slate-100/50 border border-slate-200/70 text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60";
  const btn = "h-8 px-2.5 rounded-lg border border-slate-200/70 text-[11px] font-medium text-slate-700 hover:bg-slate-100/60 disabled:opacity-40";

  return (
    <div className="glass rounded-2xl p-4 space-y-2.5">
      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" /> AI picture
        {!isPro && <ProBadge />}
      </h3>
      {
        <>
          <label className="sr-only" htmlFor="ai-picture-prompt">Describe the picture</label>
          <textarea
            id="ai-picture-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={IMAGE_LIMITS.promptMax}
            rows={3}
            placeholder="e.g. a cup of coffee on a wooden table, morning light"
            className={`${field} resize-none`}
          />
          <label className="sr-only" htmlFor="ai-picture-style">Picture style</label>
          <select id="ai-picture-style" value={style} onChange={(e) => setStyle(e.target.value as ImageStyle)} className={field}>
            {IMAGE_STYLES.map((s) => <option key={s} value={s}>{STYLE_LABELS[s]}</option>)}
          </select>
          <button
            type="button"
            onClick={() => void make()}
            disabled={busy || (isPro && prompt.trim().length < IMAGE_LIMITS.promptMin)}
            className="w-full h-9 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Making the picture…</> : isPro ? "Make picture" : <><Lock className="w-3.5 h-3.5" aria-hidden="true" /> Make picture</>}
          </button>
          {error && <p role="alert" className="text-[11px] text-red-800 dark:text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-2">{error}</p>}
          {result && (
            <div className="space-y-2">
              <img src={result.url} alt="AI picture result" className="w-full rounded-xl border border-slate-200/70" />
              <div className="flex gap-2">
                <button type="button" className={btn} onClick={() => void use("item")}>Add to design</button>
                <button type="button" className={btn} onClick={() => void use("background")}>Use as background</button>
              </div>
            </div>
          )}
          <p className="text-[10px] text-slate-500">
            {usage ? `Pictures today: ${usage.used}/${usage.limit}. ` : ""}Each picture uses a paid Gemini feature, so there is a small daily limit.
          </p>
        </>
      }
    </div>
  );
}

export function ProBadge() {
  return <span className="ml-auto text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded bg-blue-600 text-white">PRO</span>;
}
