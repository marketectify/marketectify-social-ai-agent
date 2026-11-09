import { describe, expect, it } from "vitest";
import { designText, designTopic } from "./designRender";
import { blankDesign, newElement, type Design, type TextEl } from "./design";

const withTexts = (texts: Array<[string, number]>): Design => {
  const d = blankDesign();
  d.elements = texts.map(([text, y]) => ({ ...(newElement("heading", d) as TextEl), text, y }));
  return d;
};

describe("design text for AI", () => {
  it("reads the words top to bottom and ignores empty text", () => {
    const d = withTexts([["Book now", 400], ["Summer  sale", 100], ["   ", 200]]);
    expect(designText(d)).toBe("Summer sale. Book now");
  });
  it("builds a topic from the name and the words", () => {
    const d = withTexts([["20% off", 10]]);
    expect(designTopic("Eid offer", d)).toBe("Design: Eid offer\nText on the picture: 20% off");
  });
  it("skips the default name and returns empty for a blank design", () => {
    expect(designTopic("Untitled design", blankDesign())).not.toContain("Untitled");
    const empty = blankDesign();
    empty.elements = [];
    expect(designTopic("Untitled design", empty)).toBe("");
  });
  it("respects the length limit", () => {
    expect(designTopic("x", withTexts([["a".repeat(3000), 1]]), 100).length).toBeLessThanOrEqual(100);
  });
});
