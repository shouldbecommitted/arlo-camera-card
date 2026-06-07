import { describe, it, expect } from "vitest";
import { toMs, groupByDay } from "../src/grouping";
import { LibraryItem } from "../src/types";

const TZ = "Pacific/Auckland";
// Reference "now": 2026-06-08 12:00 NZ  (NZST = UTC+12) => 2026-06-08T00:00:00Z
const NOW = Date.UTC(2026, 5, 8, 0, 0, 0);

function item(entity_id: string, createdMs: number): LibraryItem {
  return { entity_id, created_at: createdMs, url: "u", thumbnail: "t" };
}

describe("toMs", () => {
  it("passes through millisecond timestamps", () => {
    expect(toMs(1_700_000_000_000)).toBe(1_700_000_000_000);
  });
  it("upscales second timestamps to ms", () => {
    expect(toMs(1_700_000_000)).toBe(1_700_000_000_000);
  });
});

describe("groupByDay", () => {
  it("buckets into Today / Yesterday / dated, newest first", () => {
    const todayNoon = Date.UTC(2026, 5, 8, 0, 0, 0); // 8 Jun 12:00 NZ
    const todayMorning = Date.UTC(2026, 5, 7, 20, 0, 0); // 8 Jun 08:00 NZ
    const yesterday = Date.UTC(2026, 5, 6, 22, 0, 0); // 7 Jun 10:00 NZ
    const older = Date.UTC(2026, 5, 4, 22, 0, 0); // 5 Jun 10:00 NZ

    const groups = groupByDay(
      [
        item("camera.a", older),
        item("camera.a", yesterday),
        item("camera.a", todayMorning),
        item("camera.a", todayNoon),
      ],
      TZ,
      NOW
    );

    expect(groups.map((g) => g.label)).toEqual([
      "Today",
      "Yesterday",
      "Fri, 5 Jun",
    ]);
    // Today group has 2 items, newest (noon) first
    expect(groups[0].items.map((i) => i.created_at)).toEqual([
      todayNoon,
      todayMorning,
    ]);
  });

  it("returns [] for no items", () => {
    expect(groupByDay([], TZ, NOW)).toEqual([]);
  });
});
