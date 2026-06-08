## 1. Ping detection (drawPing wrap)

- [x] 1.1 `OverlayReanchor._wrapDrawPing()` stores the original `canvas.controls.drawPing`, installs a wrapper that spawns a globe ping then calls the original (`orig.call(this, …)`); guarded with a `_planetsidePatched` flag
- [x] 1.2 Wrap installed in `install()` and restored in `uninstall()` (runs each activate/deactivate via the controller, so a rebuilt `canvas.controls` is re-wrapped)

## 2. Transient ping markers in OverlayReanchor

- [x] 2.1 `spawnPing(sceneX, sceneY, options)`: creates `<div class="planetside-ping">`, sets `--ping-color` from `options.user?.color` (`.css`/`toString` fallback `#ff6400`), appends to host, tracks `{ el, sceneX, sceneY, expiresAt }`
- [x] 2.2 Expiry from `CONFIG.Canvas.pings.duration` (fallback `PING_DURATION_MS` = 2000)
- [x] 2.3 `_updatePings()` (called from `update()`) reanchors each active ping via the shared `_reanchorElement` (hides on far side via `sceneToScreen` null), removes + cleans up DOM past `expiresAt`
- [x] 2.4 `uninstall()` removes all active ping DOM elements and restores `drawPing`

## 3. Wiring + style

- [x] 3.1 Wrap lives in `OverlayReanchor` and calls its own `spawnPing`; `planetside.js` passes `hostElement` to `OverlayReanchor`
- [x] 3.2 `.planetside-ping` expanding-ring pulse (two staggered rings in `--ping-color`) added to `styles/planetside.css`, z-index 15

## 4. Smoke testing in Foundry

- [x] 4.1 LongPress a visible (near-side) location → a colored pulse appears on the globe at that spot and fades after the ping duration — confirmed (regular long-press; renders & expires). NOTE: Alt-ping style not verified (modifier doesn't propagate through the forwarded path; not needed). Globe animations are slow (see perf issue, separate).
- [ ] 4.2 Orbit while a ping is active → the marker stays anchored to its sphere location
- [ ] 4.3 Ping a far-side location (or orbit so an active ping goes to the back) → the marker hides
- [ ] 4.4 Confirm the flat-map ping still works (toggle Planetside off, ping → normal behavior; and the 2D ping isn't broken while active)
- [ ] 4.5 Multiple/rapid pings → each appears and expires independently; no leaks; deactivate clears any active markers
- [ ] 4.6 (If multi-client available) a ping from another user shows on this client in that user's color

## 5. Docs

- [x] 5.1 README: noted pings appear on the globe (user-colored, auto-expiring, far-side-hidden) in How-it-works + the DOM-overlays list; GM pull camera-sync flagged as planned follow-up
