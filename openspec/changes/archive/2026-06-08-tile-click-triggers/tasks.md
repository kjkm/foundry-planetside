## 1. Tile hit-test + trigger

- [x] 1.1 Added `_tilesAtScenePoint(sceneX, sceneY)` in `input.js` — filters `canvas.tiles.placeables` by axis-aligned footprint rect containment
- [x] 1.2 Added `_tileHasTrigger(tile, method)` — true when `flags["monks-active-tiles"]` present, `active !== false`, and `trigger` includes `method` (generalized from click-only to support `dblclick` too)
- [x] 1.3 Added `_fireTileTrigger(tile, sceneX, sceneY, method)` + `_fireTileTriggers(...)` — `doc.trigger({ method, pt, tokens: controlled docs, userId })`, guarded + try/catch. Added `_isSphereDoubleClick(x, y)` (time + scene-distance) since the test tile used a `dblclick` trigger

## 2. Wire into the left-click path

- [x] 2.1 In `_onPointer` miss-token branch, after `sceneX/sceneY`, on left pointer-down: fire `click` tiles; if a double-click is detected, also fire `dblclick` tiles
- [x] 2.2 Existing empty-click behavior (sphere dispatch + `releaseAll`) left intact; tile triggering is additive
- [x] 2.3 No-ops when MATT absent (gate), no tile covers the point (empty filter), or no covering tile has a click trigger

## 3. Smoke testing in Foundry

- [ ] 3.1 Configure a tile with a MATT **Click** or **Double-Click** trigger (with a visible action, e.g. a chat message or a sound)
- [x] 3.2 Click (or double-click, matching the config) that tile on the globe; verify the MATT action runs — confirmed (double-click trigger fires)
- [ ] 3.3 Verify an imageless click-trigger region (no art) still fires when clicked at its location
- [ ] 3.4 Verify an `enter`-only tile does NOT fire on click
- [ ] 3.5 Verify clicking empty globe (no tile) still behaves as before (deselect / no error)
- [ ] 3.6 Verify tokens still select/HUD/double-click normally (no regression to the token click path)

## 4. Docs

- [x] 4.1 Updated the README "Tile layer" note: globe clicks fire MATT `click` triggers (scene-coordinate hit-test so imageless regions work); noted non-goals (enter/hover, selection/editing, rotated-tile hit-test, overlap fires all)
