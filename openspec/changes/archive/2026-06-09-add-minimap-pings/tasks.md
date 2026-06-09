## 1. Ping fan-out from the capture point

- [x] 1.1 In `overlays.js`, accept an optional `onPing` callback in the `OverlayReanchor` constructor and store it.
- [x] 1.2 In `OverlayReanchor#spawnPing`, after creating the globe marker, invoke `this.onPing?.(sceneX, sceneY, options)` (no change to existing globe-ping behavior; still no second `drawPing` wrap).

## 2. Minimap ping markers

- [x] 2.1 In `minimap.js`, add `spawnPing(sceneX, sceneY, options)`: bail if no container; map scene → `(u, v)` via `canvas.dimensions`; create a `.planetside-minimap-ping` child positioned at `left: u·100%`, `top: v·100%`, `pointer-events: none`.
- [x] 2.2 Apply ping style: alert variant for `options.style === "alert"`, else set `--ping-color` from the pinging user's color (mirror `OverlayReanchor#spawnPing`).
- [x] 2.3 Auto-remove the marker after `CONFIG.Canvas.pings.duration` (fallback constant); track pending timers and clear + remove all markers in `destroy()`.

## 3. Controller wiring

- [x] 3.1 In `planetside.js#activate()`, pass `onPing: (x, y, options) => this.minimap?.spawnPing(x, y, options)` when constructing `OverlayReanchor` (minimap is constructed before/with overlays so the reference is available).

## 4. Styling and verification

- [x] 4.1 Add a `.planetside-minimap-ping` style in `styles/planetside.css` reusing the existing pulse keyframes at a smaller ring size, with the normal/alert color variants and a dark drop-shadow for legibility.
- [x] 4.2 Verify in Foundry: a ping (normal and alert) shows a matching pulse on the minimap at the right spot and expires with the globe ping.
- [x] 4.3 Verify a ping on the far hemisphere (hidden on the globe) still shows on the minimap.
- [x] 4.4 Verify ping markers do not block minimap click-to-pull, and that markers/timers are cleaned up on deactivation (no leaks, no orphaned pulses).
