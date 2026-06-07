import { describe, it, expect } from "vitest";
import { cameraTile } from "../src/live-grid";

function hassWith(states: Record<string, any>) {
  return { states } as any;
}

describe("cameraTile", () => {
  it("derives name, snapshot, online, motion, battery from sibling entities", () => {
    const hass = hassWith({
      "camera.aarlo_front": {
        state: "idle",
        attributes: { friendly_name: "Front", entity_picture: "/snap.jpg" },
      },
      "binary_sensor.aarlo_motion_front": { state: "on", attributes: {} },
      "sensor.aarlo_battery_level_front": { state: "62", attributes: {} },
    });
    expect(cameraTile(hass, "camera.aarlo_front")).toEqual({
      entity_id: "camera.aarlo_front",
      name: "Front",
      snapshot: "/snap.jpg",
      online: true,
      motion: true,
      battery: 62,
    });
  });

  it("marks unavailable cameras offline and omits battery when non-numeric", () => {
    const hass = hassWith({
      "camera.aarlo_pool": {
        state: "unavailable",
        attributes: { friendly_name: "Pool" },
      },
      "sensor.aarlo_battery_level_pool": { state: "unknown", attributes: {} },
    });
    const tile = cameraTile(hass, "camera.aarlo_pool");
    expect(tile.online).toBe(false);
    expect(tile.motion).toBe(false);
    expect(tile.battery).toBeUndefined();
    expect(tile.snapshot).toBeUndefined();
  });
});
