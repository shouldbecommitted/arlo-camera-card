# Arlo Camera Card

A responsive Home Assistant Lovelace card for Arlo cameras, built on the
[hass-aarlo](https://github.com/twrecked/hass-aarlo) integration. Live view and
recordings review in one card.

- **Live mode** — a grid of all your cameras as recent snapshots; tap one to open
  a full live stream (one stream at a time, so it stays light on bandwidth).
- **Recordings mode** — newest-first thumbnail grid grouped by day, with camera
  and trigger filters; tap a clip to play, with prev/next to move through events.

Works on phone (companion app) and desktop/tablet — the grids reflow to two
columns on narrow screens.

## Requirements

- The [hass-aarlo](https://github.com/twrecked/hass-aarlo) integration installed
  and working, with at least one `camera.aarlo_*` entity.
- An Arlo subscription if you want recordings (live view works without one).

## Installation (HACS)

1. HACS → Frontend → ⋮ → Custom repositories → add this repo URL, category
   "Lovelace".
2. Install "Arlo Camera Card".
3. The resource `/hacsfiles/arlo-camera-card/arlo-camera-card.js` is added
   automatically.

## Configuration

```yaml
type: custom:arlo-camera-card
# All options are optional; cameras defaults to every camera.aarlo_* entity.
cameras:
  - camera.aarlo_doorbell
  - camera.aarlo_front
  - camera.aarlo_garden
  - camera.aarlo_pool
  - camera.aarlo_laundry
default_mode: live        # live | recordings
columns: 3                # desktop columns; narrow screens force 2
snapshot_refresh: 10      # seconds between live-grid snapshot refreshes
library_days: 7           # days of recordings to request
```

## Development

```bash
npm install
npm test          # vitest unit tests
npm run build     # bundle to dist/arlo-camera-card.js
```
