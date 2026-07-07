# Arlo Camera Card — Top Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the top 5 items from the 2026-07-02 codebase review (`docs/superpowers/reviews/2026-07-02-codebase-review.md`) and cut a new HACS release.

**Architecture:** No structural changes. Adds two small new pure-logic modules (`src/url-safety.ts`, `src/tz.ts`), threads a stable `id` and a resolved timezone through the existing data flow (`api.ts` → `arlo-camera-card.ts` → `recordings-grid.ts`/`player-dialog.ts`), fixes a resource leak in `player-dialog.ts`, removes a dead field from `FilterState`, and adds an ESLint gate to CI.

**Tech Stack:** TypeScript + Lit 3, vitest (jsdom), rollup, ESLint 9 flat config (`typescript-eslint`, `eslint-plugin-lit`, `eslint-plugin-lit-a11y`), GitHub Actions, `gh` CLI for releases.

## Global Constraints

- `strict`, `noUnusedLocals`, `noUnusedParameters` are on in `tsconfig.json` — every step must typecheck cleanly (`npm run typecheck`).
- Existing tests must keep passing; `npm test` must be green after every task.
- Don't touch `dist/` (gitignored build artifact) or add features beyond the 5 approved items.
- Scope is exactly the "Top 5 recommended next steps" from the review, decided with the user as:
  1. De-hardcode the timezone
  2. Add URL validation + a stable clip id
  3. Fix the player-dialog retry leak and add its tests
  4. Resolve the dead date-range filter → **remove** `fromMs`/`toMs` (user chose removal over building UI for it)
  5. Add a lint step to CI + broaden core-logic tests → **include** in this release (user chose to include, not defer)
- `lit-a11y/click-events-have-key-events` will be set to `"off"` in the new ESLint config. Turning it on surfaces 9 pre-existing keyboard-accessibility gaps (clickable `<div>`s across live-grid, recordings-grid, filter-bar, player-dialog) that are real but out of scope for "add a lint step" — fixing them is a follow-up accessibility pass, not a side effect of this release. This is called out again in Task 2.
- Version bump: `1.0.0` → `1.0.1` (patch — bug fixes and internal cleanup only, no `CardConfig` schema change).

---

### Task 1: Remove the dead date-range filter

**Files:**
- Modify: `src/types.ts:41-50` (`FilterState`)
- Modify: `src/filters.ts` (imports, `applyFilters`)
- Modify: `src/arlo-camera-card.ts:21-26` (`EMPTY_FILTER`)
- Modify: `tests/filters.test.ts`

**Interfaces:**
- Produces: `FilterState` with only `{ cameras: string[] | null; trigger: TriggerType | null }` — every later task that constructs a `FilterState` literal uses this two-field shape.

- [ ] **Step 1: Update the failing/changed tests first**

Edit `tests/filters.test.ts`: change `noFilter` and delete the time-range test.

```ts
const noFilter: FilterState = {
  cameras: null,
  trigger: null,
};
```

Delete this whole `it` block from the `applyFilters` describe:

```ts
  it("filters by time range (ms, treats created_at seconds as ms via toMs)", () => {
    // created_at here are tiny numbers; toMs upscales them to ms.
    const out = applyFilters(items, {
      ...noFilter,
      fromMs: 1500 * 1000,
      toMs: 2500 * 1000,
    });
    expect(out.map((i) => i.created_at)).toEqual([2000]);
  });
```

- [ ] **Step 2: Run the tests to confirm they now fail on type errors**

Run: `npm run typecheck`
Expected: FAIL — `tests/filters.test.ts` errors because `FilterState` still requires `fromMs`/`toMs` (not yet removed from `src/types.ts`), and/or `applyFilters` still reads them but `noFilter` no longer supplies them.

- [ ] **Step 3: Remove `fromMs`/`toMs` from `FilterState`**

In `src/types.ts`, replace:

```ts
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
```

with:

```ts
export interface FilterState {
  /** null = all cameras */
  cameras: string[] | null;
  /** null = any trigger */
  trigger: TriggerType | null;
}
```

- [ ] **Step 4: Remove the `fromMs`/`toMs` branch from `applyFilters`**

In `src/filters.ts`, replace:

```ts
import { LibraryItem, FilterState, TriggerType } from "./types";
import { toMs } from "./grouping";
```

with:

```ts
import { LibraryItem, FilterState, TriggerType } from "./types";
```

and replace:

```ts
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
```

with:

```ts
export function applyFilters(
  items: LibraryItem[],
  f: FilterState
): LibraryItem[] {
  return items.filter((it) => {
    if (f.cameras && !f.cameras.includes(it.entity_id)) return false;
    if (f.trigger && mapTrigger(it.object ?? it.trigger) !== f.trigger)
      return false;
    return true;
  });
}
```

- [ ] **Step 5: Update `EMPTY_FILTER` in the card**

In `src/arlo-camera-card.ts`, replace:

```ts
const EMPTY_FILTER: FilterState = {
  cameras: null,
  trigger: null,
  fromMs: null,
  toMs: null,
};
```

with:

```ts
const EMPTY_FILTER: FilterState = {
  cameras: null,
  trigger: null,
};
```

