import { describe, expect, it } from "vitest";
import { fetchPlan, parsePlan, upgradeLink } from "./plan";

describe("parsePlan", () => {
  it("only 'pro' is pro", () => {
    expect(parsePlan("pro")).toBe("pro");
    for (const v of ["free", "PRO", "", null, undefined, 1, {}]) expect(parsePlan(v)).toBe("free");
  });
});

describe("fetchPlan", () => {
  it("reads the plan and falls back to free on any problem", async () => {
    const ok = (data: unknown, error: unknown = null) => ({ rpc: async () => ({ data, error }) }) as never;
    expect(await fetchPlan(ok("pro"))).toBe("pro");
    expect(await fetchPlan(ok("free"))).toBe("free");
    expect(await fetchPlan(ok("pro", { message: "x" }))).toBe("free");
    expect(await fetchPlan({ rpc: async () => { throw new Error("net"); } } as never)).toBe("free");
  });
});

describe("upgradeLink", () => {
  it("accepts https addresses and emails, refuses everything else", () => {
    expect(upgradeLink("https://marketectify.com/pricing")?.href).toBe("https://marketectify.com/pricing");
    expect(upgradeLink("sales@marketectify.com")?.href).toMatch(/^mailto:sales@marketectify\.com\?subject=/);
    for (const v of [undefined, "", "  ", "javascript:alert(1)", "http://insecure.example", "not a link", "a b@c.d"]) expect(upgradeLink(v)).toBeNull();
  });
});
