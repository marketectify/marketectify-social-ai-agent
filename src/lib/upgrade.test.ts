import { describe, expect, it } from "vitest";
import { adminResolve, fetchIsAdmin, fetchMyRequest, parseAccount, parseAdminRequest, parseRequest, parseStatus, sendUpgradeRequest, validateContact } from "./upgrade";

const client = (over: Record<string, unknown>) => over as never;

describe("parsers", () => {
  it("parses a request and defaults unknown statuses to pending", () => {
    expect(parseStatus("approved")).toBe("approved");
    expect(parseStatus("weird")).toBe("pending");
    expect(parseRequest({ id: "1", status: "rejected", contact: "c", note: "n", created_at: "t" })).toEqual({ id: "1", status: "rejected", contact: "c", note: "n", createdAt: "t" });
    expect(parseRequest(null)).toBeNull();
    expect(parseRequest({ status: "pending" })).toBeNull();
  });
  it("parses admin rows", () => {
    expect(parseAdminRequest({ id: "1", workspace_id: "w", workspace_name: "W", email: "a@x.com", resolved_at: null })).toMatchObject({ workspaceName: "W", email: "a@x.com", resolvedAt: null });
    expect(parseAccount({ workspace_id: "w", plan: "pro", email: "a@x.com" })).toMatchObject({ plan: "pro" });
    expect(parseAccount({ workspace_id: "w", plan: "gold" })?.plan).toBe("free");
    expect(parseAccount({})).toBeNull();
  });
});

describe("validateContact", () => {
  it("checks length", () => {
    expect(validateContact("ab", "")).toMatch(/phone/);
    expect(validateContact("0300-1234567", "")).toBeNull();
    expect(validateContact("x".repeat(121), "")).toMatch(/too long/);
    expect(validateContact("0300-1234567", "n".repeat(501))).toMatch(/note is too long/);
  });
});

describe("rpc wrappers", () => {
  it("sendUpgradeRequest validates first and returns the saved request", async () => {
    await expect(sendUpgradeRequest(client({}), "a", "")).rejects.toThrow(/phone/);
    const c = client({ rpc: async (name: string, args: Record<string, string>) => ({ data: { id: "r1", status: "pending", contact: args.p_contact, note: args.p_note, created_at: "t" }, error: null }) });
    expect((await sendUpgradeRequest(c, "  0300-1234567 ", " hi ")).contact).toBe("0300-1234567");
  });
  it("sendUpgradeRequest shows the database message, and a setup hint when 0010 is missing", async () => {
    await expect(sendUpgradeRequest(client({ rpc: async () => ({ data: null, error: { message: "You already have an upgrade request waiting." } }) }), "0300-1234567", "")).rejects.toThrow(/already have/);
    await expect(sendUpgradeRequest(client({ rpc: async () => ({ data: null, error: { message: "Could not find the function public.request_upgrade" } }) }), "0300-1234567", "")).rejects.toThrow(/0010/);
  });
  it("fetchMyRequest returns null on errors and the first row otherwise", async () => {
    const q = (res: unknown) => client({ from: () => ({ select: () => ({ order: () => ({ limit: async () => res }) }) }) });
    expect(await fetchMyRequest(q({ data: null, error: { message: "x" } }))).toBeNull();
    expect((await fetchMyRequest(q({ data: [{ id: "1", status: "approved" }], error: null })))?.status).toBe("approved");
    expect(await fetchMyRequest(q({ data: [], error: null }))).toBeNull();
  });
  it("fetchIsAdmin is false on errors", async () => {
    expect(await fetchIsAdmin(client({ rpc: async () => ({ data: true, error: null }) }))).toBe(true);
    expect(await fetchIsAdmin(client({ rpc: async () => ({ data: true, error: { message: "x" } }) }))).toBe(false);
    expect(await fetchIsAdmin(client({ rpc: async () => { throw new Error("net"); } }))).toBe(false);
  });
  it("admin actions surface database errors", async () => {
    await expect(adminResolve(client({ rpc: async () => ({ error: { message: "not allowed" } }) }), "1", true)).rejects.toThrow("not allowed");
    await expect(adminResolve(client({ rpc: async () => ({ error: null }) }), "1", true)).resolves.toBeUndefined();
  });
});
