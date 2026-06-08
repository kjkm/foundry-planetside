## Context

`input.js` already forwards globe left-click / double-left-click to MATT via `_tilesAtScenePoint` → `_tileHasTrigger(tile, method)` → `_fireTileTrigger(tile, x, y, method)` with `_isSphereDoubleClick` for the double detection. This change adds the right-button equivalents.

The complication is the **camera orbit**: `OrbitCamera` starts a drag on right pointer-down (button 2) and the forwarder's `_onPointer` early-returns while `orbit.isDragging()`. Token right-click is already special-cased on pointer-down (opens the HUD, `stopImmediatePropagation` to preempt orbit). Tiles are different: we can't tell at down-time whether a right gesture is a click (fire trigger) or a drag (orbit), so we decide on **pointer-up** by movement.

## Goals / Non-Goals

**Goals:**
- A globe right-click over a `rightclick`-trigger tile fires its MATT actions; a double-right-click fires the double-right-click trigger.
- Right-drag still orbits the camera, unchanged; right-click on a token still opens the HUD.
- Imageless trigger regions fire (scene-coordinate hit-test, as for left-click).

**Non-Goals:**
- General right-click pass-through to the flat scene's MIM handlers (synthesized events don't drive MIM).
- Token right-button behavior changes (HUD stays).
- Enter/hover/other trigger methods; rotated-tile hit-test; rendering changes.

## Decisions

### Discriminate right-click from right-drag on pointer-up by movement

Track the right pointer-down `{ clientX, clientY, time }`. On right pointer-up, if the cursor moved less than a small threshold (~5 px) from the down point, treat it as a **right-click**; otherwise it was a drag (orbit) and we do nothing extra. A no-movement right-click already produces no orbit change, so orbit and trigger coexist without suppressing either.

- **Alternative — preempt orbit on right-down when over a trigger tile** (like the token HUD): rejected; it would require raycasting at down-time and would block right-drag orbit that happens to start over a tile.

### Handle right-up outside the `orbit.isDragging()` guard

The forwarder is installed before the orbit, so on right pointer-up the forwarder runs while `orbit.isDragging()` is still true (the orbit clears it in its own up handler, which runs after). The current `_onPointer` early-returns in that state. Right-click tile handling must therefore run in a path that is NOT gated by `orbit.isDragging()` — e.g. a dedicated check at the top of `_onPointer` for `button === 2 && type === "pointerup"`, using the tracked down position to compute movement, then the existing sphere raycast + inverse-Mercator + tile hit-test.

### Reuse the existing tile machinery; add right-button methods

Reuse `_tilesAtScenePoint`, `_tileHasTrigger(tile, method)`, `_fireTileTrigger(tile, x, y, method)`. Add right-button double detection mirroring `_isSphereDoubleClick` (separate timestamp/point state for the right button). On a right-click fire the `rightclick` method; on a detected double-right-click also fire the double-right-click method.

### Confirm MATT's right-button method strings in implementation

`'click'`/`'dblclick'` were confirmed empirically. The right-button equivalents must be confirmed the same way against the installed MATT (inspect a right-click-trigger tile's `flags["monks-active-tiles"].trigger` and MATT's config dropdown). Likely `'rightclick'`; the double-right value (if MATT supports it at all) may be `'dblrightclick'` or similar — the gate fires whatever string the tile is configured with, so the code should pass the confirmed method string(s).

## Risks / Trade-offs

- **[Right-click vs right-drag threshold]** → Too small a threshold makes triggers hard to fire (tiny drift cancels them); too large lets a small orbit-nudge fire a trigger. ~5 px client-space is a reasonable start; tune in smoke test.
- **[Orbit jitter on a "click"]** → A right-click with zero movement produces no orbit change; acceptable. If even a click visibly nudges the camera, we can snapshot/restore orbit state on a recognized click (deferred unless observed).
- **[MATT may not have a double-right-click method]** → If MATT exposes no such trigger, scope reduces to single right-click; the double path simply never matches a configured tile. Confirm during impl.
- **[Right pointer-up tracking and pointer capture]** → The orbit uses `setPointerCapture` on right-down; ensure the forwarder still receives the right pointer-up (it listens on the same element; capture keeps events on that element, so it should). Verify in smoke test.

## Open Questions

- Exact MATT method strings for right-click / double-right-click (confirm in impl).
- Movement threshold value (start ~5 px; tune).
- Whether to also snapshot/restore the orbit on a recognized right-click to guarantee zero camera motion (likely unnecessary).
