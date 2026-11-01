import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Minus, Sparkles, X } from "lucide-react";
import { useAuth } from "./AuthContext";
import { supabase } from "../lib/supabase";
import { PLAN_FEATURES, PRO_FEATURE_LABELS, fetchPlan, type Plan, type ProFeature } from "../lib/plan";
import { fetchIsAdmin, fetchMyRequest, sendUpgradeRequest, type UpgradeRequest } from "../lib/upgrade";
import UpgradeForm from "../components/UpgradeForm";

interface PlanContextValue {
  plan: Plan;
  isPro: boolean;
  /** True for the site owner(s) who may approve upgrade requests (set in SQL, see docs/SETUP.md). */
  isAdmin: boolean;
  /** The latest upgrade request of this account, if any. */
  request: UpgradeRequest | null;
  /** False in demo mode: there is no database to send a request to. */
  canRequest: boolean;
  submitRequest: (contact: string, note: string) => Promise<void>;
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [request, setRequest] = useState<UpgradeRequest | null>(null);
  const [dialog, setDialog] = useState<{ feature?: ProFeature } | null>(null);
  const userId = user?.id ?? null;

  const refresh = useCallback(async () => {
    if (mode === "demo" || !supabase || !userId) {
      setPlan("free");
      setIsAdmin(false);
      setRequest(null);
      return;
    }
    const [p, admin, req] = await Promise.all([fetchPlan(supabase), fetchIsAdmin(supabase), fetchMyRequest(supabase)]);
    setPlan(p);
    setIsAdmin(admin);
    setRequest(req);
  }, [mode, userId]);

  const canRequest = mode !== "demo" && Boolean(supabase) && Boolean(userId);
  const submitRequest = useCallback(
    async (contact: string, note: string) => {
      if (!supabase) throw new Error("Upgrade requests need the database connection.");
      setRequest(await sendUpgradeRequest(supabase, contact, note));
    },
    [],
  );

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
    () => ({ plan, isPro: plan === "pro", isAdmin, request, canRequest, submitRequest, refresh, showUpgrade, requirePro }),
    [plan, isAdmin, request, canRequest, submitRequest, refresh, showUpgrade, requirePro],
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

        <UpgradeForm />
      </div>
    </>,
    document.body,
  );
}
