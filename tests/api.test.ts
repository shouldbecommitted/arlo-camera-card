import { describe, it, expect, vi } from "vitest";
import { fetchLibrary, fetchStreamUrl, stopActivity } from "../src/api";

function fakeHass(callWS: (msg: any) => Promise<any>) {
  return { callWS } as any;
}

describe("fetchLibrary", () => {
  it("sends aarlo_library and attaches entity_id to each item", async () => {
    const callWS = vi.fn().mockResolvedValue([
      { created_at: 1000, url: "v1", thumbnail: "t1", object: "Person" },
    ]);
    const out = await fetchLibrary(fakeHass(callWS), "camera.front", 50);
    expect(callWS).toHaveBeenCalledWith({
      type: "aarlo_library",
      entity_id: "camera.front",
      at_most: 50,
    });
    expect(out).toEqual([
      {
        entity_id: "camera.front",
        created_at: 1000,
        duration: undefined,
        url: "v1",
        thumbnail: "t1",
        object: "Person",
        trigger: undefined,
      },
    ]);
  });

  it("unwraps a {videos:[...]} response shape", async () => {
    const callWS = vi
      .fn()
      .mockResolvedValue({ videos: [{ created_at: 1, url: "v", thumbnail: "t" }] });
    const out = await fetchLibrary(fakeHass(callWS), "camera.pool", 10);
    expect(out).toHaveLength(1);
    expect(out[0].entity_id).toBe("camera.pool");
  });

  it("returns [] when result is null/empty", async () => {
    const callWS = vi.fn().mockResolvedValue(null);
    expect(await fetchLibrary(fakeHass(callWS), "camera.x", 10)).toEqual([]);
  });
});

describe("fetchStreamUrl", () => {
  it("uses HA's camera/stream proxy (HLS) and returns the url field", async () => {
    const callWS = vi
      .fn()
      .mockResolvedValue({ url: "/api/hls/abc/master_playlist.m3u8" });
    const url = await fetchStreamUrl(fakeHass(callWS), "camera.front");
    expect(callWS).toHaveBeenCalledWith({
      type: "camera/stream",
      entity_id: "camera.front",
    });
    expect(url).toBe("/api/hls/abc/master_playlist.m3u8");
  });
});

describe("stopActivity", () => {
  it("sends aarlo_stop_activity", async () => {
    const callWS = vi.fn().mockResolvedValue({ stopped: true });
    await stopActivity(fakeHass(callWS), "camera.front");
    expect(callWS).toHaveBeenCalledWith({
      type: "aarlo_stop_activity",
      entity_id: "camera.front",
    });
  });
});
