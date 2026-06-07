import { LibraryItem } from "./types";

export interface DayGroup {
  label: string;
  items: LibraryItem[];
}

/** Normalize an aarlo created_at to epoch milliseconds. */
export function toMs(createdAt: number): number {
  return createdAt > 1e12 ? createdAt : createdAt * 1000;
}

/** y-m-d string for an instant in a given IANA timezone. */
function dayKey(ms: number, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

function prettyLabel(ms: number, tz: string): string {
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(ms));
}

export function groupByDay(
  items: LibraryItem[],
  tz: string,
  now: number
): DayGroup[] {
  if (items.length === 0) return [];

  const todayKey = dayKey(now, tz);
  const yesterdayKey = dayKey(now - 24 * 60 * 60 * 1000, tz);

  // Newest first overall.
  const sorted = [...items].sort(
    (a, b) => toMs(b.created_at) - toMs(a.created_at)
  );

  const buckets = new Map<string, LibraryItem[]>();
  const order: string[] = [];
  for (const it of sorted) {
    const key = dayKey(toMs(it.created_at), tz);
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(it);
  }

  return order.map((key) => {
    const items = buckets.get(key)!;
    let label: string;
    if (key === todayKey) label = "Today";
    else if (key === yesterdayKey) label = "Yesterday";
    else label = prettyLabel(toMs(items[0].created_at), tz);
    return { label, items };
  });
}
