## Why

`tile-click-triggers` forwards globe left-click / double-left-click to Monk's Active Tiles `click` / `dblclick` triggers. MATT also supports **right-click** (and double-right-click) tile triggers, which are currently unreachable from the globe because right-button gestures are consumed by the camera orbit. This extends the same mechanism to the right-button methods so right-click-triggered tiles can be exercised from the globe.

## What Changes

- A **right-click** (right pointer-down + up with negligible movement) over a tile configured for a MATT `rightclick` trigger fires that tile's actions via `tile.document.trigger`. A **double-right-click** additionally fires the double-right-click trigger.
- Right-click triggers are discriminated from **right-drag orbit** by movement: a clean click (no/▵small drag) fires the trigger; a drag orbits the camera as today. Both can coexist — a no-movement right-click already produces no orbit change.
- Tiles are found by the same scene-coordinate hit-test as `tile-click-triggers` (so imageless trigger regions fire), gated on the tile's configured trigger method.
- **BREAKING/none.** Existing behavior preserved: right-drag still orbits; right-click on a *token* still opens the Token HUD (tokens take priority over tiles); left click/double-click triggers unchanged.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `globe-input`: extend tile trigger forwarding to right-button methods — a globe right-click / double-right-click over a tile configured for a MATT `rightclick` / double-right-click trigger fires it, without breaking right-drag orbit.

## Impact

- **Code:** `scripts/input.js` — track right pointer-down position/time; on right pointer-up with negligible movement, run the existing tile hit-test + gated `document.trigger` with the right-click method(s); reuse `_tilesAtScenePoint` / `_tileHasTrigger` / `_fireTileTrigger`. This handling must sit outside the `orbit.isDragging()` early-return (the forwarder sees right-up before the orbit clears its drag state).
- **Behavior:** additive; 2D scene/tile docs remain source of truth. Orbit, token right-click HUD, and left-click triggers unchanged. No-ops when MATT absent or no matching tile.
- **Dependency note:** MATT-specific; the exact trigger-method strings for right-click and double-right-click must be confirmed against the installed MATT (as `'click'`/`'dblclick'` were), since MATT's config dropdown defines the stored value.
- **Testing prerequisite:** a tile configured with a MATT **Right-Click** (and/or double-right-click) trigger and a visible action.
