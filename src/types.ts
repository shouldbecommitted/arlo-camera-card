export type TriggerType =
  | "motion"
  | "person"
  | "vehicle"
  | "animal"
  | "audio"
  | "other";

/** One recording from aarlo_library, with the camera entity attached by us. */
export interface LibraryItem {
  entity_id: string;
  created_at: number; // epoch seconds OR ms (see toMs())
  duration?: number; // seconds
  url: string; // playable video url
  thumbnail: string;
  object?: string; // raw aarlo object/trigger string, e.g. "Person"
  trigger?: string;
}

/** View-model for one tile in the live grid. */
export interface CameraTile {
  entity_id: string;
  name: string;
  snapshot?: string;
  online: boolean;
  motion: boolean;
  battery?: number;
}

export type CardMode = "live" | "recordings";

export interface CardConfig {
  type: string;
  cameras?: string[];
  default_mode?: CardMode;
  columns?: number; // desktop columns (default 3)
  snapshot_refresh?: number; // seconds (default 10)
  library_days?: number; // default 7
}

export interface FilterState {
  /** null = all cameras */
  cameras: string[] | null;
  /** null = any trigger */
  trigger: TriggerType | null;
  /** epoch ms inclusive lower bound, or null */
  fromMs: number | null;
  /** epoch ms exclusive upper bound, or null */
  toMs: number | null;
}
