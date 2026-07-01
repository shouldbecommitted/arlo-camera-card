# Arlo Camera Card — Codebase Review

**Date:** 2026-07-02
**Scope:** Full repo audit focused on `src/` and `tests/` (excludes `node_modules/` and the gitignored `dist/` build artifact). Reviewed against the stated tooling: rollup bundling, vitest unit tests, TypeScript + Lit. Deliberate/documented design decisions (e.g. `camera/stream` HLS over `aarlo_stream_url`, `auto-fit` grid layout, version stamping via rollup `replace`) were not flagged.

Angles covered: code health, architecture, security. This is audit-only — no source files were modified.

---

## High

**[Security] src/live-grid.ts:130-131, src/recordings-grid.ts:134, src/player-dialog.ts:113/120, src/arlo-camera-card.ts:160** — URLs (`snapshot`/`entity_picture`, `thumbnail`, recording `url`, live stream `url`) come straight from the HA WebSocket API / hass state and are used unvalidated as `img src`, `video src`, and `Hls.loadSource()`. In a Lit card, `img`/`video` `src` won't execute `javascript:` URIs, so this is not classic XSS, but there is no scheme allow-listing and `url` is also used as the identity key for clip navigation (`_openClip` matches on `i.url === item.url`), so a duplicate/empty `url` silently breaks prev/next. Suggested fix: add a small `safeUrl()` helper that accepts only `http:`, `https:`, and same-origin relative paths (reject `javascript:`/`data:` except image `data:` if needed), apply it in `api.ts` when mapping `RawVideo -> LibraryItem` and in `fetchStreamUrl`; give `LibraryItem` a stable `id` field (or index) and navigate by that instead of `url`.

**[Code health] src/player-dialog.ts — no tests** — The most complex, side-effect-heavy component (hls.js lifecycle, 15s timeout, teardown, HLS-vs-native branching, retry) has zero test coverage, and `_load`'s retry path (`@click=${() => this._load()}`) re-enters without first calling `_teardownHls()`, so a retry in the HLS branch can leak the previous `Hls` instance and stack a second timeout. Suggested fix: call `this._teardownHls()` at the top of `_load()` (not only in `updated()`), and add vitest coverage with a mocked `Hls` asserting: destroy-on-source-change, destroy-on-disconnect, timeout→error transition, and that retry destroys the prior instance before creating a new one.

---

## Medium

**[Architecture] src/arlo-camera-card.ts:19, src/recordings-grid.ts:8, src/filters.ts (via toMs)** — The display timezone is hardcoded to `"Pacific/Auckland"` in two components, so day-grouping and time labels are wrong for any user outside NZ despite the card being HACS-published for a general audience. Suggested fix: derive the zone from `hass.config.time_zone` (fall back to `Intl.DateTimeFormat().resolvedOptions().timeZone`), thread it through `groupByDay`/`timeLabel` as the already-parameterized `tz` argument, and drop the module-level `TZ` constants.

**[Architecture] src/types.ts:41-49, src/filters.ts:29-32, src/filter-bar.ts** — `FilterState.fromMs`/`toMs` and their handling in `applyFilters` are fully implemented and tested, but no UI ever sets them (`filter-bar` only emits camera/trigger changes). This is dead/leaky surface: the type advertises a date filter the card can't use. Suggested fix: either add date-range controls to `arlo-filter-bar` (emitting `fromMs`/`toMs`) or remove the two fields from `FilterState` and the corresponding branch in `applyFilters` until the feature exists.

**[Code health] src/arlo-camera-card.ts:144-153 & 180-192** — `_openLive` sets `this._player` twice (once with empty `url`, then again after the await) to drive the dialog's loading state, and `_closePlayer` fires `stopActivity` best-effort; the flow relies on the dialog re-running `_load` on every `source` identity change. This implicit two-phase handshake is fragile and untested end-to-end. Suggested fix: model live-stream loading as an explicit state on `PlayerSource` (e.g. `url: string | null` already exists — add a test in `card.test.ts` that stubs `fetchStreamUrl` and asserts `_player` transitions and that `stopActivity` is called on close only for `kind: "live"`).

