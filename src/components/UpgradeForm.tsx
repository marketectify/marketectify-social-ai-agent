import { useState } from "react";
import { Check, Loader2, Send } from "lucide-react";
import { usePlan } from "../context/PlanContext";
import { CONTACT_LIMITS, validateContact } from "../lib/upgrade";
import { upgradeLink } from "../lib/plan";
import { formatDateTime } from "../lib/dates";

/** Asks for contact details and sends the upgrade request. Also shows what happened to an earlier request. */
export default function UpgradeForm() {
  const { isPro, request, canRequest, submitRequest } = usePlan();
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = upgradeLink(import.meta.env.VITE_UPGRADE_CONTACT as string | undefined);

  if (isPro) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
        <Check className="w-4 h-4" aria-hidden="true" /> Your account is on the Pro plan.
      </p>
    );
  }

  if (request?.status === "pending") {
    return (
      <div role="status" className="text-sm text-slate-800 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 space-y-1">
        <p className="font-semibold flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" aria-hidden="true" /> Upgrade request sent</p>
        <p>We will contact you on <strong>{request.contact}</strong>. Sent {formatDateTime(request.createdAt)}.</p>
        <p className="text-xs text-slate-600">Your plan changes as soon as we approve it. This page updates when you come back to it.</p>
      </div>
    );
  }

  if (!canRequest) {
    return (
      <p className="text-sm text-slate-700 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
        Upgrade requests need a signed-in account with the database connected.
        {link && <> <a className="font-semibold underline" href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>.</>}
      </p>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateContact(contact, note);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await submitRequest(contact, note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the request. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const field = "w-full rounded-xl px-3 py-2 text-sm bg-slate-100/50 border border-slate-200 text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20";
  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      {request?.status === "rejected" && (
        <p role="status" className="text-xs text-amber-900 dark:text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2">
          Your last request was not approved. You can send a new one.
        </p>
      )}
      <div>
        <label htmlFor="upgrade-contact" className="text-xs font-semibold text-slate-700 block mb-1">Phone, WhatsApp or email</label>
        <input id="upgrade-contact" value={contact} maxLength={CONTACT_LIMITS.contactMax} onChange={(e) => setContact(e.target.value)} placeholder="e.g. 0300 1234567" autoComplete="tel" className={field} />
      </div>
      <div>
        <label htmlFor="upgrade-note" className="text-xs font-semibold text-slate-700 block mb-1">Anything we should know? (optional)</label>
        <textarea id="upgrade-note" value={note} maxLength={CONTACT_LIMITS.noteMax} rows={2} onChange={(e) => setNote(e.target.value)} placeholder="e.g. I manage 3 client pages and want AI pictures." className={`${field} resize-none`} />
      </div>
      {error && <p role="alert" className="text-xs text-red-800 dark:text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-2">{error}</p>}
      <button type="submit" disabled={busy} className="w-full h-11 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 inline-flex items-center justify-center gap-2">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Send className="w-4 h-4" aria-hidden="true" />}
        {busy ? "Sending…" : "Request Pro plan"}
      </button>
      <p className="text-[11px] text-slate-600">We will contact you to agree the price and switch your account to Pro. You do not pay anything by sending this.</p>
    </form>
  );
}
