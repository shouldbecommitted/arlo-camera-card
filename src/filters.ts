import { LibraryItem, FilterState, TriggerType } from "./types";
import { toMs } from "./grouping";

const TRIGGER_MAP: Record<string, TriggerType> = {
  person: "person",
  people: "person",
  vehicle: "vehicle",
  car: "vehicle",
  animal: "animal",
  pet: "animal",
  audio: "audio",
  sound: "audio",
  motion: "motion",
};

export function mapTrigger(raw?: string): TriggerType {
  if (!raw) return "other";
  return TRIGGER_MAP[raw.trim().toLowerCase()] ?? "other";
}

export function applyFilters(
  items: LibraryItem[],
  f: FilterState
): LibraryItem[] {
  return items.filter((it) => {
    if (f.cameras && !f.cameras.includes(it.entity_id)) return false;
    if (f.trigger && mapTrigger(it.object ?? it.trigger) !== f.trigger)
      return false;
    const ms = toMs(it.created_at);
    if (f.fromMs !== null && ms < f.fromMs) return false;
    if (f.toMs !== null && ms >= f.toMs) return false;
    return true;
  });
}
