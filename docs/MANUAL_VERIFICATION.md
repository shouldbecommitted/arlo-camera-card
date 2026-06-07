# Manual Verification Checklist

Run against a live HA with hass-aarlo and real cameras. The bundle must be
installed as a Lovelace resource (see "Local install" below).

## Live mode
- [ ] Card loads showing all cameras as snapshot tiles.
- [ ] Online dot is green for reachable cameras; offline cameras are greyed.
- [ ] Motion badge appears on a camera that currently reports motion.
- [ ] Battery percentage shows where a battery sensor exists.
- [ ] Snapshots refresh roughly every `snapshot_refresh` seconds.
- [ ] Tapping a tile opens the player and a live stream starts within ~15s.
- [ ] Closing the player stops the stream (verify in Arlo app / no lingering
      "streaming" state on the camera entity).

## Recordings mode
- [ ] Switching to Recordings loads clips (spinner → grid).
- [ ] Clips are grouped Today / Yesterday / dated, newest first.
- [ ] Each thumbnail shows trigger chip + time (+ duration when available).
- [ ] Camera filter chips narrow the grid.
- [ ] Trigger filter (person/motion/vehicle/animal) narrows the grid.
- [ ] Tapping a clip plays it; Prev/Next move through the filtered list.
- [ ] With a bad/empty filter, the empty state shows.

## Error handling
- [ ] If the library call fails, an inline error + Retry appears (not a broken
      card). Retry re-fetches.

## Responsive
- [ ] On a narrow window/phone, both grids reflow to two columns.

## Local install (pre-HACS)
1. `npm run build`
2. Copy `dist/arlo-camera-card.js` to HA `www/arlo-camera-card.js`.
3. Add a Lovelace resource: URL `/local/arlo-camera-card.js`, type "module"
   (in this repo that means editing `ha-config/storage/lovelace_resources` and
   running `make deploy-dashboard`, then hard-refresh the browser).
