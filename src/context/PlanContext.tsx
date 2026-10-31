import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Minus, Sparkles, X } from "lucide-react";
import { useAuth } from "./AuthContext";
import { supabase } from "../lib/supabase";
import { PLAN_FEATURES, PRO_FEATURE_LABELS, fetchPlan, upgradeLink, type Plan, type ProFeature } from "../lib/plan";

interface PlanContextValue {
  plan: Plan;
  isPro: boolean;
  /** Re-reads the plan (for example after you were upgraded). */
  refresh: () => Promise<void>;
  /** Opens the upgrade window. `feature` says what the person tried to use. */
  showUpgrade: (feature?: ProFeature) => void;
  /** True when the feature may be used. Otherwise opens the upgrade window and returns false. */
  requirePro: (feature: ProFeature) => boolean;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const { mode, user } = useAuth();
  const [plan, setPlan] = useState<Plan>("free");
  const [dialog, setDialog] = useState<{ feature?: ProFeature } | null>(null);
  const userId = user?.id ?? null;

  const refresh = useCallback(async () => {
    if (mode === "demo" || !supabase || !userId) {
      setPlan("free");
      return;
    }
    setPlan(await fetchPlan(supabase));
  }, [mode, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // After upgrading in another tab, coming back to this one picks the new plan up.
  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const showUpgrade = useCallback((feature?: ProFeature) => setDialog({ feature }), []);
  const requirePro = useCallback(
    (feature: ProFeature) => {
      if (plan === "pro") return true;
      setDialog({ feature });
      return false;
    },
    [plan],
  );

  const value = useMemo<PlanContextValue>(
    () => ({ plan, isPro: plan === "pro", refresh, showUpgrade, requirePro }),
    [plan, refresh, showUpgrade, requirePro],
  );

  return (
    <PlanContext.Provider value={value}>
      {children}
      {dialog && <UpgradeDialog plan={plan} feature={dialog.feature} onClose={() => setDialog(null)} />}
    </PlanContext.Provider>
  );
}

export function usePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used inside <PlanProvider>");
  return ctx;
}

function UpgradeDialog({ plan, feature, onClose }: { plan: Plan; feature?: ProFeature; onClose: () => void }) {
  const link = upgradeLink(import.meta.env.VITE_UPGRADE_CONTACT as string | undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-[60] backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-title"
        className="fixed z-[60] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl glass border border-slate-200 bg-surface p-5 space-y-4 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="upgrade-title" className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" aria-hidden="true" /> Upgrade your account
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {feature
                ? `${PRO_FEATURE_LABELS[feature]} are part of the Pro plan.`
                : "Pro unlocks the paid AI features."}{" "}
              {plan === "pro" ? "Your account is already on Pro." : "You are on the Free plan."}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg hover:bg-slate-100/70">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500">
              <th className="text-left font-medium pb-2">What you get</th>
              <th className="font-semibold pb-2 px-2">Free</th>
              <th className="font-semibold pb-2 px-2 text-blue-700 dark:text-blue-300">Pro</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_FEATURES.map((f) => (
              <tr key={f.label} className="border-t border-slate-200/70">
                <td className="py-2 pr-2 text-slate-800">
                  {f.label}
                  {f.note && <span className="ml-1.5 text-[10px] font-medium text-slate-500">({f.note})</span>}
                </td>
                <td className="py-2 px-2 text-center">
                  {f.free ? <Check className="w-4 h-4 inline text-emerald-600" aria-label="Included" /> : <Minus className="w-4 h-4 inline text-slate-400" aria-label="Not included" />}
                </td>
                <td className="py-2 px-2 text-center">
                  <Check className="w-4 h-4 inline text-emerald-600" aria-label="Included" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {plan === "pro" ? (
          <button onClick={onClose} className="w-full h-11 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700">
            Close
          </button>
        ) : link ? (
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center w-full h-11 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {link.label}
          </a>
        ) : (
          <p className="text-sm text-slate-700 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
            To upgrade, please contact the Marketectify team. We will switch your account to Pro.
          </p>
        )}
      </div>
    </>,
    document.body,
  );
}
