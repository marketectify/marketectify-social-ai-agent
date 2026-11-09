import { useState } from "react";
import { CheckCircle2, Loader2, Plug, Unplug } from "lucide-react";
import type { Platform } from "../types";
import { platformLabels } from "../data";
import { platformIcons } from "./PlatformIcon";
import { useSocialAccounts } from "../context/SocialAccountsContext";
import { useToast } from "../context/ToastContext";
import { formatCount, youtubeNeedsReconnect } from "../lib/socialAccounts";
import { ALL_PLATFORMS, isAutoPublish } from "../lib/platforms";

const INFO: Record<Platform, { does: string; note?: string }> = {
  facebook: { does: "Posts, scheduling and comment replies on your Page.", note: "One Facebook login also connects the Instagram account linked to the Page." },
  instagram: { does: "Photo posts, scheduling and comment replies.", note: "Needs an Instagram Business or Creator account linked to your Facebook Page." },
  linkedin: { does: "Posts and scheduling on your personal LinkedIn profile.", note: "The login lasts about 60 days; connect again when it expires. Company Pages need extra approval from LinkedIn." },
  youtube: { does: "Posts videos, reads comments and answers them. Channel numbers in the dashboard.", note: "Until Google audits your project, YouTube keeps uploaded videos private; you can make them public in YouTube Studio." },
  tiktok: { does: "Not available yet.", note: "TikTok needs approval for apps. Post by hand and mark it as published." },
  gbp: { does: "\"What's new\" posts on your Google Business Profile (picture and text, no video).", note: "Connects the first location of your Google account. Google must approve Business Profile API access for your project first." },
};

export default function Accounts() {
  const social = useSocialAccounts();
  const toast = useToast();
  const [busy, setBusy] = useState<Platform | null>(null);

  const connect = async (p: Platform) => {
    setBusy(p);
    try {
      await social.connect(p);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the connection.");
      setBusy(null);
    }
  };
  const disconnect = async (p: Platform, id: string) => {
    if (!window.confirm(`Disconnect ${platformLabels[p]}? Scheduled posts for it will stop going out.`)) return;
    try {
      await social.disconnect(id);
      toast.success("Account disconnected");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not disconnect.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Connected accounts</h2>
        <p className="text-sm text-slate-600 mt-1 max-w-2xl">
          Connect each account once. Posts to Facebook, Instagram and LinkedIn are then published for you at the scheduled time.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ALL_PLATFORMS.map((p) => {
          const Icon = platformIcons[p];
          const account = social.get(p);
          const canConnect = social.connectable.includes(p);
          return (
            <section key={p} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-3" aria-label={platformLabels[p]}>
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900">{platformLabels[p]}</h3>
                  <p className="text-xs text-slate-600">{isAutoPublish(p) ? "Automatic publishing" : INFO[p].does}</p>
                </div>
              </div>
              {account ? (
                <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="truncate" title={account.displayName}>
                    {account.displayName}
                  </span>
                  {account.subscribers !== null && <span className="text-slate-500 font-normal">· {formatCount(account.subscribers)}</span>}
                </div>
              ) : null}
              {account && youtubeNeedsReconnect(account) && (
                <p role="status" className="text-xs rounded-lg bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300 px-2.5 py-2">
                  This connection can only read numbers. Connect again and allow posting and comments.
                </p>
              )}
              <p className="text-xs text-slate-600">{isAutoPublish(p) ? INFO[p].does : ""} {INFO[p].note}</p>
              <div className="mt-auto">
                {account ? (
                  <div className="flex items-center gap-4">
                    {youtubeNeedsReconnect(account) && canConnect && (
                      <button
                        onClick={() => void connect(p)}
                        disabled={busy !== null}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
                      >
                        {busy === p ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
                        Connect again
                      </button>
                    )}
                    <button onClick={() => void disconnect(p, account.id)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:underline">
                      <Unplug className="w-3.5 h-3.5" /> Disconnect
                    </button>
                  </div>
                ) : canConnect ? (
                  <button
                    onClick={() => void connect(p)}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
                  >
                    {busy === p ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
                    Connect {platformLabels[p]}
                  </button>
                ) : (
                  <span className="text-xs font-medium text-slate-500">Not available yet</span>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
