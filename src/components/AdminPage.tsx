import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { usePlan } from "../context/PlanContext";
import { useToast } from "../context/ToastContext";
import { adminAccounts, adminRequests, adminResolve, adminSetPlan, type AdminAccount, type AdminRequest } from "../lib/upgrade";
import { formatDateTime } from "../lib/dates";
import type { Plan } from "../lib/plan";

/** Only for the site owner: answer upgrade requests and see which account is on which plan. */
export default function AdminPage() {
  const { isAdmin, refresh } = usePlan();
  const toast = useToast();
  const [requests, setRequests] = useState<AdminRequest[]>([]);
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const [r, a] = await Promise.all([adminRequests(supabase), adminAccounts(supabase)]);
      setRequests(r);
      setAccounts(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the admin data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  if (!isAdmin) {
    return <p className="text-sm text-slate-700">This page is only for the site owner.</p>;
  }

  const act = async (id: string, work: () => Promise<void>, done: string) => {
    if (!supabase) return;
    setBusyId(id);
    try {
      await work();
      toast.success(done);
      await load();
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not do that. Please try again.");
    } finally {
      setBusyId(null);
    }
  };

  const pending = requests.filter((r) => r.status === "pending");
  const answered = requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Admin</h2>
        <p className="text-sm text-slate-600 mt-1">Answer upgrade requests and manage plans. Only you can see this page.</p>
      </header>

      {error && (
        <div role="alert" className="text-sm text-red-800 dark:text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-3">
          <span className="flex-1">{error}</span>
          <button onClick={() => void load()} className="font-semibold underline">Try again</button>
        </div>
      )}

      <section aria-labelledby="req-title">
        <h3 id="req-title" className="text-lg font-bold text-slate-900 mb-3">
          Upgrade requests {pending.length > 0 && <span className="ml-1 text-xs font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">{pending.length} new</span>}
        </h3>
        {loading ? (
          <div className="h-20 rounded-xl bg-slate-100 animate-pulse" aria-hidden="true" />
        ) : pending.length === 0 ? (
          <p className="text-sm text-slate-600 glass rounded-2xl p-4">No requests are waiting.</p>
        ) : (
          <ul className="glass rounded-2xl divide-y divide-slate-200/80">
            {pending.map((r) => (
              <li key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{r.workspaceName} <span className="font-normal text-slate-600">· {r.email}</span></p>
                  <p className="text-sm text-slate-800">Contact: <strong>{r.contact}</strong></p>
                  {r.note && <p className="text-xs text-slate-600 mt-0.5 break-words">“{r.note}”</p>}
                  <p className="text-[11px] text-slate-500 mt-0.5">{formatDateTime(r.createdAt)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    disabled={busyId === r.id}
                    onClick={() => void act(r.id, () => adminResolve(supabase!, r.id, true), `${r.workspaceName} is now on Pro.`)}
                    className="h-9 px-3 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 disabled:opacity-60 inline-flex items-center gap-1.5"
                  >
                    {busyId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Check className="w-3.5 h-3.5" aria-hidden="true" />} Approve
                  </button>
                  <button
                    disabled={busyId === r.id}
                    onClick={() => void act(r.id, () => adminResolve(supabase!, r.id, false), "Request rejected.")}
                    className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-100/70 disabled:opacity-60 inline-flex items-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" /> Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {answered.length > 0 && (
          <p className="text-xs text-slate-600 mt-2">{answered.length} earlier request{answered.length === 1 ? "" : "s"} answered ({answered.filter((r) => r.status === "approved").length} approved).</p>
        )}
      </section>

      <section aria-labelledby="acc-title">
        <h3 id="acc-title" className="text-lg font-bold text-slate-900 mb-3">Accounts</h3>
        {loading ? (
          <div className="h-24 rounded-xl bg-slate-100 animate-pulse" aria-hidden="true" />
        ) : (
          <div className="glass rounded-2xl overflow-x-auto">
            <table className="w-full text-sm min-w-[32rem]">
              <thead>
                <tr className="text-xs text-slate-600 text-left">
                  <th className="font-medium p-3">Account</th>
                  <th className="font-medium p-3">Created</th>
                  <th className="font-medium p-3">Plan</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.workspaceId} className="border-t border-slate-200/70">
                    <td className="p-3">
                      <p className="font-medium text-slate-900">{a.workspaceName}</p>
                      <p className="text-xs text-slate-600">{a.email}</p>
                    </td>
                    <td className="p-3 text-xs text-slate-600">{formatDateTime(a.createdAt)}</td>
                    <td className="p-3">
                      <label className="sr-only" htmlFor={`plan-${a.workspaceId}`}>Plan of {a.workspaceName}</label>
                      <select
                        id={`plan-${a.workspaceId}`}
                        value={a.plan}
                        disabled={busyId === a.workspaceId}
                        onChange={(e) => void act(a.workspaceId, () => adminSetPlan(supabase!, a.workspaceId, e.target.value as Plan), `${a.workspaceName} is now on ${e.target.value === "pro" ? "Pro" : "Free"}.`)}
                        className="h-9 px-2 rounded-lg bg-slate-100/50 border border-slate-200 text-sm text-slate-800"
                      >
                        <option value="free">Free</option>
                        <option value="pro">Pro</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
