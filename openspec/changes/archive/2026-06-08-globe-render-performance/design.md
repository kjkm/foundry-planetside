## Context

`Planetside._frame()` is registered on `canvas.app.ticker` and runs every Foundry frame. It unconditionally calls `scene3d.render()` — two WebGL passes (main scene: sphere + two transparent atmosphere shells + 5000-point starfield + sun sprite; then the lens-flare second pass) — regardless of whether anything changed. Meanwhile Foundry continues to render its **entire** 2D canvas every tick; `#board` is only `visibility: hidden`, so the pixels are still drawn. The net effect is ~2× the necessary GPU work at 60 Hz, which starves the shared frame budget and makes all time-based animation appear choppy ("slower than the flat map").

Key facts that shape the design:
- The sphere **body texture is a static image load** (`THREE.TextureLoader().load(imageSrc)` in `scene.js`), not a live capture of Foundry's canvas. The globe never reflects Foundry's per-frame 2D paint.
- **Placeable captures** (`placeables.js`) call `renderer.render(object, { renderTexture })` on specific display objects directly, and read live state (`mesh.getBounds()`, `texture`, rotation) off the display object — none of which depends on Foundry having auto-rendered the full frame.
- **Token movement reaches the globe via `refreshToken`**, which Foundry fires from animation *logic* on the ticker, separate from the render call.
- **Pings are DOM elements** whose pulse is a CSS `@keyframes` animation running on the compositor thread, independent of our JS render loop.

## Goals / Non-Goals

**Goals:**
- Near-parity with the flat map's idle cost: when nothing is moving, the globe does **zero** WebGL work per frame (only the compositor's free CSS ping pulse continues).
- Keep all current behavior intact: camera tweens, token/tile captures and repositioning, ping markers, the establishing shot.
- A small, extensible "needs redraw" mechanism that any future motion source can poke.
- Preserve compatibility with future on-globe token movement (watching glides *and* drag-to-move).
- **Pinging on the globe fires instantly and repeatably** — no perceptible detection lag and no post-ping cooldown — at parity with flat-map ping responsiveness.

