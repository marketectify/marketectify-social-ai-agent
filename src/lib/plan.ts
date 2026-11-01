import type { SupabaseClient } from "@supabase/supabase-js";

export type Plan = "free" | "pro";

/** Things only the Pro plan can use. */
export type ProFeature = "ai-picture" | "ai-video";

export const PRO_FEATURE_LABELS: Record<ProFeature, string> = {
  "ai-picture": "AI pictures",
  "ai-video": "AI videos",
};

export const PLAN_FEATURES: { label: string; free: boolean; pro: boolean; note?: string }[] = [
  { label: "AI captions, scripts, visual ideas and reply drafts", free: true, pro: true },
  { label: "Design Studio (drag and drop post designer)", free: true, pro: true },
  { label: "Calendar, approvals, inbox and analytics", free: true, pro: true },
  { label: "YouTube connection", free: true, pro: true },
  { label: "AI pictures", free: false, pro: true },
  { label: "AI videos", free: false, pro: true, note: "coming soon" },
];

export function parsePlan(value: unknown): Plan {
  return value === "pro" ? "pro" : "free";
}

/** Reads the plan of the signed-in user. Any problem means "free": the server enforces it anyway. */
export async function fetchPlan(client: SupabaseClient): Promise<Plan> {
  try {
    const { data, error } = await client.rpc("my_plan");
    if (error) return "free";
    return parsePlan(data);
  } catch {
    return "free";
  }
}

/** Where the "Upgrade" button leads: an email address, a web address, or nothing (then the dialog says to ask the team). */
export function upgradeLink(contact: string | undefined): { href: string; label: string } | null {
  const value = (contact ?? "").trim();
  if (!value) return null;
  if (/^https:\/\/[^\s]+$/i.test(value)) return { href: value, label: "Upgrade now" };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { href: `mailto:${value}?subject=${encodeURIComponent("Upgrade my Marketectify account")}`, label: "Email us to upgrade" };
  }
  return null;
}
