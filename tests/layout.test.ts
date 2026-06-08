import { describe, it, expect } from "vitest";
import { gridTemplate } from "../src/layout";

describe("gridTemplate", () => {
  it("auto-fits with a minimum tile width when no fixed column count", () => {
    const expected = "repeat(auto-fill, minmax(min(100%, 180px), 1fr))";
    expect(gridTemplate(undefined)).toBe(expected);
    expect(gridTemplate(0)).toBe(expected);
  });

  it("uses a fixed column count when one is given", () => {
    expect(gridTemplate(3)).toBe("repeat(3, 1fr)");
    expect(gridTemplate(5)).toBe("repeat(5, 1fr)");
  });
});
