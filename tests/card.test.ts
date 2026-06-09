import { describe, it, expect } from "vitest";
import { ArloCameraCard } from "../src/arlo-camera-card";

describe("ArloCameraCard.setConfig", () => {
  it("applies defaults", () => {
    const card = new ArloCameraCard();
    card.setConfig({ type: "custom:arlo-camera-card" });
    const cfg = (card as any)._config;
    expect(cfg.columns).toBeUndefined(); // responsive auto-fit by default
    expect(cfg.snapshot_refresh).toBe(10);
    expect(cfg.library_days).toBe(7);
    expect(cfg.default_mode).toBe("live");
    expect(cfg.cameras).toEqual([]);
  });

  it("honors default_mode and throws on a bad cameras value", () => {
    const card = new ArloCameraCard();
    card.setConfig({ type: "custom:arlo-camera-card", default_mode: "recordings" });
    expect((card as any)._mode).toBe("recordings");
    expect(() =>
      card.setConfig({ type: "x", cameras: "camera.front" as any })
    ).toThrow(/cameras/);
  });

  it("getStubConfig picks up aarlo cameras from hass", () => {
    const hass: any = {
      states: {
        "camera.aarlo_front": {},
        "camera.other": {},
        "light.kitchen": {},
      },
    };
    const stub = ArloCameraCard.getStubConfig(hass);
    expect(stub.cameras).toEqual(["camera.aarlo_front"]);
  });
});

describe("ArloCameraCard visual editor", () => {
  it("getConfigElement returns the editor element", () => {
    const el = ArloCameraCard.getConfigElement();
    expect(el.tagName.toLowerCase()).toBe("arlo-camera-card-editor");
  });

  it("editor emits config-changed from a ha-form value-changed", () => {
    const el = ArloCameraCard.getConfigElement() as any;
    el.hass = { states: {} };
    el.setConfig({ type: "custom:arlo-camera-card" });
    let emitted: any;
    el.addEventListener("config-changed", (e: CustomEvent) => {
      emitted = e.detail.config;
    });
    el._valueChanged(
      new CustomEvent("value-changed", {
        detail: { value: { type: "custom:arlo-camera-card", library_days: 14 } },
      })
    );
    expect(emitted).toEqual({ type: "custom:arlo-camera-card", library_days: 14 });
  });
});
