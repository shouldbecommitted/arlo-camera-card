import { describe, it, expect } from "vitest";
import { gridTemplate } from "../src/layout";

describe("gridTemplate", () => {
  it("auto-fits (stretching tiles to fill width) when no fixed column count", () => {
    const expected = "repeat(auto-fit, minmax(min(100%, 220px), 1fr))";
    expect(gridTemplate(undefined)).toBe(expected);
    expect(gridTemplate(0)).toBe(expected);
  });

  it("uses a fixed column count when one is given", () => {
    expect(gridTemplate(3)).toBe("repeat(3, 1fr)");
    expect(gridTemplate(5)).toBe("repeat(5, 1fr)");
  });
});
