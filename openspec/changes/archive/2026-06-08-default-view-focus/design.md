## Context

`OrbitCamera` (`scripts/camera.js`) holds `(azimuth, elevation, radius)` and `_apply()` positions the Three camera from them:

```
  x = r·cos(el)·sin(az) ,  y = r·sin(el) ,  z = r·cos(el)·cos(az)
```

`Mercator.latLonToSpherePoint` uses the identical parameterization (`x = cos(lat)·sin(lon)`, `y = sin(lat)`, `z = cos(lat)·cos(lon)`), so a sphere point at `(lat, lon)` is centered in view exactly when `azimuth = lon` and `elevation = lat` — no trig beyond the existing `uvToLatLon`. The body's `rotation.y = −π/2` alignment is already baked so unrotated Mercator points match the visible content (tokens land correctly), so aiming this way centers the content at that lat/lon.

`scene.initial = { x, y, scale }`, with `x`/`y` **null** when unset (the common case; confirmed on a live v13 scene: `{x: null, y: null, scale: 1}`).

Activation currently leaves the camera at its constructed default `(0, 0, 2.5)`.

## Goals / Non-Goals

**Goals:**
- A reusable, source-agnostic `focus(target, {animate, duration})` on `OrbitCamera` that eased-tweens to a target orientation and yields to manual orbit.
- A pure `sceneToCameraTarget(x, y, scale)` converter (position exact, zoom heuristic).
- The globe opens (eased) at the scene's default view, with a scene-center fallback when `x`/`y` are null.

**Non-Goals:**
- GM ping/pull pan synchronization (the designed-for future consumer — a trigger wired to `focus()`).
- Recenter hotkey, token-follow, write-back ("set globe view as the scene default").
- Any networking (Foundry already broadcasts pings; not relevant here).
- Canvas/capture changes.

## Decisions

### Position mapping is exact: `azimuth = lon`, `elevation = lat`

`sceneToCameraTarget(x, y, scale)`:
- `u = (x − dims.sceneX) / dims.sceneWidth`, `v = (y − dims.sceneY) / dims.sceneHeight`.
- `{lat, lon} = mercator.uvToLatLon(u, v)`.
- `azimuth = lon`, `elevation = lat` (clamped to the camera's elevation limit — within the ±85° band this never binds).
- When `x`/`y` are null → use scene center (`u = v = 0.5` → `lat = lon = 0` → `az = el = 0`).

### Zoom mapping is a tunable heuristic

Flat `scale` (canvas px per scene px) → orbit `radius`. There's no exact correspondence (flat rectangle vs spherical cap), so:
- `visibleFraction f = viewportWidthPx / (scale · dims.sceneWidth)` — the fraction of map width the flat view shows.
- `visibleArc α = f · 2π`.
- `radius = clamp(1 + α / horizontalFovRad, MIN_RADIUS, MAX_RADIUS)`, with `horizontalFovRad` from the camera's 50° vertical FOV and aspect.

Documented as approximate and isolated in one place for tuning. `scale = 1` with a ~full-width viewport → `f ≈ 0.9`, `radius ≈ 5` (zoomed-ish out), which reads sensibly.

- **Alternative — a hand-tuned `scale → radius` curve**: simpler but arbitrary; the FOV model at least has a rationale. Either is one function to tweak.

### `focus(target, {animate, duration})` — eased tween, cancel on user input

- Sets target `(az, el, r)`; with `animate:false` (or `duration:0`) applies immediately.
- With `animate:true`: tween on the existing per-frame tick. Interpolate `el`/`r` linearly, `az` along the **shortest angular path** (wrap via `atan2(sin Δ, cos Δ)`), with an **ease-out** curve (`1 − (1−t)^FOCUS_EASE_POWER`, quintic) so motion is fastest at the start and decelerates to a gentle stop — reads as the globe spinning to rest, and matches a natural settle for future ping-pan too.
- **Cancel on manual orbit**: if the user begins dragging (`isDragging()` / a pointer-down), abort the in-progress tween so the user keeps control. The tween is advisory, never a lock.
- Source-agnostic: `focus` knows nothing about who called it. Default-view, and later ping-pan/hotkey, are all just callers.

### Where the tween runs

`OrbitCamera` advances the tween. Options: its own `requestAnimationFrame`, or a per-frame `tick()` the controller already calls. The controller (`Planetside._frame`) runs every frame on Foundry's ticker — adding a `this.orbit.tick(dt)` (or having the tween self-schedule) fits the existing loop. Decide during implementation; lean on the controller tick to avoid a second rAF.

### Default-view consumer — establishing-shot opening

In `Planetside.activate()`, after the orbit camera is created/installed, compute the target from `scene.initial` (with null/center fallback), then play a cinematic opening: **snap** (instant `focus`) to a wide, **equatorial** establishing pose offset laterally from the target (`radius = INTRO_RADIUS`, `azimuth = target.azimuth + INTRO_AZ_OFFSET`, **`elevation = 0`** — side-on), then **eased `focus(target, { animate, duration, elevEasePower })`** so the camera spins around the vertical axis and zooms *in*. The elevation is **lagged** (`elevEasePower` → ease-in) so the camera only tilts up to the destination latitude at the *end* — the spin reads side-on ("globe spinning") the whole way and the camera "arrives" last. This solves the geometric tension that a vertical-axis spin viewed from a steep (high-latitude) vantage looks pole-ish: we keep the vantage side-on during the spin and tilt to the high-latitude target only as it settles. The azimuth offset is relative to the target so the sweep always arrives from the same direction. The choreography lives in the controller (consumer policy); `focus()` stays generic (no `elevEasePower` → uniform ease-out), so future consumers like ping-pan ease directly from the current view.

## Risks / Trade-offs

- **[Zoom heuristic feels off]** → It's one function; tune the FOV constant or swap to a curve. Position (the part that matters most) is exact.
- **[Azimuth wrap]** → Use shortest-path interpolation so it never spins the long way around.
- **[Tween vs. user input race]** → Cancel the tween on any orbit drag; user input always wins.
- **[`scene.initial` null fields]** → Common case; the center fallback is the primary path, not an afterthought.
- **[Easing on activate competing with first-frame setup]** → The globe may still be initializing when the tween starts; starting from the constructed default `(0,0,2.5)` and easing to the target is fine, but verify it doesn't fight the initial `_apply`.

## Open Questions

- Easing duration / curve — start ~800 ms smoothstep; tune by feel.
- Tween scheduling: controller `tick()` vs self-`rAF` — implementation detail.
- (Deferred) the exact ping/pull trigger for the future sync consumer (`canvasPan` vs a ping hook vs distinguishing pull from a plain visual ping).