**Non-Goals:**
- Shared-WebGL-context zero-copy capture (separate, already-noted follow-up).
- Reducing capture cost itself (captures are already change-driven and budgeted).
- Any change to the 2D scene as source of truth.
- A live drag-ghost preview on the globe (out of scope here; noted as a future input concern).
- The GM Shift+long-press **pull** (rotate all clients' globes to the ping) — separate feature (camera sync + networking); the long-press machinery added here is where it will later hook.
- Pinging *on top of* a token via long-press — a press over a token still selects it; press just off the token to ping. (Avoids disturbing the token interaction path.)

## Decisions

### D1: Dirty-gated on-demand rendering (a render scheduler)

The controller owns a single "dirty" bit. `_frame()` becomes:

```
_frame():
  orbit.tick()                  // advances a focus tween if active; may set dirty
  tokenLayer.update()           // capture if dirty entries; a landed capture sets dirty
  tileLayer.update()
  overlays.update()             // reanchor; a tracked ping sets dirty while it needs tracking
  if (dirty || cameraMovedThisFrame):
      scene3d.render()
      dirty = false
```

Dirty sources, each calling a `markDirty()`:
- **Camera:** `_apply()` (drag, wheel, tween step) flips dirty — covers every orientation change in one place.
- **Camera tween active:** `orbit.tick()` while `_focus` is non-null keeps it dirty (it calls `_apply()` anyway).
- **Capture landed:** `placeables._captureOne()` success marks dirty (new texture must be drawn; also covers a glide, since each animation step re-captures).
- **Resize:** the resize handler marks dirty.

**Pings are deliberately NOT a dirty source** (revised during implementation). A ping marker's *screen position* only changes when the camera moves — and that is already covered by the camera source. Its *pulse* is a CSS/compositor animation independent of our render loop. `overlays.update()` runs every frame regardless of the gate and re-anchors all DOM overlays (HUD, bubbles, pings) using the current camera matrices, so a ping tracks correctly while the camera moves and stays put (pulsing) while it's idle — with zero globe renders. Marking dirty "while any ping is active" would have forced full-rate rendering for the ping's entire ~2 s life for no visual gain, defeating the idle gate. So `OverlayReanchor` is not given `markDirty` at all.

This also fixes the frame ordering: `scene3d.render()` must run **before** `overlays.update()` so reanchoring uses the camera matrices that render just updated; when idle the render is skipped and the matrices are already current (the camera didn't move).

Rationale: a single owned bit is the least machinery that fully decouples render frequency from tick frequency, and it's trivially extensible — future sources (e.g. a GM pull pan) just call `markDirty()`. Alternative considered: a separate `requestAnimationFrame` loop independent of Foundry's ticker. Rejected for now — it doesn't reduce the *work*, only moves it, and it complicates teardown; gating on Foundry's existing ticker is simpler and sufficient.

### D2: Keep pings as DOM (do not move them into Three.js)

A 3D ping (sprite/shader on the globe) would have to animate its pulse inside the Three scene, forcing a globe re-render every frame for the ping's ~2 s lifetime — directly defeating D1. The existing DOM ping pulses on the compositor for free while the globe idles. Decision: pings stay DOM. (A 3D ping is only justified if we later want pings visibly conforming to the curved surface with perspective — an aesthetic goal, not this change.)

### D3: Surgically suspend Foundry's 2D render while active

On activate, remove **only** Foundry's per-frame canvas render call from the ticker, leaving the ticker itself (and thus animation logic, timers, hooks including `refreshToken`) running. On deactivate, restore it and force one render so the flat canvas is correct when revealed.

The exact removal target (e.g. the PIXI `Application` render listener vs. a Foundry-level render flag) will be pinned down in the spike (O1). The mechanism must be: (a) reversible, (b) leave the ticker advancing, (c) not assumed to persist across a Foundry canvas redraw (re-apply on (re)activate, same pattern as the `drawPing` wrap).

Rationale: this is the single largest win and it's clean at the activate/deactivate boundary. Alternative considered: `app.stop()` — rejected, it freezes the whole ticker (token glides would snap on the globe, timers stall). Alternative: throttle Foundry to low FPS via `ticker.maxFPS` — rejected as a primary lever (still pays for Foundry renders; muddier), though it's a viable fallback if surgical removal proves unsafe in some Foundry build.

### D4: Lighten the passes

- **Pixel-ratio cap:** `renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ~1.5))` — on retina/4K, full DPR with `antialias: true` is ~4× the fragment work for marginal globe quality. A cap is a large, low-risk win.
- **Lens-flare early-out:** `flare.render()` already computes `hide` (sun behind camera or occluded by the planet) and per-element visibility; skip the second WebGL pass entirely when nothing is visible, instead of rendering an empty scene.
- **Allocation hygiene:** `surfaceFrame()` and `_updateEntry()` allocate several `THREE.Vector3` + a `Matrix4`/`Quaternion` per placeable per frame. Reuse scratch instances to cut GC pauses on token-dense scenes. This is a refinement, not a behavior change.

### D5: Own the long-press gesture and call `canvas.ping()` directly (instant, no cooldown)

The globe long-press is today detected by Foundry's `MouseInteractionManager` from the synthesized pointer events `input.js` forwards. That path causes both the ~½s still-hold detection lag and the multi-second post-ping cooldown (MIM's interaction state doesn't cleanly reset for synthesized events — the same limitation that blocks token HOVER). Decision: detect the long-press ourselves on the globe canvas and call `canvas.ping(origin, { style })` directly — the same semantic-forwarding move that made token clicks reliable (`token.control()` instead of synthesized clicks). A direct `canvas.ping()` has no self-throttle (it's what ping macros do) and still broadcasts to other clients and calls `controls.drawPing` locally — so the existing `overlays.js` ping-marker wrap renders it unchanged. Alt → alert style (same call); plain → default.

To keep MIM out of the ping path entirely, the empty-sphere **left** gesture is classified before anything is forwarded — a held press must never reach MIM as a held-down event, or MIM re-introduces its own long-press + cooldown. State machine for a left press that starts over the empty sphere (not over a token):

```
  down (over empty sphere)
    │  record {downPos, sceneXY, modifiers, t}; start hold timer (~350ms); forward NOTHING yet
    ├──> move > tolerance before timer  ──> DRAG: cancel timer; forward synthesized down (at downPos)
    │                                         then this move; subsequent moves live; up → forward up
    ├──> hold timer elapses (still down, not moved) ──> LONG-PRESS: canvas.ping(sceneXY, {style});
    │                                                    mark gesture pinged; up → suppress (no forward)
    └──> up before timer & not moved  ──> CLICK: run the existing empty-click actions (releaseAll,
                                            tile click/dblclick triggers) + forward synthesized down+up
```

So the only behavioral shift for existing paths is *timing*: the empty-sphere click's deselect / tile-trigger / synthesized-forward now fire on release (short click) or first-move (drag) rather than instantly on down — imperceptible for a click, and arguably more correct. The token path and the right-button (orbit / tile right-click) path are untouched.

Hold threshold (~350ms) is tunable and chosen for snappy-but-deliberate feel; the decisive win is removing the cooldown, so back-to-back pings are immediate. Alternatives considered: (a) keep MIM but suppress its cooldown — not reliably patchable (compiled private state); (b) a different gesture (e.g. double-click) to ping — breaks Foundry muscle memory; (c) lower MIM's `LONG_PRESS_DURATION_MS` — doesn't fix the synthesized-event reset/cooldown. Owning the gesture is the only path that fixes all three symptoms at once.

## Risks / Trade-offs

- **[`refreshToken` might be render-coupled in some Foundry build]** → Verify in the O1 spike before committing D3. If it is coupled, fall back to D4 + D1 only (keeps glides, smaller but real win) or to `ticker.maxFPS` throttling.
- **[Foundry-side visuals needing a live 2D paint stop showing]** (e.g. its drag ghost, weather, animated 2D effects) → Acceptable while the board is hidden; the globe is the view. The globe owns any preview it needs. Documented as a known limitation.
- **[A dirty source is missed → globe appears frozen during a real change]** → The camera funnels through `_apply()` and captures through `_captureOne()`, so the two high-frequency sources are centralized; "any active ping → dirty" is a deliberate safe superset. Risk is low and visually obvious if it occurs.
- **[Pixel-ratio cap softens globe edges on hi-DPI]** → Tunable constant; choose a cap that's visually indistinguishable in practice (~1.5) and leave it adjustable.
- **[Deferring the empty-sphere click forward to release/first-move regresses a flat-scene interaction]** → Left-drag forwarding (marquee select, etc.) is already best-effort under the MIM limitation (documented). The deferral starts the drag forward on first movement, preserving the common case; smoke-test empty-click deselect and tile click/dblclick to confirm no regression. The token and right-button paths are not touched.
- **[`canvas.ping()` signature / style key differs across Foundry builds]** → Confirm the `origin` shape and the modifier→style mapping against the installed v12/v13 during implementation; the call no-ops cleanly if a style is unknown (rendering is style-agnostic).

## Migration Plan

Pure internal rendering change; no data, flags, or APIs affected. Rollout is the normal feature-branch merge. Rollback = revert the branch. Deactivation must fully restore Foundry's render (force one render on restore) so toggling Planetside off leaves the flat canvas correct.

## Open Questions

- **O1 (spike, do first):** Confirm `refreshToken` fires during a token glide with Foundry's render call removed but ticker running, and identify the precise, reversible removal target for D3 in this Foundry version (v12 and v13).
- **O2:** Final pixel-ratio cap value — pick by eye on a hi-DPI display (start ~1.5).
- **O3:** Should `markDirty()` live on the controller or a tiny dedicated `RenderScheduler` object? Leaning controller-owned for now (one bit + one method); promote to its own object only if a second consumer needs it.
- **O4:** Long-press hold threshold (~350ms) — pick by feel. And confirm `canvas.ping()`'s `origin` shape + modifier→style mapping against the installed Foundry (v12/v13).
