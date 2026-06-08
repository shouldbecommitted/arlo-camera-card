import { HomeAssistant } from "custom-card-helpers";
import { LibraryItem } from "./types";

interface RawVideo {
  created_at: number;
  duration?: number;
  url: string;
  thumbnail: string;
  object?: string;
  trigger?: string;
}

function asArray(res: unknown): RawVideo[] {
  if (Array.isArray(res)) return res as RawVideo[];
  if (res && Array.isArray((res as any).videos)) return (res as any).videos;
  return [];
}

export async function fetchLibrary(
  hass: HomeAssistant,
  entityId: string,
  atMost: number
): Promise<LibraryItem[]> {
  const res = await hass.callWS<unknown>({
    type: "aarlo_library",
    entity_id: entityId,
    at_most: atMost,
  });
  return asArray(res).map((v) => ({
    entity_id: entityId,
    created_at: v.created_at,
    duration: v.duration,
    url: v.url,
    thumbnail: v.thumbnail,
    object: v.object,
    trigger: v.trigger,
  }));
}

/**
 * Get a browser-playable live stream URL.
 *
 * We deliberately use Home Assistant's native `camera/stream` command rather
 * than aarlo's `aarlo_stream_url`: the latter returns an MPEG-DASH (or RTSPS)
 * source that hls.js cannot play. `camera/stream` proxies the camera through
 * HA's stream integration and returns an HLS `.m3u8` URL that hls.js plays.
 */
export async function fetchStreamUrl(
  hass: HomeAssistant,
  entityId: string
): Promise<string> {
  const res = await hass.callWS<{ url: string }>({
    type: "camera/stream",
    entity_id: entityId,
  });
  return res.url;
}

export async function stopActivity(
  hass: HomeAssistant,
  entityId: string
): Promise<void> {
  await hass.callWS({ type: "aarlo_stop_activity", entity_id: entityId });
}
