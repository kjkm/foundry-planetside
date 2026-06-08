## Context

Pings are drawn by `ControlsLayer#drawPing(position, options)` on every client (core networks the ping broadcast). Probe results on the live v13 install:

```
  position: { x, y }            — scene coordinates (same space we inverse-project everywhere)
  options:  { style, user }     — e.g. style: 'alert', user: <User>  (Alt+LongPress)
```

`OverlayReanchor` (`scripts/overlays.js`) already projects scene coordinates to the globe: `sceneToScreen(sceneX, sceneY)` returns `{ x, y }` screen pixels or `null` when the point is on the far hemisphere (it goes scene → `uvToLatLon` → sphere point → facing check → `projectWorldToScreen`), and its `update()` runs every frame reanchoring token nameplates / HUD. A ping is exactly a transient version of that: a DOM element positioned at a projected scene point each frame, hidden when behind the globe.

There is no public `drawPing` hook and libWrapper is inactive, so detection is a manual wrap of `canvas.controls.drawPing`, applied/removed with the Planetside lifecycle.

## Goals / Non-Goals

**Goals:**
- Every ping (any client, any style) appears on the globe at its scene location, colored by the pinging user, auto-expiring, tracking the camera, hidden on the far side.
- Maximal reuse: lean on `OverlayReanchor.sceneToScreen` and its per-frame `update()`; the flat-canvas ping is preserved.

**Non-Goals:**
- GM pull **camera sync** (separate change; reuses this wrap + the `focus()` primitive; needs the chevron/pull probe).
- Per-style ping artwork (one pulse marker for all styles).
- Far-side edge/offscreen indicator (defer; far-side pings hide).
- Any canvas/capture/camera changes.

## Decisions

### Detect via a managed wrap of `canvas.controls.drawPing`

On Planetside activate, replace `canvas.controls.drawPing` with a wrapper that (1) calls the original (preserving the flat-canvas ping), then (2) spawns a globe ping. On deactivate, restore the original. `canvas.controls` can be rebuilt on a canvas redraw, so the wrap is (re)installed on activate (canvasReady) and removed on deactivate — the same install/uninstall lifecycle as the other components.

- **Alternative — wrap `canvas.ping`**: rejected; that's the local initiator, not the per-client render point. `drawPing` fires on all clients (confirmed by probe).
- **Alternative — `canvasPan`/socket**: not needed for rendering; core already broadcasts and calls `drawPing` everywhere.

### Render transient pings inside `OverlayReanchor`, reusing `sceneToScreen`

Add to `OverlayReanchor`:
- `spawnPing(sceneX, sceneY, options)`: create a DOM marker (`<div>` with a CSS pulse), color it `options.user?.color`, append to the host, and push `{ el, sceneX, sceneY, expiresAt }` to an active-pings list.
- In `update()` (already per-frame): for each active ping, `sceneToScreen(sceneX, sceneY)` → if `null` hide it, else position it (same `left/top` + `translate(-50%,-50%)` treatment as the reanchor); remove + clean up DOM once past `expiresAt`.

This reuses the projection, the facing/far-side handling, the per-frame loop, and the host element — the only new code is the transient marker list + a CSS animation.

- **Alternative — a separate `PingLayer` component**: more files for no benefit; `OverlayReanchor` already owns "DOM elements positioned at projected sphere points."
- **Alternative — Three.js sprite on the sphere**: rejected per direction (render like the token DOM overlays); also heavier for a fleeting marker.

### Duration and color from Foundry

Use `CONFIG.Canvas.pings.duration` for expiry (fallback ~2000 ms) so the globe ping vanishes in sync with the flat-canvas ping. Color from `options.user?.color` (fallback to a neutral). One pulse marker regardless of `style`.

## Risks / Trade-offs

- **[`canvas.controls` rebuilt / wrap lost on redraw]** → reinstall the wrap on activate (canvasReady fires after redraw); guard against double-wrapping (only wrap if not already ours).
- **[Ping spam / leaks]** → each ping owns a timer/expiry; `update()` removes expired DOM; deactivate clears all active pings and restores `drawPing`.
- **[`options` shape varies by ping style/version]** → only `user` (color) and the scene `position` are used, both stable; unknown fields are ignored, so chevron/pull pings render fine too (their camera behavior is the next change).
- **[Far-side pings invisible]** → accepted for v1 (consistent with nameplates); an offscreen edge-indicator is a later nicety.

## Open Questions

- Marker look: a simple expanding-ring pulse in the user color (lean) vs a small icon — cosmetic, decide during implementation.
- Whether to also show the pinging user's name by the marker (cheap, optional) — defer unless wanted.
- (Deferred, next change) the Shift+LongPress pull's `options` shape, to drive `focus()` for camera sync.
