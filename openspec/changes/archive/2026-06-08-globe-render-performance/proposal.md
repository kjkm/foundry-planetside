## Why

The goal is for the globe — and pinging in particular — to feel at parity with the flat map. Two distinct problems stand in the way:

1. **Frame rate collapses while the globe is active**, making every time-based animation (the establishing shot, camera focus tweens, token glides, pings) look choppy. The cause is structural: the module re-renders the globe (two WebGL passes) on **every** Foundry tick regardless of whether anything changed, *on top of* Foundry still rendering its entire 2D canvas every tick behind a merely `visibility: hidden` `#board`. The GPU does roughly double the necessary work, 60×/second, forever.

2. **Pinging on the globe is laggy and has a multi-second cooldown.** A globe long-press is currently detected by Foundry's `MouseInteractionManager` from the *synthesized* pointer events we forward — so it takes ~½s of perfectly-still holding to register, and after a ping fires the MIM interaction state does not cleanly reset (the same synthesized-event limitation that blocks token HOVER), swallowing further long-presses for several seconds. This is an *input* problem, not a rendering one, and rendering fixes alone won't make pinging feel instant.

Both must be fixed to deliver "pings feel good." Problem 1 wants near-parity with the flat map's idle cost; problem 2 wants pings to fire instantly and repeatably.

## What Changes

- **Render on demand, not every tick.** Introduce a dirty/idle gate: the globe re-renders only when something actually changed this frame — the camera moved (drag, wheel, or an in-progress `focus()` tween), a placeable capture landed, a tracked ping needs re-anchoring, or a resize occurred. When nothing changed, both WebGL passes are skipped entirely. Pings keep their compositor-driven CSS pulse, so they animate smoothly even while the globe sits idle.
- **Suspend Foundry's redundant 2D canvas render while active.** Since the sphere body is a *static* background-image load (not a live capture of Foundry's canvas) and placeable captures render their objects directly, Foundry's continuous full-canvas render paints only the hidden `#board` — pure waste. Surgically remove **only** Foundry's per-frame render call (keep the ticker, animation logic, timers, and hooks running) while active, and restore it on deactivate. Token-movement glides and future drag-to-move keep working because they ride on `refreshToken` + our capture, not on Foundry's 2D render.
- **Lighten the per-frame passes.** Cap the renderer pixel ratio (retina renders ~4× the fragments); early-out the lens-flare second render pass when the sun is fully hidden/offscreen; reduce per-entry vector/matrix allocation in the placeable update loop to cut GC churn.
- **Remove dead code.** Delete the unused full-canvas `capture.js` (not imported anywhere) and correct the stale README "captures that canvas each dirty frame" description.
- **Make globe pinging instant and reliable (input).** Detect the long-press on the globe canvas ourselves and call `canvas.ping(origin)` directly — the same semantic-forwarding pattern that already makes token clicks reliable — instead of routing it through `MouseInteractionManager` via synthesized events. This removes the ~½s detection lag and eliminates the post-ping cooldown (a direct `canvas.ping()` has no self-throttle). Alt = alert style (same call). The press classification (click vs drag vs long-press) defers the synthesized forward so a held press never reaches MIM. **Out of scope:** the GM Shift+long-press "pull" (camera sync to all clients) remains the flagged follow-up; long-press over a token still selects rather than pings (press just off the token to ping).

## Capabilities

### New Capabilities
<!-- none — this is rendering behavior, home is the existing globe-renderer capability -->

### Modified Capabilities

- `globe-renderer`: Add a render-scheduling requirement (the globe renders on-demand when dirty, not unconditionally every frame) and extend the canvas-replacement requirement so that while active the module suspends Foundry's per-frame 2D render and restores it on deactivation.
- `globe-input`: Add a requirement that a globe long-press fires a ping directly via `canvas.ping()` (instant, no cooldown), and adjust the empty-sphere left-press forwarding so a held-still press is classified as a long-press and is NOT forwarded to `MouseInteractionManager`.

## Impact

- **Code:** `scripts/planetside.js` (per-frame loop becomes dirty-gated; activate/deactivate suspend & restore Foundry's render listener), `scripts/camera.js` (signal dirty on drag/wheel/tween), `scripts/scene.js` (pixel-ratio cap; render() participates in gating), `scripts/flare.js` (early-out when hidden), `scripts/placeables.js` (mark dirty on capture; reduce per-frame allocations). Delete `scripts/capture.js`. Update `README.md`.
- **Code (input):** `scripts/input.js` — classify the empty-sphere left gesture (click / drag / long-press), defer the synthesized forward accordingly, and fire `canvas.ping(origin, { style })` on a held-still long-press. `scripts/overlays.js` is unchanged (its existing `drawPing` wrap already renders the resulting ping marker, since `canvas.ping()` calls `drawPing` locally).
- **Behavior trade-off:** With Foundry's 2D render suspended, Foundry-side visuals that depend on a live 2D paint (e.g. its own drag ghost) won't show on the hidden board; the globe owns its own previews. No change to the source-of-truth 2D documents.
- **Load-bearing assumption to verify first:** that `refreshToken` fires during a token glide independently of Foundry's render call (the beam under both render-suspension and future on-globe movement). Confirm with a short spike before committing.
- **Dependencies:** none added.
