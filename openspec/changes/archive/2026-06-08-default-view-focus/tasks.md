## 1. Scene → camera-target converter

- [x] 1.1 `_defaultViewTarget()` in `planetside.js` (has `mercator` + `canvas.dimensions`): scene coords → `uvToLatLon` → `{ azimuth: lon, elevation: lat, radius }`
- [x] 1.2 Null `x`/`y` → scene center (`azimuth = elevation = 0`)
- [x] 1.3 `_scaleToRadius(scale)` heuristic: `1 + (viewportW/(scale·sceneWidth))·2π / horizontalFov`; camera `focus()` clamps to its radius bounds (single source of clamp)

## 2. Camera focus primitive

- [x] 2.1 `OrbitCamera.focus(target, { animate = true, duration } = {})`: clamps el/r; `animate:false`/`duration:0` applies immediately via `_apply()`
- [x] 2.2 Eased tween: `el`/`r` linear, `az` shortest-path (`atan2(sin Δ, cos Δ)`), ease-out (`1 − (1−t)^FOCUS_EASE_POWER`, quintic — fast start, long gentle tail); advanced by `tick()` (called from the controller `_frame`); `_apply()` each step
- [x] 2.3 `_onPointerDown` (button 2) clears `this._focus` — manual orbit cancels the tween
- [x] 2.4 `FOCUS_DURATION_MS = 800` constant

## 3. Default-view consumer

- [x] 3.1 `Planetside.activate()` plays an establishing-shot opening: instant `focus` to a wide equatorial pose offset laterally from the target (`INTRO_RADIUS` / `INTRO_AZ_OFFSET`, `elevation = 0` — side-on), then eased `focus(target, { animate:true, duration: INTRO_DURATION_MS, elevEasePower: INTRO_ELEV_EASE_POWER })` that spins around the vertical axis + zooms in, lagging the elevation so it tilts up to the destination latitude last (`MAX_RADIUS` raised to 12 for the wider start)
- [x] 3.2 `_defaultViewTarget` handles absent/partial `scene.initial` (null x/y → center; `scale ?? 1`)
- [x] 3.3 `this.orbit?.tick()` wired into `_frame()`

## 4. Smoke testing in Foundry

- [x] 4.1 Activate on a scene with NO default view set (null x/y) → establishing shot starts wide/side-on, spins + zooms in to settle centered on the scene center — confirmed
- [x] 4.2 Set a scene default view, reactivate → establishing shot spins side-on then tilts up to settle aimed at that location (incl. high-latitude default views) — confirmed
- [x] 4.3 During the opening, start dragging → the animation cancels and orbit follows the cursor — confirmed
- [x] 4.4 Azimuth takes the shortest path (no long way around) for off-center default views — confirmed
- [x] 4.5 Normal orbit/zoom work after the focus completes — confirmed

## 5. Docs

- [x] 5.1 README Controls note: globe eases to the scene's default view; `focus()` primitive is the seam for future camera sync (GM ping-pan), not yet implemented
