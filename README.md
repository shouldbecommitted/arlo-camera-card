# Arlo Camera Card

A responsive Home Assistant Lovelace card for Arlo cameras, built on the
[hass-aarlo](https://github.com/twrecked/hass-aarlo) integration. Live view and
recordings review in one card.

- **Live mode** — a grid of all your cameras as recent snapshots; tap one to open
  a full live stream (one stream at a time, so it stays light on bandwidth).
- **Recordings mode** — newest-first thumbnail grid grouped by day, with camera
  and trigger filters; tap a clip to play, with prev/next to move through events.

Works on phone (companion app) and desktop/tablet — the grids auto-fit to the
card's width, so tiles stay a sensible size whether the card sits in a narrow
sections column or a full-width view. To get larger tiles on desktop, place the
card in a wider/full-width section.

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
  - camera.aarlo_front_door
  - camera.aarlo_driveway
  - camera.aarlo_backyard
  - camera.aarlo_side_gate
default_mode: live        # live | recordings
columns: 3                # OPTIONAL fixed column count; omit for responsive auto-fit
snapshot_refresh: 10      # seconds between live-grid snapshot refreshes
library_days: 7           # days of recordings to request
```

## Development

```bash
npm install
npm test          # vitest unit tests
npm run build     # bundle to dist/arlo-camera-card.js
```
