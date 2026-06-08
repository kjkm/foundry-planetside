## Why

Tiles now render on the globe (`tile-display-capture`), but clicking them does nothing. The motivating goal is testing Monk's Active Tiles (MATT) **click** triggers from the globe — MATT triggers apply to tiles, not tokens. Exploration confirmed the mechanism: MATT exposes `tile.document.trigger(args)`, so we can fire a tile's actions directly without any PIXI/MIM event plumbing.

## What Changes

- When the player left-clicks the globe and the click does not hit a token, the module SHALL inverse-Mercator-project the sphere hit to a 2D scene coordinate (the existing sphere-click path already computes this), find the tile(s) whose footprint covers that point, and — for any whose MATT configuration includes a `click` trigger — call `tile.document.trigger({ method: "click", pt, tokens, userId })`.
- Tiles are found by **scene-coordinate hit-testing**, NOT by raycasting a rendered tile mesh, so **imageless MATT trigger regions** (which render nothing) still fire.
- The MATT trigger-type gate is replicated on our side (only fire tiles configured for `click`), because `document.trigger` runs a tile's actions regardless of method.
- Optional: double/right-click → `method: "dblclick"`/`"rightclick"` (same gating), if low-cost.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `globe-input`: add tile click-trigger forwarding — a globe left-click over a tile configured for a MATT `click` trigger fires that tile's MATT actions.

## Impact

- **Code:** `scripts/input.js` (in the existing left-click-miss-token branch: scene-coord tile hit-test + gated `document.trigger`); a small tile-lookup helper. No new module, no dependency.
- **Behavior:** purely additive interaction; the 2D scene/tile documents remain the source of truth. No tile selection, drag, or editing; no token-enter triggers (those already fire from flat-map movement); rendering unchanged.
- **Dependency note:** this is MATT-specific (keys off `flags["monks-active-tiles"]` and `document.trigger`); it no-ops cleanly when MATT is absent or a tile has no click trigger.
- **Testing prerequisite:** a tile configured with a **Click** trigger in MATT (the existing `'enter'` region won't exercise it).