- [ ] **Step 6: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/filters.ts src/arlo-camera-card.ts tests/filters.test.ts
git commit -m "Remove dead FilterState.fromMs/toMs (unused date-range filter)"
```

---

### Task 2: Add ESLint + CI wiring (with the fixes needed to pass it)

Can run in parallel with Task 1 and Task 3 (no file overlap).

**Files:**
- Modify: `package.json` (devDependencies, `lint` script)
- Create: `eslint.config.js`
- Modify: `.github/workflows/validate.yml`
- Modify: `src/api.ts:13-17` (`asArray` — remove `any`)
- Modify: `src/arlo-camera-card.ts` (3 unused `catch (e)` bindings, `window.customCards` typing, dead `eslint-disable` comment)
- Modify: `src/live-grid.ts:9` (remove `any`)

**Interfaces:** None consumed/produced beyond what already exists — this task only removes `any` and fixes lint violations, it doesn't change any function signature.

- [ ] **Step 1: Install ESLint and the Lit plugins**

```bash
npm install --save-dev eslint@^10.6.0 typescript-eslint@^8.62.1 eslint-plugin-lit@^2.3.1 eslint-plugin-lit-a11y@^5.1.1 @eslint/js@^10.0.1
```

- [ ] **Step 2: Add `eslint.config.js`**

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import lit from "eslint-plugin-lit";
import litA11y from "eslint-plugin-lit-a11y";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  lit.configs["flat/recommended"],
  litA11y.configs.recommended,
  {
    files: ["src/**/*.ts"],
    rules: {
      // Deferred: enabling this surfaces 9 pre-existing clickable-div
      // issues across live-grid/recordings-grid/filter-bar/player-dialog.
      // Fixing them is a keyboard-accessibility pass in its own right,
      // not a side effect of adding a lint step. Tracked as follow-up.
      "lit-a11y/click-events-have-key-events": "off",
    },
  }
);
```

- [ ] **Step 3: Add the `lint` script to `package.json`**

In the `"scripts"` block, add `"lint": "eslint src"` after `"typecheck"`:

```json
  "scripts": {
    "build": "rollup -c",
    "watch": "rollup -c -w",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src"
  },
```

- [ ] **Step 4: Run lint and confirm today's real violation count**

Run: `npm run lint`
Expected: FAIL with 9 errors (2 in `api.ts`, 3 unused-catch + 3 `any` + 1 unused-disable-warning in `arlo-camera-card.ts`, 1 `any` in `live-grid.ts`).

- [ ] **Step 5: Fix `src/api.ts` — remove `any`**

Replace:

```ts
function asArray(res: unknown): RawVideo[] {
  if (Array.isArray(res)) return res as RawVideo[];
  if (res && Array.isArray((res as any).videos)) return (res as any).videos;
  return [];
}
```

with:

```ts
function asArray(res: unknown): RawVideo[] {
  if (Array.isArray(res)) return res as RawVideo[];
  const videos = (res as { videos?: unknown })?.videos;
  return Array.isArray(videos) ? (videos as RawVideo[]) : [];
}
```

- [ ] **Step 6: Fix `src/live-grid.ts` — remove `any`**

Replace:

```ts
  const st: any = hass.states[entityId];
```

with:

```ts
  const st = hass.states[entityId];
```

(`hass.states` is already typed `HassEntities`, so this infers `HassEntity` — no annotation needed.)

- [ ] **Step 7: Fix `src/arlo-camera-card.ts` — unused catch bindings**

Replace each of these three occurrences (in `_loadLibrary`, `_openLive`, `_closePlayer`):

```ts
    } catch (e) {
      this._error = "Couldn't load recordings (Arlo library unavailable).";
```

```ts
    } catch (e) {
      // player-dialog shows its own error/timeout state; leave url empty.
```

```ts
      } catch (e) {
        /* best-effort teardown */
```

with (drop the unused binding in each):

```ts
    } catch {
      this._error = "Couldn't load recordings (Arlo library unavailable).";
```

```ts
    } catch {
      // player-dialog shows its own error/timeout state; leave url empty.
```

```ts
      } catch {
        /* best-effort teardown */
```

- [ ] **Step 8: Fix `src/arlo-camera-card.ts` — `window.customCards` typing**

Replace:

```ts
// Register in the card picker.
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: "arlo-camera-card",
  name: "Arlo Camera Card",
  description: "Live view + recordings for Arlo cameras (requires hass-aarlo).",
  preview: false,
  documentationURL: "https://github.com/shouldbecommitted/arlo-camera-card",
});

// eslint-disable-next-line no-console
console.info(
```

with:

```ts
interface CustomCardEntry {
  type: string;
  name: string;
  description: string;
  preview: boolean;
  documentationURL: string;
}

declare global {
  interface Window {
    customCards?: CustomCardEntry[];
  }
}

// Register in the card picker.
window.customCards = window.customCards || [];
window.customCards.push({
  type: "arlo-camera-card",
  name: "Arlo Camera Card",
  description: "Live view + recordings for Arlo cameras (requires hass-aarlo).",
  preview: false,
  documentationURL: "https://github.com/shouldbecommitted/arlo-camera-card",
});

console.info(
```

(The `declare global` block can go anywhere at module scope — put it directly above the "Register in the card picker" comment.)

- [ ] **Step 9: Run lint again**

Run: `npm run lint`
Expected: PASS (0 errors, 0 warnings).

- [ ] **Step 10: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: both PASS.

- [ ] **Step 11: Wire lint into CI**

In `.github/workflows/validate.yml`, in the `build` job, replace:

```yaml
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

with:

```yaml
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json eslint.config.js .github/workflows/validate.yml src/api.ts src/live-grid.ts src/arlo-camera-card.ts
git commit -m "Add ESLint (lit + lit-a11y) and wire it into CI"
```

---

### Task 3: Add the `safeUrl` helper

Can run in parallel with Task 1 and Task 2 (new files only, no overlap).

**Files:**
- Create: `src/url-safety.ts`
- Create: `tests/url-safety.test.ts`

**Interfaces:**
- Produces: `safeUrl(url: unknown): string | undefined` — Tasks 4, 5a, 5b import and call this.

- [ ] **Step 1: Write the failing test**

Create `tests/url-safety.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { safeUrl } from "../src/url-safety";

