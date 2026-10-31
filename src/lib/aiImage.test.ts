import { describe, expect, it } from "vitest";
import { nearestAspect } from "./aiImage";

describe("nearestAspect", () => {
  it("matches the design presets", () => {
    expect(nearestAspect(1080, 1080)).toBe("1:1");
    expect(nearestAspect(1080, 1350)).toBe("4:5");
    expect(nearestAspect(1080, 1920)).toBe("9:16");
    expect(nearestAspect(1200, 630)).toBe("16:9");
  });
  it("never divides by zero", () => {
    expect(nearestAspect(100, 0)).toBe("16:9");
  });
});
