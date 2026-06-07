import { describe, it, expect } from "vitest";
import { mapTrigger, applyFilters } from "../src/filters";
import { LibraryItem, FilterState } from "../src/types";

function item(
  entity_id: string,
  createdMs: number,
  object?: string
): LibraryItem {
  return { entity_id, created_at: createdMs, url: "u", thumbnail: "t", object };
}

const noFilter: FilterState = {
  cameras: null,
  trigger: null,
  fromMs: null,
  toMs: null,
};

describe("mapTrigger", () => {
  it("normalizes known aarlo object strings", () => {
    expect(mapTrigger("Person")).toBe("person");
    expect(mapTrigger("Vehicle")).toBe("vehicle");
    expect(mapTrigger("Animal")).toBe("animal");
    expect(mapTrigger("Audio")).toBe("audio");
    expect(mapTrigger("Motion")).toBe("motion");
  });
  it("falls back to 'other' for unknown/empty", () => {
    expect(mapTrigger(undefined)).toBe("other");
    expect(mapTrigger("Wibble")).toBe("other");
  });
});

describe("applyFilters", () => {
  const items = [
    item("camera.front", 1000, "Person"),
    item("camera.front", 2000, "Motion"),
    item("camera.pool", 3000, "Animal"),
  ];

  it("returns all with an empty filter", () => {
    expect(applyFilters(items, noFilter)).toHaveLength(3);
  });

  it("filters by camera", () => {
    const out = applyFilters(items, { ...noFilter, cameras: ["camera.pool"] });
    expect(out.map((i) => i.entity_id)).toEqual(["camera.pool"]);
  });

  it("filters by trigger type", () => {
    const out = applyFilters(items, { ...noFilter, trigger: "person" });
    expect(out).toHaveLength(1);
    expect(out[0].object).toBe("Person");
  });

  it("filters by time range (ms, treats created_at seconds as ms via toMs)", () => {
    // created_at here are tiny numbers; toMs upscales them to ms.
    const out = applyFilters(items, {
      ...noFilter,
      fromMs: 1500 * 1000,
      toMs: 2500 * 1000,
    });
    expect(out.map((i) => i.created_at)).toEqual([2000]);
  });
});
