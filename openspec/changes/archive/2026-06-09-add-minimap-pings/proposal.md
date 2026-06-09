## Why

Pings currently render only on the globe, where a ping on the far hemisphere is hidden behind the planet. The minimap is a flat, always-visible view of the whole map — showing pings there means every player sees *where* something was pinged at a glance, even when that spot is on the back of the globe.

## What Changes

- Mirror Foundry pings onto the minimap: when a ping fires (normal, alert, or the GM pull's ping), a matching transient pulse marker appears on the minimap at the corresponding map position.
- Reuse the **single existing ping capture point** (`OverlayReanchor`'s `drawPing` wrap) — do **not** add a second `drawPing` wrap. Fan out via a new `onPing(sceneX, sceneY, options)` callback (same controller-supplied callback pattern as `onGmPull` / `onPick`).
- The minimap maps the ping's scene coords to `(u, v)` and places a `%`-anchored marker **once on spawn** (no per-frame reprojection — the flat panel doesn't move with the camera), auto-removed on the same expiry as globe pings (`CONFIG.Canvas.pings.duration`).
- Markers carry the ping's style (user color for normal, red for alert) and are `pointer-events: none` so they never block minimap click-to-pull.
- All pings are mirrored, for all users (consistent with the minimap already being a shared, all-users tool).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `globe-minimap`: Add a requirement that pings rendered on the globe also render as transient markers on the minimap at the corresponding map position.

## Impact

- `scripts/overlays.js`: add an optional `onPing` callback to `OverlayReanchor`, invoked inside `spawnPing(sceneX, sceneY, options)`. No change to existing globe ping behavior.
- `scripts/minimap.js`: add `spawnPing(sceneX, sceneY, options)` — map scene → `(u,v)`, create a `%`-anchored pulse marker with the ping's color/style, auto-remove after the ping duration; clear any pending timers in `destroy()`.
- `scripts/planetside.js`: wire `overlays.onPing` → `minimap.spawnPing` when constructing the overlays/minimap in `activate()`.
- `styles/planetside.css`: a `.planetside-minimap-ping` variant (smaller than the globe `.planetside-ping`), reusing the existing pulse keyframes.
- No new dependencies; no second `drawPing` wrap; no networking (pings already broadcast through Foundry).
