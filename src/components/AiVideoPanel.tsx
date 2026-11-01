import { useState } from "react";
import { Clapperboard, Lock } from "lucide-react";
import { usePlan } from "../context/PlanContext";
import { ProBadge } from "./AiPicturePanel";

/** "AI video" box in the Design Studio. Free accounts see the upgrade window; making videos is not built yet. */
export default function AiVideoPanel() {
  const { isPro, requirePro } = usePlan();
  const [prompt, setPrompt] = useState("");
  const [soon, setSoon] = useState(false);

  const click = () => {
    if (!requirePro("ai-video")) return;
    setSoon(true);
  };

  const field = "w-full rounded-lg px-2.5 py-2 text-xs bg-slate-100/50 border border-slate-200/70 text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60";

  return (
    <div className="glass rounded-2xl p-4 space-y-2.5">
      <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
        <Clapperboard className="w-4 h-4 text-blue-600 dark:text-blue-400" aria-hidden="true" /> AI video
        {!isPro && <ProBadge />}
      </h3>
      <label className="sr-only" htmlFor="ai-video-prompt">Describe the video</label>
      <textarea
        id="ai-video-prompt"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        maxLength={600}
        rows={2}
        placeholder="e.g. slow zoom on a coffee cup, steam rising"
        className={`${field} resize-none`}
      />
      <button
        type="button"
        onClick={click}
        className="w-full h-9 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 inline-flex items-center justify-center gap-1.5"
      >
        {!isPro && <Lock className="w-3.5 h-3.5" aria-hidden="true" />} Make video
      </button>
      {soon && (
        <p role="status" className="text-[11px] text-slate-700 bg-blue-500/10 border border-blue-500/20 rounded-lg p-2">
          AI video is coming soon. Your Pro plan will include it as soon as it is ready.
        </p>
      )}
    </div>
  );
}