**[Code health] tests/ — core rendering/interaction paths untested** — `recordings-grid`, `filter-bar`, `editor` (beyond one event), and the card's mode-switch/library-load/navigation logic (`_switchMode`, `_loadLibrary`, `_openClip`, `_onNav`) have no tests; `_loadLibrary` swallows all errors into a single string and its `atMost = max(20, days*30)` heuristic is unverified. Suggested fix: add vitest coverage for `_loadLibrary` (mock `fetchLibrary`, assert flatten + error path sets `_error`), `_onNav` bounds, and `_openClip` index resolution; render-level tests can mount the Lit elements in jsdom and assert emitted CustomEvents.

**[Code health] src/api.ts:13-17** — `asArray` casts to `RawVideo[]` with no per-field validation; a malformed row (missing `url`/`thumbnail`, non-numeric `created_at`) flows through to render as a broken tile or a bad `toMs()` result (`toMs(NaN)` → `NaN`). Suggested fix: filter to rows with a string `url` and `thumbnail` and a finite `created_at` inside the `map`, dropping invalid entries.

---

## Low

**[Code health] src/live-grid.ts (cameraTile) & src/filter-bar.ts:5** — `filter-bar` imports `cameraTile` from `live-grid` solely to get a display name, coupling the filter bar to the whole tile view-model (which reads motion/battery sibling entities it doesn't need). Suggested fix: extract a tiny `cameraName(hass, id)` helper (or a `names.ts`) and have both call it, so the filter bar doesn't depend on live-grid.

**[Code health] src/live-grid.ts:9, cameraTile** — Uses `const st: any = hass.states[entityId]` and `@property` typed `columns = 0` while the resolved config uses `undefined` for "auto-fit"; the two "no fixed columns" sentinels (`0` vs `undefined`) are reconciled only inside `gridTemplate`. Suggested fix: type the state access via `custom-card-helpers`' `HassEntity` instead of `any`, and standardize on a single sentinel (`undefined`) for column count across config and component props.

**[Architecture] src/arlo-camera-card.ts:79** — `getCardSize()` returns a hardcoded `8` regardless of camera count or mode, which mis-sizes the card in masonry/sections layout. Suggested fix: compute a rough size from camera count / current mode (e.g. rows of tiles + header).

**[Security / tooling] repo root — no lint step, stray `eslint-disable`** — There is an `// eslint-disable-next-line no-console` comment (arlo-camera-card.ts:260) but no ESLint config or lint step in `validate.yml`, so that directive is dead and no static analysis guards against unsafe patterns (e.g. future `innerHTML`/`unsafeHTML`). Suggested fix: add a minimal `eslint` config with `eslint-plugin-lit`/`lit-a11y` and wire `npm run lint` into the CI `build` job (which already runs `typecheck`, `test`, `build`).

**[Code health] src/arlo-camera-card.ts:132 / :150** — Two `catch (e)` blocks bind `e` but never use it (only set a generic message / comment), which under `noUnusedLocals` is only allowed because they're catch bindings; the swallowed error also loses diagnostics. Suggested fix: use optional catch binding `catch {` and log via `console.debug` behind a debug flag so failures are diagnosable.

**[Code health] src/recordings-grid.ts:113-122 vs src/player-dialog.ts:160-165** — Loading/error/retry "state" UI is reimplemented separately in the recordings grid and the player dialog with near-identical retry-link markup and styling. Suggested fix: extract a shared `<arlo-state-message>` presentational element (or a `stateBlock()` render helper) to avoid divergence.

---

## Top 5 recommended next steps (ranked by impact vs effort)

1. **De-hardcode the timezone** (Medium, low effort) — read `hass.config.time_zone`; fixes correctness for every non-NZ HACS user, one-line-ish change through already-parameterized `tz`.
2. **Add URL validation + a stable clip id** in `api.ts` (High-ish, low/medium effort) — allow-list schemes and stop keying navigation on `url`; closes the main untrusted-input gap and a latent nav bug.
3. **Fix the player-dialog retry leak and add its tests** (High, medium effort) — call `_teardownHls()` at the top of `_load()` and cover the hls lifecycle; this is the riskiest untested code.
4. **Resolve the dead date-range filter** (Medium, low effort) — either wire up UI or delete `fromMs`/`toMs`; removes a leaky interface cheaply.
5. **Add a lint step to CI + broaden core-logic tests** (Low/Medium, medium effort) — ESLint (with lit rules) in `validate.yml`, plus vitest for `_loadLibrary`/`_onNav`/`_openClip`; raises the floor against regressions.
