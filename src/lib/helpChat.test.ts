import { describe, expect, it } from "vitest";
import { toHistory } from "./helpChat";

describe("toHistory", () => {
  it("drops empty messages and leading model messages", () => {
    const h = toHistory([
      { role: "model", text: "hello" },
      { role: "user", text: "q1" },
      { role: "model", text: "  " },
      { role: "user", text: "q2" },
    ]);
    expect(h).toEqual([{ role: "user", text: "q1" }, { role: "user", text: "q2" }]);
  });
  it("keeps only the last messages", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ role: "user" as const, text: `m${i}` }));
    expect(toHistory(many, 5)).toHaveLength(5);
    expect(toHistory(many, 5)[4].text).toBe("m29");
  });
});