describe("safeUrl", () => {
  it("allows absolute https urls", () => {
    expect(safeUrl("https://cdn.example.com/a.jpg")).toBe(
      "https://cdn.example.com/a.jpg"
    );
  });

  it("allows absolute http urls", () => {
    expect(safeUrl("http://cdn.example.com/a.jpg")).toBe(
      "http://cdn.example.com/a.jpg"
    );
  });

  it("allows same-origin relative paths", () => {
    expect(safeUrl("/api/hls/abc/master_playlist.m3u8")).toBe(
      "/api/hls/abc/master_playlist.m3u8"
    );
  });

  it("rejects javascript: urls", () => {
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
  });

  it("rejects data: urls", () => {
    expect(safeUrl("data:text/html;base64,abcd")).toBeUndefined();
  });

  it("rejects non-string or empty input", () => {
    expect(safeUrl(undefined)).toBeUndefined();
    expect(safeUrl("")).toBeUndefined();
    expect(safeUrl(123)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx vitest run tests/url-safety.test.ts`
Expected: FAIL — `Cannot find module '../src/url-safety'`.

- [ ] **Step 3: Implement `src/url-safety.ts`**

```ts
const SAFE_SCHEMES = ["http:", "https:"];

/**
 * Returns `url` unchanged if it's safe to use as an `img`/`video` `src` or
 * an `Hls.loadSource()` argument: an http(s) absolute URL, or a path that
 * resolves same-origin (e.g. HA's own `/api/hls/...` URLs). Returns
 * `undefined` for anything else (`javascript:`, `data:`, malformed input,
 * non-strings) so callers can omit the attribute entirely.
 */
export function safeUrl(url: unknown): string | undefined {
  if (typeof url !== "string" || url.length === 0) return undefined;
  try {
    const parsed = new URL(url, window.location.origin);
    return SAFE_SCHEMES.includes(parsed.protocol) ? url : undefined;
  } catch {
    return undefined;
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run tests/url-safety.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Run full typecheck and test suite**

Run: `npm run typecheck && npm test`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add src/url-safety.ts tests/url-safety.test.ts
git commit -m "Add safeUrl() helper for validating untrusted media URLs"
```

---

### Task 4: Stable clip `id` + URL validation in `api.ts`

Depends on Task 1 (`types.ts` already at its final `FilterState` shape avoids merge conflicts), Task 2 (`api.ts`/`arlo-camera-card.ts` already at their lint-clean baseline), and Task 3 (`safeUrl`). Run after those three complete. Can run in parallel with Task 5a and Task 5b (no file overlap with either).

**Files:**
- Modify: `src/types.ts` (`LibraryItem` — add `id`)
- Modify: `src/api.ts` (`fetchLibrary`, `fetchStreamUrl`)
- Modify: `tests/api.test.ts`
- Modify: `src/arlo-camera-card.ts` (`_openClip`)
- Modify: `tests/card.test.ts` (new describe block)

**Interfaces:**
- Consumes: `safeUrl(url: unknown): string | undefined` from `src/url-safety.ts` (Task 3).
- Produces: `LibraryItem.id: string` — Task 8 (broaden tests) constructs `LibraryItem` literals and must include it.

- [ ] **Step 1: Add `id` to `LibraryItem`**

In `src/types.ts`, replace:

```ts
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
```

with:

```ts
/** One recording from aarlo_library, with the camera entity attached by us. */
export interface LibraryItem {
  /** Stable identity for navigation/dedup — NOT necessarily the playable url. */
  id: string;
  entity_id: string;
  created_at: number; // epoch seconds OR ms (see toMs())
  duration?: number; // seconds
  url: string; // playable video url
  thumbnail: string;
  object?: string; // raw aarlo object/trigger string, e.g. "Person"
  trigger?: string;
}
```

- [ ] **Step 2: Update `tests/api.test.ts` to assert the new shape (write the failing tests)**

Replace the whole file with:

```ts
import { describe, it, expect, vi } from "vitest";
import { fetchLibrary, fetchStreamUrl, stopActivity } from "../src/api";

function fakeHass(callWS: (msg: any) => Promise<any>) {
  return { callWS } as any;
}

describe("fetchLibrary", () => {
  it("sends aarlo_library and attaches entity_id + a stable id to each item", async () => {
    const callWS = vi.fn().mockResolvedValue([
      {
        created_at: 1000,
        url: "https://cdn.example.com/v1.mp4",
        thumbnail: "https://cdn.example.com/t1.jpg",
        object: "Person",
      },
    ]);
    const out = await fetchLibrary(fakeHass(callWS), "camera.front", 50);
    expect(callWS).toHaveBeenCalledWith({
      type: "aarlo_library",
      entity_id: "camera.front",
      at_most: 50,
    });
    expect(out).toEqual([
      {
        id: "camera.front:1000:0",
        entity_id: "camera.front",
        created_at: 1000,
        duration: undefined,
        url: "https://cdn.example.com/v1.mp4",
        thumbnail: "https://cdn.example.com/t1.jpg",
        object: "Person",
        trigger: undefined,
      },
    ]);
  });

  it("gives each item in the same response a distinct id", async () => {
    const callWS = vi.fn().mockResolvedValue([
      { created_at: 1000, url: "https://cdn.example.com/u1", thumbnail: "https://cdn.example.com/t1" },
      { created_at: 1000, url: "https://cdn.example.com/u2", thumbnail: "https://cdn.example.com/t2" },
    ]);
    const out = await fetchLibrary(fakeHass(callWS), "camera.front", 50);
    expect(out[0].id).not.toBe(out[1].id);
  });

  it("unwraps a {videos:[...]} response shape", async () => {
    const callWS = vi.fn().mockResolvedValue({
      videos: [
        {
          created_at: 1,
          url: "https://cdn.example.com/v",
          thumbnail: "https://cdn.example.com/t",
        },
      ],
    });
    const out = await fetchLibrary(fakeHass(callWS), "camera.pool", 10);
    expect(out).toHaveLength(1);
    expect(out[0].entity_id).toBe("camera.pool");
  });

  it("returns [] when result is null/empty", async () => {
    const callWS = vi.fn().mockResolvedValue(null);
    expect(await fetchLibrary(fakeHass(callWS), "camera.x", 10)).toEqual([]);
  });

  it("drops unsafe url/thumbnail schemes rather than exposing them", async () => {
    const callWS = vi.fn().mockResolvedValue([
      { created_at: 1000, url: "javascript:alert(1)", thumbnail: "data:text/html,x" },
    ]);
    const out = await fetchLibrary(fakeHass(callWS), "camera.front", 50);
    expect(out[0].url).toBe("");
    expect(out[0].thumbnail).toBe("");
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

  it("returns an empty string for an unsafe stream url", async () => {
    const callWS = vi.fn().mockResolvedValue({ url: "javascript:alert(1)" });
    const url = await fetchStreamUrl(fakeHass(callWS), "camera.front");
    expect(url).toBe("");
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
```

- [ ] **Step 3: Run the tests to confirm they fail**

Run: `npx vitest run tests/api.test.ts`
Expected: FAIL — output items are missing `id`, and unsafe urls aren't yet sanitized.

- [ ] **Step 4: Implement the `api.ts` changes**

Replace the whole file with:

```ts
import { HomeAssistant } from "custom-card-helpers";
import { LibraryItem } from "./types";
import { safeUrl } from "./url-safety";

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
  const videos = (res as { videos?: unknown })?.videos;
  return Array.isArray(videos) ? (videos as RawVideo[]) : [];
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
  return asArray(res).map((v, i) => ({
    id: `${entityId}:${v.created_at}:${i}`,
    entity_id: entityId,
    created_at: v.created_at,
    duration: v.duration,
    url: safeUrl(v.url) ?? "",
    thumbnail: safeUrl(v.thumbnail) ?? "",
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
  return safeUrl(res.url) ?? "";
}

export async function stopActivity(
  hass: HomeAssistant,
  entityId: string
): Promise<void> {
  await hass.callWS({ type: "aarlo_stop_activity", entity_id: entityId });
}
```

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `npx vitest run tests/api.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Write the failing `_openClip` test**

In `tests/card.test.ts`, add a new `import { vi }` isn't needed here; just add this describe block at the end of the file:

```ts
describe("ArloCameraCard._openClip navigation", () => {
  it("finds the clicked item by stable id even when urls collide", () => {
    const card = new ArloCameraCard() as any;
    card.hass = { states: {} };
    card.setConfig({ type: "custom:arlo-camera-card" });
    card._library = [
      { id: "a", entity_id: "camera.front", created_at: 2000, url: "dup", thumbnail: "" },
      { id: "b", entity_id: "camera.front", created_at: 1000, url: "dup", thumbnail: "" },
    ];
    card._filter = { cameras: null, trigger: null };
    card._openClip({
      id: "b",
      entity_id: "camera.front",
      created_at: 1000,
      url: "dup",
      thumbnail: "",
    });
    expect(card._playIndex).toBe(1);
    expect(card._player.url).toBe("dup");
  });
});
```

- [ ] **Step 7: Run to confirm it fails**

Run: `npx vitest run tests/card.test.ts`
Expected: FAIL — `_openClip` still matches on `url`, so with two items sharing `url: "dup"` it finds index 0, not 1.

- [ ] **Step 8: Fix `_openClip` in `src/arlo-camera-card.ts`**

Replace:

```ts
  private _openClip(item: LibraryItem) {
    const list = applyFilters(this._library, this._filter).sort(
      (a, b) => b.created_at - a.created_at
    );
    this._playList = list;
    this._playIndex = list.findIndex((i) => i.url === item.url);
    this._showClipAt(this._playIndex);
  }
```

with:

```ts
  private _openClip(item: LibraryItem) {
    const list = applyFilters(this._library, this._filter).sort(
      (a, b) => b.created_at - a.created_at
    );
    this._playList = list;
    this._playIndex = list.findIndex((i) => i.id === item.id);
    this._showClipAt(this._playIndex);
  }
```

- [ ] **Step 9: Run to confirm it passes**

Run: `npx vitest run tests/card.test.ts`
Expected: PASS.

- [ ] **Step 10: Run full typecheck, lint, and test suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all PASS.

- [ ] **Step 11: Commit**

```bash
git add src/types.ts src/api.ts tests/api.test.ts src/arlo-camera-card.ts tests/card.test.ts
git commit -m "Add stable LibraryItem.id and validate library/stream URLs in api.ts"
```

---

### Task 5a: Wire `safeUrl` into live-grid and recordings-grid rendering

Depends on Task 2 (`live-grid.ts` lint-clean baseline) and Task 3 (`safeUrl`). Can run in parallel with Task 4 and Task 5b (no file overlap).

**Files:**
- Modify: `src/live-grid.ts` (snapshot `img src`)
- Modify: `src/recordings-grid.ts` (thumbnail `img src`)

**Interfaces:**
- Consumes: `safeUrl(url: unknown): string | undefined` from `src/url-safety.ts` (Task 3).

Note: `url-safety.ts` already has full unit coverage (Task 3), and this task's change is a one-line wrap of an already-tested pure function around an existing render expression. Dedicated component-level regression coverage for the sanitized thumbnail (`recordings-grid`) is added in Task 8, which stands up the component-mounting test harness for `recordings-grid` anyway — no need to build that harness twice.

- [ ] **Step 1: Apply `safeUrl` in `src/live-grid.ts`**

Add the import:

```ts
import { gridTemplate } from "./layout";
import { safeUrl } from "./url-safety";
```

Replace:

```ts
          const src = t.snapshot
            ? `${t.snapshot}${t.snapshot.includes("?") ? "&" : "?"}_b=${this._bust}`
            : undefined;
```

with:

```ts
          const src = t.snapshot
            ? safeUrl(
                `${t.snapshot}${t.snapshot.includes("?") ? "&" : "?"}_b=${this._bust}`
              )
            : undefined;
```

- [ ] **Step 2: Apply `safeUrl` in `src/recordings-grid.ts`**

Add the import:

```ts
import { gridTemplate } from "./layout";
import { safeUrl } from "./url-safety";
```

Replace:

```ts
                  <img src=${item.thumbnail} alt=${trig} />
```

with:

```ts
                  <img src=${safeUrl(item.thumbnail) ?? ""} alt=${trig} />
```

- [ ] **Step 3: Run full typecheck, lint, and test suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all PASS (no test changes needed yet — regression coverage lands in Task 8).

- [ ] **Step 4: Commit**

```bash
git add src/live-grid.ts src/recordings-grid.ts
git commit -m "Sanitize snapshot/thumbnail img src with safeUrl()"
```

---

### Task 5b: Fix the player-dialog retry leak, validate its source url, and add tests

Depends on Task 3 (`safeUrl`). Can run in parallel with Task 4 and Task 5a (no file overlap).

**Files:**
- Modify: `src/player-dialog.ts` (`_load`)
- Create: `tests/player-dialog.test.ts`

**Interfaces:**
- Consumes: `safeUrl(url: unknown): string | undefined` from `src/url-safety.ts` (Task 3).

- [ ] **Step 1: Write the failing tests**

Create `tests/player-dialog.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "../src/player-dialog";
import type { ArloPlayerDialog, PlayerSource } from "../src/player-dialog";

// `vi.mock`'s factory runs before top-level code in this file (it's hoisted
// above imports), so MockHls must be created inside `vi.hoisted` too —
// otherwise the factory below would reference it before initialization.
const { MockHls, instances } = vi.hoisted(() => {
  const instances: any[] = [];
  class MockHls {
    static isSupported = vi.fn(() => true);
    static Events = { MANIFEST_PARSED: "hlsManifestParsed", ERROR: "hlsError" };
    destroy = vi.fn();
    loadSource = vi.fn();
    attachMedia = vi.fn();
    on = vi.fn();
    constructor() {
      instances.push(this);
    }
  }
  return { MockHls, instances };
});

vi.mock("hls.js", () => ({ default: MockHls }));

async function mount(): Promise<ArloPlayerDialog> {
  const el = document.createElement("arlo-player-dialog") as ArloPlayerDialog;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe("arlo-player-dialog hls lifecycle", () => {
  beforeEach(() => {
    instances.length = 0;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("creates one Hls instance and loads the source", async () => {
    const el = await mount();
    el.source = {
      kind: "live",
      entityId: "camera.front",
      url: "https://cdn.example.com/master.m3u8",
      title: "Front",
    } as PlayerSource;
    await el.updateComplete;
    expect(instances).toHaveLength(1);
    expect(instances[0].loadSource).toHaveBeenCalledWith(
      "https://cdn.example.com/master.m3u8"
    );
  });

  it("destroys the hls instance when the source changes", async () => {
    const el = await mount();
    el.source = {
      kind: "live",
      entityId: "camera.front",
      url: "https://cdn.example.com/a.m3u8",
      title: "A",
    } as PlayerSource;
    await el.updateComplete;
    const first = instances[0];
    el.source = {
      kind: "live",
      entityId: "camera.back",
      url: "https://cdn.example.com/b.m3u8",
      title: "B",
    } as PlayerSource;
    await el.updateComplete;
    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(instances).toHaveLength(2);
  });

  it("destroys the hls instance on disconnect", async () => {
    const el = await mount();
    el.source = {
      kind: "live",
      entityId: "camera.front",
      url: "https://cdn.example.com/a.m3u8",
      title: "A",
    } as PlayerSource;
    await el.updateComplete;
    const inst = instances[0];
    el.remove();
    expect(inst.destroy).toHaveBeenCalledTimes(1);
  });

  it("destroys the previous hls instance before creating a new one on retry", async () => {
    const el = await mount();
    el.source = {
      kind: "live",
      entityId: "camera.front",
      url: "https://cdn.example.com/a.m3u8",
      title: "A",
    } as PlayerSource;
    await el.updateComplete;
    const first = instances[0];
    (el as any)._status = "error";
    await el.updateComplete;
    const retry = el.shadowRoot!.querySelector(".retry") as HTMLElement;
    retry.click();
    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(instances).toHaveLength(2);
  });

  it("moves to the error state if the manifest never parses within the timeout", async () => {
    vi.useFakeTimers();
    const el = await mount();
    el.source = {
      kind: "live",
      entityId: "camera.front",
      url: "https://cdn.example.com/a.m3u8",
      title: "A",
    } as PlayerSource;
    await el.updateComplete;
    vi.advanceTimersByTime(15000);
    expect((el as any)._status).toBe("error");
    vi.useRealTimers();
  });

  it("rejects an unsafe source url without creating an Hls instance", async () => {
    const el = await mount();
    el.source = { kind: "clip", url: "javascript:alert(1)", title: "Bad" } as PlayerSource;
    await el.updateComplete;
    expect((el as any)._status).toBe("error");
    expect(instances).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to confirm the tests fail**

Run: `npx vitest run tests/player-dialog.test.ts`
Expected: FAIL — `vi.mock("hls.js", ...)` works, but `_load()` doesn't yet call `safeUrl`, so the "rejects an unsafe source url" test fails (it would try to construct an `Hls` for a `javascript:` url); the retry test may also be flaky/fail since `_load()` doesn't tear down first.

- [ ] **Step 3: Fix `_load()` in `src/player-dialog.ts`**

Add the import:

```ts
import Hls from "hls.js";
import { safeUrl } from "./url-safety";
```

Replace:

```ts
  private _load() {
    if (!this.source) return;
    const url = this.source.url;
    // Live opens with an empty url while the stream URL is fetched; stay in the
    // loading state until the real url arrives (a second `source` update).
    if (!url) {
      this._status = "loading";
      return;
    }
    this._status = "loading";
```

with:

```ts
  private _load() {
    if (!this.source) return;
    this._teardownHls();
    const rawUrl = this.source.url;
    // Live opens with an empty url while the stream URL is fetched; stay in the
    // loading state until the real url arrives (a second `source` update).
    if (!rawUrl) {
      this._status = "loading";
      return;
    }
    const url = safeUrl(rawUrl);
    if (!url) {
      this._status = "error";
      return;
    }
    this._status = "loading";
```

(The rest of `_load()` — timeout, `onReady`, the `isHls`/`Hls`/`video.src` branch — is unchanged; it already refers to the now-validated `url` variable.)

- [ ] **Step 4: Run to confirm the tests pass**

Run: `npx vitest run tests/player-dialog.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Run full typecheck, lint, and test suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/player-dialog.ts tests/player-dialog.test.ts
git commit -m "Fix player-dialog retry leak and validate the source url"
```

---

### Task 6: De-hardcode the display timezone

Depends on Task 4 (`arlo-camera-card.ts` at its post-id-fix baseline) and Task 5a (`recordings-grid.ts` at its post-safeUrl baseline). Run after both.

**Files:**
- Create: `src/tz.ts`
- Create: `tests/tz.test.ts`
- Modify: `src/arlo-camera-card.ts` (`_groups`, render)
- Modify: `src/recordings-grid.ts` (`timeLabel`, new `tz` property)

**Interfaces:**
- Produces: `resolveTz(hass?: HomeAssistant): string`.
- Produces: `ArloRecordingsGrid.tz: string` property (defaults to the browser's resolved timezone).

- [ ] **Step 1: Write the failing test**

Create `tests/tz.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveTz } from "../src/tz";

describe("resolveTz", () => {
  it("uses hass.config.time_zone when present", () => {
    const hass = { config: { time_zone: "Pacific/Auckland" } } as any;
    expect(resolveTz(hass)).toBe("Pacific/Auckland");
  });

  it("falls back to the browser's resolved timezone when hass is missing", () => {
    expect(resolveTz(undefined)).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone
    );
  });

  it("falls back to the browser's resolved timezone when hass.config is missing", () => {
    const hass = {} as any;
    expect(resolveTz(hass)).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone
    );
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npx vitest run tests/tz.test.ts`
Expected: FAIL — `Cannot find module '../src/tz'`.

- [ ] **Step 3: Implement `src/tz.ts`**

```ts
import { HomeAssistant } from "custom-card-helpers";

/** Resolve the display timezone: prefer HA's configured zone, fall back to the browser's. */
export function resolveTz(hass?: HomeAssistant): string {
  return (
    hass?.config?.time_zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  );
}
```

- [ ] **Step 4: Run to confirm it passes**

Run: `npx vitest run tests/tz.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Thread the resolved timezone through `arlo-camera-card.ts`**

Add the import and remove the constant. Replace:

```ts
import { CARD_VERSION } from "./version";

// Pull in the sub-components so customElements are defined in the bundle.
import "./live-grid";
import "./filter-bar";
import "./recordings-grid";
import "./player-dialog";
import "./editor";

const TZ = "Pacific/Auckland";
```

with:

```ts
import { CARD_VERSION } from "./version";
import { resolveTz } from "./tz";

// Pull in the sub-components so customElements are defined in the bundle.
import "./live-grid";
import "./filter-bar";
import "./recordings-grid";
import "./player-dialog";
import "./editor";
```

Replace:

```ts
  private get _groups(): DayGroup[] {
    const filtered = applyFilters(this._library, this._filter);
    return groupByDay(filtered, TZ, Date.now());
  }
```

with:

```ts
  private get _groups(): DayGroup[] {
    const filtered = applyFilters(this._library, this._filter);
    return groupByDay(filtered, resolveTz(this.hass), Date.now());
  }
```

In `render()`, replace:

```ts
              <arlo-recordings-grid
                .groups=${this._groups}
                .columns=${this._config.columns}
                .loading=${this._loading}
                .error=${this._error}
                @play-clip=${(e: CustomEvent) => this._openClip(e.detail.item)}
                @retry=${() => this._loadLibrary()}
              ></arlo-recordings-grid>
```

with:

```ts
              <arlo-recordings-grid
                .groups=${this._groups}
                .columns=${this._config.columns}
                .tz=${resolveTz(this.hass)}
                .loading=${this._loading}
                .error=${this._error}
                @play-clip=${(e: CustomEvent) => this._openClip(e.detail.item)}
                @retry=${() => this._loadLibrary()}
              ></arlo-recordings-grid>
```

- [ ] **Step 6: Thread the timezone through `recordings-grid.ts`**

Replace:

```ts
import { DayGroup, toMs } from "./grouping";
import { LibraryItem } from "./types";
import { mapTrigger } from "./filters";
import { gridTemplate } from "./layout";
import { safeUrl } from "./url-safety";

const TZ = "Pacific/Auckland";

function timeLabel(item: LibraryItem): string {
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(toMs(item.created_at)));
}
```

with:

```ts
import { DayGroup, toMs } from "./grouping";
import { LibraryItem } from "./types";
import { mapTrigger } from "./filters";
import { gridTemplate } from "./layout";
import { safeUrl } from "./url-safety";

function timeLabel(item: LibraryItem, tz: string): string {
  return new Intl.DateTimeFormat("en-NZ", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(toMs(item.created_at)));
}
```

Add the `tz` property to the class. Replace:

```ts
  @property({ attribute: false }) groups: DayGroup[] = [];
  /** fixed desktop column count; 0/undefined = responsive auto-fit */
  @property({ type: Number }) columns = 0;
  @property({ type: Boolean }) loading = false;
  @property() error = "";
```

with:

```ts
  @property({ attribute: false }) groups: DayGroup[] = [];
  /** fixed desktop column count; 0/undefined = responsive auto-fit */
  @property({ type: Number }) columns = 0;
  @property() tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  @property({ type: Boolean }) loading = false;
  @property() error = "";
```

Update the render call site. Replace:

```ts
                  <span class="meta"
                    >${timeLabel(item)}${dur ? ` · ${dur}` : ""}</span
                  >
```

with:

```ts
                  <span class="meta"
                    >${timeLabel(item, this.tz)}${dur ? ` · ${dur}` : ""}</span
                  >
```

- [ ] **Step 7: Run full typecheck, lint, and test suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/tz.ts tests/tz.test.ts src/arlo-camera-card.ts src/recordings-grid.ts
git commit -m "De-hardcode the display timezone (was fixed to Pacific/Auckland)"
```

---

### Task 7: Broaden core-logic test coverage

Depends on Task 1 (`FilterState` final shape), Task 4 (`id`-based `_openClip`), Task 5a (`safeUrl`-wrapped thumbnail), Task 6 (`recordings-grid.tz` property). Run last among the source tasks.

**Files:**
- Modify: `tests/card.test.ts` (`_loadLibrary`, `_onNav`)
- Create: `tests/recordings-grid.test.ts`
- Create: `tests/filter-bar.test.ts`

**Interfaces:** None new — this task only adds tests against existing, already-implemented behavior.

- [ ] **Step 1: Add `_loadLibrary` tests to `tests/card.test.ts`**

Add near the top of the file, after the existing imports:

```ts
import { describe, it, expect, vi } from "vitest";
import { ArloCameraCard } from "../src/arlo-camera-card";
import * as api from "../src/api";
```

(This replaces the existing `import { describe, it, expect } from "vitest";` line — add `vi` and the `* as api` import.)

Append this describe block:

```ts
describe("ArloCameraCard._loadLibrary", () => {
  it("flattens per-camera libraries into _library", async () => {
    const card = new ArloCameraCard() as any;
    card.hass = { states: {} };
    card.setConfig({
      type: "custom:arlo-camera-card",
      cameras: ["camera.a", "camera.b"],
    });
    vi.spyOn(api, "fetchLibrary").mockImplementation(async (_hass, entityId) => [
      { id: `${entityId}:1`, entity_id: entityId as string, created_at: 1, url: "u", thumbnail: "t" },
    ]);
    await card._loadLibrary();
    expect(card._library).toHaveLength(2);
    expect(card._error).toBe("");
    expect(card._loading).toBe(false);
  });

  it("sets a user-facing error and stops loading when a fetch rejects", async () => {
    const card = new ArloCameraCard() as any;
    card.hass = { states: {} };
    card.setConfig({ type: "custom:arlo-camera-card", cameras: ["camera.a"] });
    vi.spyOn(api, "fetchLibrary").mockRejectedValue(new Error("boom"));
    await card._loadLibrary();
    expect(card._error).toBe(
      "Couldn't load recordings (Arlo library unavailable)."
    );
    expect(card._loading).toBe(false);
    expect(card._library).toEqual([]);
  });
});

describe("ArloCameraCard._onNav", () => {
  function cardWithList(): any {
    const card = new ArloCameraCard() as any;
    card.hass = { states: {} };
    card.setConfig({ type: "custom:arlo-camera-card" });
    card._playList = [
      { id: "a", entity_id: "camera.front", created_at: 3, url: "a", thumbnail: "" },
      { id: "b", entity_id: "camera.front", created_at: 2, url: "b", thumbnail: "" },
      { id: "c", entity_id: "camera.front", created_at: 1, url: "c", thumbnail: "" },
    ];
    card._playIndex = 1;
    return card;
  }

  it("moves to the next item", () => {
    const card = cardWithList();
    card._onNav(1);
    expect(card._playIndex).toBe(2);
    expect(card._player.url).toBe("c");
  });

  it("moves to the previous item", () => {
    const card = cardWithList();
    card._onNav(-1);
    expect(card._playIndex).toBe(0);
    expect(card._player.url).toBe("a");
  });

  it("does nothing past the end of the list", () => {
    const card = cardWithList();
    card._playIndex = 2;
    card._onNav(1);
    expect(card._playIndex).toBe(2);
  });

  it("does nothing before the start of the list", () => {
    const card = cardWithList();
    card._playIndex = 0;
    card._onNav(-1);
    expect(card._playIndex).toBe(0);
  });
});
```

- [ ] **Step 2: Run to confirm the new tests pass**

Run: `npx vitest run tests/card.test.ts`
Expected: PASS (all describe blocks, including the pre-existing ones and the Task 4 `_openClip` block).

- [ ] **Step 3: Create `tests/recordings-grid.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import "../src/recordings-grid";
import type { ArloRecordingsGrid } from "../src/recordings-grid";
import type { DayGroup } from "../src/grouping";

async function mount(): Promise<ArloRecordingsGrid> {
  const el = document.createElement(
    "arlo-recordings-grid"
  ) as ArloRecordingsGrid;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe("arlo-recordings-grid", () => {
  it("shows a loading message", async () => {
    const el = await mount();
    el.loading = true;
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain("Loading recordings");
  });

  it("shows the error message with a retry link and emits retry on click", async () => {
    const el = await mount();
    el.error = "Couldn't load recordings (Arlo library unavailable).";
    await el.updateComplete;
    const retrySpy = vi.fn();
    el.addEventListener("retry", retrySpy);
    (el.shadowRoot!.querySelector(".retry") as HTMLElement).click();
    expect(retrySpy).toHaveBeenCalledOnce();
  });

  it("shows an empty-filter message when there are no groups", async () => {
    const el = await mount();
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain(
      "No recordings for this filter."
    );
  });

  it("renders day headers and dispatches play-clip on tile click", async () => {
    const el = await mount();
    const groups: DayGroup[] = [
      {
        label: "Today",
        items: [
          {
            id: "a",
            entity_id: "camera.front",
            created_at: Date.now() / 1000,
            url: "u",
            thumbnail: "",
          },
        ],
      },
    ];
    el.groups = groups;
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain("Today");
    const playSpy = vi.fn();
    el.addEventListener("play-clip", playSpy);
    (el.shadowRoot!.querySelector(".rec") as HTMLElement).click();
    expect(playSpy).toHaveBeenCalledOnce();
  });

  it("does not render an unsafe thumbnail url", async () => {
    const el = await mount();
    el.groups = [
      {
        label: "Today",
        items: [
          {
            id: "a",
            entity_id: "camera.front",
            created_at: 1,
            url: "u",
            thumbnail: "javascript:alert(1)",
          },
        ],
      },
    ];
    await el.updateComplete;
    const img = el.shadowRoot!.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("");
  });
});
```

- [ ] **Step 4: Run to confirm it passes**

Run: `npx vitest run tests/recordings-grid.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Create `tests/filter-bar.test.ts`**

```ts
import { describe, it, expect, vi } from "vitest";
import "../src/filter-bar";
import type { ArloFilterBar } from "../src/filter-bar";
import type { FilterState } from "../src/types";

const noFilter: FilterState = { cameras: null, trigger: null };

async function mount(): Promise<ArloFilterBar> {
  const el = document.createElement("arlo-filter-bar") as ArloFilterBar;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe("arlo-filter-bar", () => {
  it("shows a camera name derived from hass state", async () => {
    const el = await mount();
    el.hass = {
      states: {
        "camera.aarlo_front": { attributes: { friendly_name: "Front" } },
      },
    } as any;
    el.cameras = ["camera.aarlo_front"];
    el.filter = noFilter;
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).toContain("Front");
  });

  it("emits filter-change with the camera toggled on, then off", async () => {
    const el = await mount();
    el.hass = { states: {} } as any;
    el.cameras = ["camera.front"];
    el.filter = noFilter;
    await el.updateComplete;

    let emitted: FilterState | undefined;
    el.addEventListener(
      "filter-change",
      (e: Event) => (emitted = (e as CustomEvent).detail.filter)
    );

    const cameraChip = el.shadowRoot!.querySelectorAll(".chip")[1] as HTMLElement;
    cameraChip.click();
    expect(emitted).toEqual({ ...noFilter, cameras: ["camera.front"] });

    el.filter = emitted!;
    await el.updateComplete;
    (el.shadowRoot!.querySelectorAll(".chip")[1] as HTMLElement).click();
    expect(emitted).toEqual({ ...noFilter, cameras: null });
  });

  it("emits filter-change when a trigger chip is toggled", async () => {
    const el = await mount();
    el.hass = { states: {} } as any;
    el.cameras = [];
    el.filter = noFilter;
    await el.updateComplete;

    let emitted: FilterState | undefined;
    el.addEventListener(
      "filter-change",
      (e: Event) => (emitted = (e as CustomEvent).detail.filter)
    );
    const personChip = Array.from(
      el.shadowRoot!.querySelectorAll(".chip")
    ).find((c) => c.textContent?.trim() === "person") as HTMLElement;
    personChip.click();
    expect(emitted).toEqual({ ...noFilter, trigger: "person" });
  });
});
```

- [ ] **Step 6: Run to confirm it passes**

Run: `npx vitest run tests/filter-bar.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Run the full typecheck, lint, and test suite**

Run: `npm run typecheck && npm run lint && npm test`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add tests/card.test.ts tests/recordings-grid.test.ts tests/filter-bar.test.ts
git commit -m "Broaden test coverage: _loadLibrary, _onNav, recordings-grid, filter-bar"
```

---

### Task 8: Bump version and verify the release build

Depends on all prior tasks.

**Files:**
- Modify: `package.json` (`version`)

- [ ] **Step 1: Bump the version**

In `package.json`, change:

```json
  "version": "1.0.0",
```

to:

```json
  "version": "1.0.1",
```

- [ ] **Step 2: Run the full verification suite**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all four PASS; `dist/arlo-camera-card.js` is produced.

- [ ] **Step 3: Confirm the version was stamped into the build**

Run: `grep -c "1.0.1" dist/arlo-camera-card.js`
Expected: a non-zero count (confirms rollup's `replace` plugin substituted `__CARD_VERSION__` with the new `package.json` version somewhere in the bundle — terser may or may not fold the template literal that consumes it, so match on the raw version string rather than the fully-assembled `v1.0.1` banner text).

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "Bump version to 1.0.1"
```

---

### Task 9: Tag, push, and publish the GitHub release

Depends on Task 8.

- [ ] **Step 1: Push `main`**

```bash
git push
```

This pushes the 2026-07-02 review-report commit plus every commit from Tasks 1–8.

- [ ] **Step 2: Tag the release**

```bash
git tag v1.0.1
git push --tags
```

- [ ] **Step 3: Create the GitHub release with the built asset**

```bash
npm run build
gh release create v1.0.1 dist/arlo-camera-card.js --generate-notes
```

(Matches the existing release convention — `v1.0.0`/`v0.1.x` all use `--generate-notes` with no manual body.)

- [ ] **Step 4: Verify**

```bash
gh release view v1.0.1
```

Expected: shows the release with `arlo-camera-card.js` as an asset, and a "Full Changelog" comparison link.
