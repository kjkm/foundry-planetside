## Why

Pings don't appear on the globe. When a user pings the canvas (Alt+LongPress, or a GM Shift+LongPress pull), Foundry draws the marker on the hidden flat canvas, so globe viewers see nothing. Pings are a core "look here" communication tool and should show on the globe at the pinged location. This is also the first half of camera-sync — rendering a ping establishes the `drawPing` detection seam that the later GM pull-pan will reuse.

## What Changes

- **Detect pings** by wrapping `canvas.controls.drawPing(position, options)` while Planetside is active (call through to the original so the flat-canvas ping is unaffected). Verified via probe: `position` is in scene coordinates; `options` carries `{ style, user }`. The wrap fires on every client for every ping (core already networks pings — no socket code needed).
- **Render each ping on the globe** as a transient DOM marker, reusing the existing overlay machinery: `OverlayReanchor.sceneToScreen(x, y)` already converts a scene coordinate to a projected screen position and returns `null` when the point is on the far hemisphere. The marker is colored by the pinging user (`options.user.color`), animated (pulse), auto-expires after the ping duration, and is repositioned each frame by `OverlayReanchor.update()` so it tracks the globe as the camera orbits.
- **Far-side pings hide** (when `sceneToScreen` returns `null`), exactly as token nameplates do — consistent behavior, no new logic.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `overlay-reanchoring`: in addition to reanchoring Foundry-core DOM overlays, the layer renders transient ping markers on the globe at a pinged scene location (projected, user-colored, auto-expiring, hidden on the far side).

## Impact

- **Code:** `scripts/overlays.js` (`OverlayReanchor` gains `spawnPing(x, y, options)` + active-ping tracking/expiry in `update()`, reusing `sceneToScreen`); a `drawPing` wrap installed/removed with the layer lifecycle (in `overlays.js` or wired from `main.js`/`planetside.js`); `styles/planetside.css` (ping pulse animation). No canvas/capture/camera changes.
- **Behavior:** purely additive; the flat-canvas ping is preserved (we call through). Pings appear on the globe for all clients.
- **Non-goals:** the GM pull **camera sync** (next change — needs the Shift+LongPress/chevron probe and reuses the `focus()` primitive + this same `drawPing` wrap); per-style ping art (one pulse marker for all styles); a far-side edge/offscreen indicator (defer; far-side pings simply hide for now).
- **Dependencies:** none new; piggybacks on Foundry's existing ping broadcast.
