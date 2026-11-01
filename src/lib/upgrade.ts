import type { SupabaseClient } from "@supabase/supabase-js";
import { parsePlan, type Plan } from "./plan";

export type RequestStatus = "pending" | "approved" | "rejected";

export interface UpgradeRequest {
  id: string;
  status: RequestStatus;
  contact: string;
  note: string;
  createdAt: string;
}

export interface AdminRequest extends UpgradeRequest {
  workspaceId: string;
  workspaceName: string;
  email: string;
  resolvedAt: string | null;
}

export interface AdminAccount {
  workspaceId: string;
  workspaceName: string;
  email: string;
  plan: Plan;
  createdAt: string;
}

export const CONTACT_LIMITS = { contactMin: 3, contactMax: 120, noteMax: 500 } as const;

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function parseStatus(v: unknown): RequestStatus {
  return v === "approved" || v === "rejected" ? v : "pending";
}

export function parseRequest(row: unknown): UpgradeRequest | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string") return null;
  return { id: r.id, status: parseStatus(r.status), contact: str(r.contact), note: str(r.note), createdAt: str(r.created_at) };
}

export function parseAdminRequest(row: unknown): AdminRequest | null {
  const base = parseRequest(row);
  if (!base) return null;
  const r = row as Record<string, unknown>;
  return {
    ...base,
    workspaceId: str(r.workspace_id),
    workspaceName: str(r.workspace_name),
    email: str(r.email),
    resolvedAt: typeof r.resolved_at === "string" ? r.resolved_at : null,
  };
}

export function parseAccount(row: unknown): AdminAccount | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  if (typeof r.workspace_id !== "string") return null;
  return { workspaceId: r.workspace_id, workspaceName: str(r.workspace_name), email: str(r.email), plan: parsePlan(r.plan), createdAt: str(r.created_at) };
}

/** Returns a message when the contact details cannot be sent, otherwise null. */
export function validateContact(contact: string, note: string): string | null {
  const c = contact.trim();
  if (c.length < CONTACT_LIMITS.contactMin) return "Add a phone number, WhatsApp number or email we can reach you on.";
  if (c.length > CONTACT_LIMITS.contactMax) return `The contact is too long (maximum ${CONTACT_LIMITS.contactMax} characters).`;
  if (note.trim().length > CONTACT_LIMITS.noteMax) return `The note is too long (maximum ${CONTACT_LIMITS.noteMax} characters).`;
  return null;
}

function fail(error: { message: string }): never {
  throw new Error(error.message || "Something went wrong. Please try again.");
}

/** The latest request of the signed-in user, or null. Reading is allowed by row level security. */
export async function fetchMyRequest(client: SupabaseClient): Promise<UpgradeRequest | null> {
  const { data, error } = await client
    .from("upgrade_requests")
    .select("id,status,contact,note,created_at")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return null; // before 0010 is run the table does not exist: show nothing
  return parseRequest((data ?? [])[0]);
}

export async function sendUpgradeRequest(client: SupabaseClient, contact: string, note: string): Promise<UpgradeRequest> {
  const problem = validateContact(contact, note);
  if (problem) throw new Error(problem);
  const { data, error } = await client.rpc("request_upgrade", { p_contact: contact.trim(), p_note: note.trim() });
  if (error) {
    throw new Error(/could not find the function|does not exist/i.test(error.message) ? "Upgrades are not set up yet. The site owner needs to run the 0010 SQL file." : error.message);
  }
  const parsed = parseRequest(Array.isArray(data) ? data[0] : data);
  if (!parsed) throw new Error("The request was sent but the answer was unexpected. Please reload the page.");
  return parsed;
}

export async function fetchIsAdmin(client: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await client.rpc("is_admin");
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function adminRequests(client: SupabaseClient): Promise<AdminRequest[]> {
  const { data, error } = await client.rpc("admin_list_upgrade_requests");
  if (error) fail(error);
  return ((data as unknown[]) ?? []).map(parseAdminRequest).filter((r): r is AdminRequest => r !== null);
}

export async function adminAccounts(client: SupabaseClient): Promise<AdminAccount[]> {
  const { data, error } = await client.rpc("admin_list_accounts");
  if (error) fail(error);
  return ((data as unknown[]) ?? []).map(parseAccount).filter((a): a is AdminAccount => a !== null);
}

export async function adminResolve(client: SupabaseClient, id: string, approve: boolean): Promise<void> {
  const { error } = await client.rpc("admin_resolve_upgrade", { p_id: id, p_approve: approve });
  if (error) fail(error);
}

export async function adminSetPlan(client: SupabaseClient, workspaceId: string, plan: Plan): Promise<void> {
  const { error } = await client.rpc("admin_set_plan", { p_workspace: workspaceId, p_plan: plan });
  if (error) fail(error);
}
