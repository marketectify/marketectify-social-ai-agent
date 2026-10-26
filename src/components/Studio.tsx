import { useState } from "react";
import {
  Sparkles,
  Hash,
  Video,
  Image,
  Wand2,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  Music,
  Check,
  ChevronDown,
  Loader2,
  Facebook,
  Instagram,
  Youtube,
} from "lucide-react";
import type { Platform } from "../types";
import { platformLabels } from "../data";

type PreviewPlatform = "instagram" | "tiktok" | "youtube";

const tones = ["Engaging", "Professional", "Humorous", "Inspirational", "Bold"];
const languages = ["English", "Spanish", "French", "German", "Hindi", "Portuguese"];
const audiences = ["Small Business Owners", "Marketing Agencies", "Content Creators", "E-commerce Brands", "Startups"];

export default function Studio() {
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("Engaging");
  const [audience, setAudience] = useState("Small Business Owners");
  const [language, setLanguage] = useState("English");
  const [activePreview, setActivePreview] = useState<PreviewPlatform>("instagram");

  const [generatedCaptions, setGeneratedCaptions] = useState(false);
  const [generatedScript, setGeneratedScript] = useState(false);
  const [generatedVisual, setGeneratedVisual] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleGenerate = (type: string) => {
    setLoading(type);
    setTimeout(() => {
      setLoading(null);
      if (type === "captions") setGeneratedCaptions(true);
      if (type === "script") setGeneratedScript(true);
      if (type === "visual") setGeneratedVisual(true);
    }, 1800);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-blue-600" />
          AI Content Creation Studio
        </h2>
        <p className="text-sm text-slate-600 mt-1">Generate captions, scripts, and visuals powered by GPT-4o & Gemini Pro.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left: Prompt & Generation Controls */}
        <div className="space-y-5">
          {/* Prompt input */}
          <div className="glass rounded-2xl p-5 space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-900 mb-2 block">Topic / Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Launch announcement for our new AI-powered social media scheduling feature..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-slate-100/50 border border-slate-200/50 text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
              />
            </div>

            {/* Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <SelectField label="Tone" value={tone} options={tones} onChange={setTone} />
              <SelectField label="Target Audience" value={audience} options={audiences} onChange={setAudience} />
              <SelectField label="Language" value={language} options={languages} onChange={setLanguage} />
            </div>
          </div>

          {/* AI Engine buttons */}
          <div className="glass rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-blue-600" />
              AI Generation Engines
            </h3>

            <GenerateButton
              icon={Hash}
              title="Generate Captions & Hashtags"
              subtitle="Powered by GPT-4o"
              gradient="from-blue-600 to-sky-600"
              loading={loading === "captions"}
              done={generatedCaptions}
              onClick={() => handleGenerate("captions")}
            />
            <GenerateButton
              icon={Video}
              title="Generate Reel / Short Video Script & Voiceover"
              subtitle="Powered by Gemini Pro"
              gradient="from-blue-600 to-cyan-600"
              loading={loading === "script"}
              done={generatedScript}
              onClick={() => handleGenerate("script")}
            />
            <GenerateButton
              icon={Image}
              title="Generate Visual Media / Graphics"
              subtitle="Powered by DALL·E 3"
              gradient="from-pink-600 to-rose-600"
              loading={loading === "visual"}
              done={generatedVisual}
              onClick={() => handleGenerate("visual")}
            />
          </div>

          {/* Output panels */}
          {(generatedCaptions || generatedScript || generatedVisual) && (
            <div className="space-y-4 animate-slide-in">
              {generatedCaptions && (
                <OutputCard title="Generated Captions & Hashtags" icon={Hash}>
                  <p className="text-sm text-slate-800 leading-relaxed">
                    🚀 The future of social media is here. Introducing Marketectify AI Scheduler — your all-in-one
                    command center for automated content across every platform. Schedule once, publish everywhere.
                    Never miss a beat again! ✨
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {["#AIMarketing", "#SocialMediaTools", "#ContentAutomation", "#MarketectifyAI", "#GrowthHacking", "#SaaS"].map((tag) => (
                      <span key={tag} className="px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-700 text-xs font-medium border border-blue-500/20">
                        {tag}
                      </span>
                    ))}
                  </div>
                </OutputCard>
              )}

              {generatedScript && (
                <OutputCard title="Reel Script & Voiceover" icon={Video}>
                  <div className="space-y-2 text-sm text-slate-800">
                    <p><span className="text-blue-600 font-semibold">[0:00-0:03]</span> Hook: "What if your social media ran itself?" (Voiceover: energetic, curious tone)</p>
                    <p><span className="text-blue-600 font-semibold">[0:03-0:08]</span> Visual: Quick montage of dashboards, calendar auto-filling, analytics climbing.</p>
                    <p><span className="text-blue-600 font-semibold">[0:08-0:15]</span> Narration: "Marketectify AI creates, schedules, and optimizes content across 4 platforms — automatically."</p>
                    <p><span className="text-blue-600 font-semibold">[0:15-0:25]</span> CTA: "Start your free trial today. Link in bio." (Upbeat music fade-out)</p>
                  </div>
                </OutputCard>
              )}

              {generatedVisual && (
                <OutputCard title="Generated Visual Media" icon={Image}>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="aspect-square rounded-xl bg-gradient-to-br from-blue-600 via-sky-600 to-blue-600 flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-black/20" />
                      <p className="relative text-white font-bold text-sm text-center px-4">AI-Generated Hero Graphic</p>
                    </div>
                    <div className="aspect-square rounded-xl bg-gradient-to-br from-pink-600 via-rose-600 to-orange-500 flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-black/20" />
                      <p className="relative text-white font-bold text-sm text-center px-4">Story Template Variant</p>
                    </div>
                  </div>
                </OutputCard>
              )}
            </div>
          )}
        </div>

        {/* Right: Live Preview */}
        <div className="xl:sticky xl:top-24 self-start">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">Live Preview</h3>
              <div className="flex items-center gap-1.5">
                {(["instagram", "tiktok", "youtube"] as PreviewPlatform[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setActivePreview(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      activePreview === p
                        ? "bg-blue-500/20 text-blue-700 border border-blue-500/30"
                        : "text-slate-600 hover:text-slate-800 border border-transparent"
                    }`}
                  >
                    {platformLabels[p]}
                  </button>
                ))}
              </div>
            </div>

            {activePreview === "instagram" && <InstagramPreview />}
            {activePreview === "tiktok" && <TikTokPreview />}
            {activePreview === "youtube" && <YouTubePreview />}
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 mb-1.5 block">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 px-3 pr-8 rounded-xl bg-slate-100/50 border border-slate-200/50 text-sm text-slate-800 focus:outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer"
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
      </div>
    </div>
  );
}

function GenerateButton({
  icon: Icon,
  title,
  subtitle,
  gradient,
  loading,
  done,
  onClick,
}: {
  icon: typeof Hash;
  title: string;
  subtitle: string;
  gradient: string;
  loading: boolean;
  done: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full group flex items-center gap-3 p-3.5 rounded-xl glass-light hover:border-slate-300 transition-all hover:scale-[1.01] active:scale-[0.99] text-left disabled:opacity-60"
    >
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
        {loading ? (
          <Loader2 className="w-5 h-5 text-white animate-spin" />
        ) : done ? (
          <Check className="w-5 h-5 text-white" />
        ) : (
          <Icon className="w-5 h-5 text-white" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-[11px] text-slate-500">{loading ? "Generating..." : done ? "Generated ✓ — click to regenerate" : subtitle}</p>
      </div>
      {done && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
    </button>
  );
}

function OutputCard({ title, icon: Icon, children }: { title: string; icon: typeof Hash; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-5">
      <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-blue-600" />
        {title}
      </h4>
      {children}
    </div>
  );
}

function InstagramPreview() {
  return (
    <div className="max-w-sm mx-auto rounded-2xl overflow-hidden bg-white border border-slate-200/50 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2.5 p-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-amber-500 p-0.5">
          <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-xs font-bold text-slate-900">
            MK
          </div>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900">marketking.co</p>
          <p className="text-[10px] text-slate-500">Sponsored</p>
        </div>
        <MoreHorizontal className="w-5 h-5 text-slate-600" />
      </div>

      {/* Image */}
      <div className="aspect-[4/5] bg-gradient-to-br from-blue-600 via-sky-600 to-blue-600 relative flex items-center justify-center">
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative text-center px-6">
          <Sparkles className="w-10 h-10 text-white/90 mx-auto mb-3" />
          <p className="text-white font-bold text-lg">The Future of Social Media is Here</p>
          <p className="text-white/70 text-sm mt-1">Marketectify AI Scheduler</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 p-3">
        <Heart className="w-6 h-6 text-red-400" fill="currentColor" />
        <MessageCircle className="w-6 h-6 text-slate-700" />
        <Send className="w-6 h-6 text-slate-700" />
        <Bookmark className="w-6 h-6 text-slate-700 ml-auto" />
      </div>

      {/* Caption */}
      <div className="px-3 pb-4">
        <p className="text-sm text-slate-900">
          <span className="font-semibold">marketking.co</span>{" "}
          🚀 The future of social media is here. Introducing Marketectify AI Scheduler — your all-in-one command center for automated content!
        </p>
        <p className="text-xs text-blue-600 mt-1.5">#AIMarketing #SocialMediaTools #ContentAutomation #MarketectifyAI</p>
        <p className="text-[10px] text-slate-500 mt-2">View all 1,247 comments</p>
      </div>
    </div>
  );
}

function TikTokPreview() {
  return (
    <div className="max-w-sm mx-auto rounded-2xl overflow-hidden bg-black border border-slate-200/50 aspect-[9/16] relative animate-fade-in">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-700 via-sky-700 to-slate-900" />
      <div className="absolute inset-0 bg-black/20" />

      {/* Content */}
      <div className="relative h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center">
            <Sparkles className="w-12 h-12 text-white/90 mx-auto mb-3" />
            <p className="text-white font-bold text-xl">What if your social media ran itself?</p>
          </div>
        </div>

        {/* Right side actions */}
        <div className="absolute right-2 bottom-20 flex flex-col items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-slate-100/80 flex items-center justify-center">
            <Heart className="w-6 h-6 text-white" fill="white" />
          </div>
          <span className="text-[10px] text-white font-medium">89.2K</span>
          <div className="w-11 h-11 rounded-full bg-slate-100/80 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <span className="text-[10px] text-white font-medium">1,247</span>
          <div className="w-11 h-11 rounded-full bg-slate-100/80 flex items-center justify-center">
            <Bookmark className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* Bottom info */}
        <div className="absolute left-3 right-16 bottom-4">
          <p className="text-sm font-bold text-white">marketking.co</p>
          <p className="text-xs text-white/80 mt-1">🚀 The future of social media is here. Marketectify AI Scheduler — all-in-one automation! #AI #SocialMedia</p>
          <div className="flex items-center gap-1.5 mt-2">
            <Music className="w-3 h-3 text-white" />
            <p className="text-[10px] text-white/70">Original Sound — Marketectify AI</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function YouTubePreview() {
  return (
    <div className="max-w-sm mx-auto rounded-2xl overflow-hidden bg-white border border-slate-200/50 animate-fade-in">
      {/* Video area */}
      <div className="aspect-[16/9] bg-gradient-to-br from-red-600 via-rose-600 to-slate-900 relative flex items-center justify-center">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative text-center px-6">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-2">
            <div className="w-0 h-0 border-l-[12px] border-l-white border-y-[8px] border-y-transparent ml-1" />
          </div>
          <p className="text-white font-bold text-sm">AI Scheduler Launch — 0:25</p>
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <p className="text-sm font-bold text-slate-900 leading-tight">
          🚀 The Future of Social Media: Marketectify AI Scheduler Launch
        </p>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span>1.2M views</span>
          <span>·</span>
          <span>3 days ago</span>
        </div>
        <div className="flex items-center gap-2.5 pt-2 border-t border-slate-200">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center text-xs font-bold text-white">
            MK
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-slate-900">MarketKing Co.</p>
            <p className="text-[10px] text-slate-500">124K subscribers</p>
          </div>
          <button className="px-3 py-1.5 rounded-full bg-white text-xs font-bold text-black">Subscribe</button>
        </div>
        <p className="text-xs text-slate-600 pt-1">
          Introducing Marketectify AI Scheduler — create, schedule, and optimize content across 4 platforms automatically. Start your free trial today!
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {["#AI", "#SocialMedia", "#SaaS", "#ContentCreation"].map((tag) => (
            <span key={tag} className="text-[10px] text-blue-600 font-medium">{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
