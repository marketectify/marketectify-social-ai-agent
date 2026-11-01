import { Check, Minus, Sparkles } from "lucide-react";
import { usePlan } from "../context/PlanContext";
import { PLAN_FEATURES } from "../lib/plan";
import UpgradeForm from "./UpgradeForm";

/** "Plan & Billing": what is in each plan and how to upgrade. */
export default function PlanPage() {
  const { isPro, plan } = usePlan();
  const price = (import.meta.env.VITE_PRO_PRICE as string | undefined)?.trim();

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <header>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Plan &amp; billing</h2>
        <p className="text-sm text-slate-600 mt-1">
          You are on the <strong className="text-slate-900">{plan === "pro" ? "Pro" : "Free"}</strong> plan.
          {isPro ? " Thank you for supporting Marketectify." : " Pro adds the paid AI features."}
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <section className="md:col-span-3 glass rounded-2xl p-5" aria-labelledby="compare-title">
          <h3 id="compare-title" className="text-lg font-bold text-slate-900 mb-3">What each plan includes</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-600 text-left">
                <th className="font-medium pb-2">Feature</th>
                <th className="font-semibold pb-2 px-2 text-center">Free</th>
                <th className="font-semibold pb-2 px-2 text-center text-blue-700 dark:text-blue-300">Pro</th>
              </tr>
            </thead>
            <tbody>
              {PLAN_FEATURES.map((f) => (
                <tr key={f.label} className="border-t border-slate-200/70">
                  <td className="py-2.5 pr-2 text-slate-800">
                    {f.label}
                    {f.note && <span className="ml-1.5 text-[10px] font-medium text-slate-500">({f.note})</span>}
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    {f.free ? <Check className="w-4 h-4 inline text-emerald-600" aria-label="Included" /> : <Minus className="w-4 h-4 inline text-slate-400" aria-label="Not included" />}
                  </td>
                  <td className="py-2.5 px-2 text-center"><Check className="w-4 h-4 inline text-emerald-600" aria-label="Included" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="md:col-span-2 glass rounded-2xl p-5 space-y-4" aria-labelledby="upgrade-page-title">
          <div>
            <h3 id="upgrade-page-title" className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" aria-hidden="true" /> Pro plan
            </h3>
            {price && <p className="text-sm font-semibold text-slate-900 mt-1">{price}</p>}
          </div>
          <UpgradeForm />
        </section>
      </div>

      <section className="glass rounded-2xl p-5" aria-labelledby="how-title">
        <h3 id="how-title" className="text-sm font-bold text-slate-900 mb-2">How upgrading works</h3>
        <ol className="list-decimal pl-5 space-y-1 text-sm text-slate-700">
          <li>Send the request with the number or email we can reach you on.</li>
          <li>We contact you, agree the price and take the payment.</li>
          <li>We switch your account to Pro. Reload this page and the Pro features unlock.</li>
        </ol>
      </section>
    </div>
  );
}
