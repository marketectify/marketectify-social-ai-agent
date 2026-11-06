import { describe, expect, it } from "vitest";
import { BRAND, telHref } from "./branding";

describe("branding", () => {
  it("dials a local Pakistani number with +92 and keeps international numbers", () => {
    expect(telHref("0319 3529519")).toBe("tel:+923193529519");
    expect(telHref("+44 20 7946 0958")).toBe("tel:+442079460958");
  });
  it("has the maker details for the top bar", () => {
    expect(BRAND.website).toBe("https://marketectify.com/");
    expect(BRAND.email).toBe("info@marketectify.com");
    expect(BRAND.author).toBe("Umer Adil");
  });
});
