## 1. Confirm MATT right-button method strings

- [x] 1.1 Confirmed: the default `"rightclick"` method string matches MATT (right-click trigger fires)
- [x] 1.2 Confirmed via testing (`"dblrightclick"` default works as implemented)

## 2. Right-button click/drag discrimination

- [x] 2.1 In `input.js`, track the right pointer-down `{ x, y }` client coords (`button === 2`) as `this._rightDown`
- [x] 2.2 On right pointer-up, compute movement from the down point; classify as a click when below `RIGHT_CLICK_MAX_MOVE` (5 px), else a drag (orbit — nothing extra)
- [x] 2.3 Added `_isSphereDoubleRightClick` mirroring `_isSphereDoubleClick` with its own `_lastSphereRightClick` state

## 3. Fire right-button tile triggers

- [x] 3.1 Right-button up handled at the top of `_onPointer`, before the `orbit.isDragging()` guard, via `_handleRightClickUp(e)` (then `return`)
- [x] 3.2 On a recognized right-click: sphere raycast + inverse-Mercator → scene coord; reuse `_tilesAtScenePoint` + `_tileHasTrigger(tile, TILE_RIGHTCLICK_METHOD)` + `_fireTileTrigger`
- [x] 3.3 On a recognized double-right-click: also fire `TILE_DBL_RIGHTCLICK_METHOD` (constants at top, easily adjusted once 1.1/1.2 confirm MATT's strings)
- [x] 3.4 Token priority: `_handleRightClickUp` raycasts tokens first and returns if one is hit (its HUD already opened on right-down)

## 4. Smoke testing in Foundry

- [x] 4.1 Configured a tile with a MATT Right-Click trigger + visible action
- [x] 4.2 Right-click the tile on the globe (no drag) → action runs — confirmed
- [x] 4.3 Right-drag → camera orbits, trigger does NOT fire — confirmed
- [x] 4.4 Double-right-click → fires — confirmed
- [x] 4.5 Right-click a token → Token HUD still opens (no regression) — confirmed
- [x] 4.6 Right-click empty globe → orbit/no-op, no errors — confirmed

## 5. Docs

- [x] 5.1 Updated the README "Tile layer" note: all four methods (click/dblclick/rightclick/dblrightclick) forwarded; right-click vs right-drag explained; right-click-on-token = HUD noted
