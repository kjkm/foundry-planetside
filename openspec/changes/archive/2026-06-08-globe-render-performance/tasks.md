## 1. Spike: verify the load-bearing assumption (do first)

- [x] 1.1 Confirm `refreshToken` fires during a token glide when Foundry's per-frame render call is removed but the ticker keeps running (test on both v12 and v13). Throwaway code is fine.
- [x] 1.2 Identify the precise, reversible way to remove only Foundry's 2D render step from the ticker (the render listener / render flag) in this Foundry version; confirm the ticker keeps advancing afterward.
- [x] 1.3 If 1.1/1.2 prove unsafe, record the fallback (D1 + D4 only, or `ticker.maxFPS` throttle) before proceeding — and adjust scope of section 3.

## 2. Dirty-gated rendering (render scheduler)

- [x] 2.1 Add a controller-owned dirty bit + `markDirty()` to `Planetside`; initialize dirty on activate so the first frame renders
- [x] 2.2 `camera.js`: call `markDirty()` from `_apply()` (covers drag, wheel, and tween steps in one place)
- [x] 2.3 `placeables.js`: `markDirty()` on a successful `_captureOne()` (new texture / repositioned glide step)
- [x] 2.4 Pings are NOT a dirty source (revised): `OverlayReanchor` is intentionally not given `markDirty`. Ping/HUD/bubble tracking rides on the camera dirty source (2.2) + the ungated per-frame `overlays.update()`; the pulse is compositor-driven. (Avoids forcing full-rate renders for a ping's whole life.)
- [x] 2.5 `scene.js` resize handler (`_onResize`): `markDirty()`
- [x] 2.6 `planetside.js` `_frame()`: only call `scene3d.render()` when dirty (or a focus tween is in progress); clear the bit after rendering. Keep `orbit.tick()` / layer `update()` / `overlays.update()` running every frame so dirty sources are detected
- [x] 2.7 Verify: idle globe issues no WebGL render passes (instrument a render counter); camera move, capture, resize, and active ping each trigger a render

## 3. Suspend Foundry's redundant 2D render while active

- [x] 3.1 On activate: suspend only Foundry's per-frame 2D render (per the 1.2 mechanism), leaving the ticker running; (re)apply on each activation (do not assume it persists across a canvas redraw)
- [x] 3.2 On deactivate: restore Foundry's per-frame render and force one render so the flat canvas is correct before `#board` becomes visible
- [x] 3.3 Verify: while active, Foundry's full-canvas render does not run, yet token glides still propagate to the globe (via `refreshToken` → capture); toggling Planetside off leaves the flat canvas rendered correctly

## 4. Lighten the per-frame passes

- [x] 4.1 `scene.js`: cap `renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CAP))`; pick `CAP` (~1.5) by eye on a hi-DPI display
- [x] 4.2 `flare.js`: skip the second WebGL render pass entirely when all flare elements are hidden (sun behind camera / occluded / offscreen) instead of rendering an empty scene
- [x] 4.3 `placeables.js` / `scene.js#surfaceFrame`: reuse scratch `Vector3`/`Matrix4`/`Quaternion` instances in the per-frame update path to cut GC churn (refinement; no behavior change)

## 5. Cleanup + docs

- [x] 5.1 Delete `scripts/capture.js` (unused — not imported anywhere); confirm no references remain
- [x] 5.2 README: correct the stale "captures that canvas each dirty frame" description; note on-demand rendering + that Foundry's 2D render is suspended while the globe is active
- [x] 5.3 `openspec validate --change globe-render-performance --strict`

## 6. Smoke testing in Foundry

- [x] 6.1 Measure frame time / FPS before vs. after on a representative scene; confirm idle FPS is at/near flat-map parity and the establishing shot + focus tweens are smooth (not choppy)
- [x] 6.2 Token glide (move a token) renders smoothly on the globe and the marker tracks correctly
- [x] 6.3 Pings: pulse animates smoothly while the globe is idle; ping appears, tracks while orbiting, hides on far side, expires
- [x] 6.4 Deactivate → flat map is correct and fully interactive (Foundry render restored); re-activate works (suspension re-applied)

## 7. Instant, cooldown-free globe pinging (input)

- [x] 7.1 Confirm `canvas.ping()`'s `origin` shape and the modifier→style mapping (plain vs Alt=alert) against the installed Foundry (v12/v13); note the exact call (throwaway/console check is fine)
- [x] 7.2 `input.js`: classify the empty-sphere left gesture — on left pointer-down over empty sphere, record `{downPos, sceneX, sceneY, modifiers, t}` and start a hold timer (`PING_HOLD_MS` ~350ms); do not forward/deselect/tile-trigger yet
- [x] 7.3 `input.js`: on the hold timer elapsing while still down and not moved past tolerance → fire `canvas.ping({x, y}, { style })` (Alt → alert), mark the gesture `pinged`
- [x] 7.4 `input.js`: resolve the deferred gesture on up/move — CLICK (up before timer, not moved) runs the existing empty-click actions (releaseAll, tile click/dblclick) + forwards synthesized down+up; DRAG (moved past tolerance) forwards synthesized down at downPos then live moves; LONG-PRESS (`pinged`) suppresses all forwarding
- [x] 7.5 Verify the token path and right-button (orbit / tile right-click) path are untouched by the refactor (long-press over a token still selects; right-drag still orbits; right-click tile triggers still fire)
- [x] 7.6 Tune `PING_HOLD_MS` by feel (snappy but deliberate)
- [x] 7.7 `openspec validate globe-render-performance --strict`

## 8. Ping input smoke testing in Foundry

- [x] 8.1 Long-press empty globe → ping fires within the hold threshold (instant feel), marker renders, broadcasts to other clients
- [x] 8.2 Fire pings back-to-back → no multi-second cooldown; each long-press pings immediately
- [x] 8.3 Alt+long-press → alert style; short left-click still deselects / fires tile click; left-drag still forwards (best-effort) without pinging
- [x] 8.4 Long-press over a token selects it (no ping); right-click HUD, right-drag orbit, and right-click tile triggers all still work
