## Context

The minimap (`scripts/minimap.js`, `MinimapOverlay`) already renders a flat panel with a crosshair reticle tracking the orbit camera, and it already exposes `clientToLatLon(clientX, clientY)` — a seam left in place during `add-minimap` specifically for this feature, returning `{lat, lon}` (or `null` if the point is outside the panel) via `projection.uvToLatLon`. The panel is currently `pointer-events: none`.

The controller (`scripts/planetside.js`) owns the camera and already has the eased-move primitive: `OrbitCamera.focus({ azimuth, elevation, radius }, { animate, duration, elevEasePower })`. The GM pull (`pullTo` / `firePull`) wraps `focus` with `PULL_DURATION_MS` and `PULL_ELEV_EASE_POWER`. The reticle is redrawn from the live camera every frame in `_frame()`.

This change wires the seam to the primitive. It is deliberately local-only: party-wide refocus remains the GM's `firePull` (Shift+long-press on the globe, GM-gated in `input.js`).

## Goals / Non-Goals

**Goals:**
- Clicking anywhere on the minimap eases the local camera so its view-center moves to the clicked map position.
- Preserve the viewer's current zoom (rotate only).
- Reuse the existing eased-focus feel so it matches the GM pull's motion.
- Available to all users with no networking.

**Non-Goals:**
- Any networked / party-wide effect (that stays `firePull`). No sockets, no pings, no GM gating.
- Drag-to-scrub / continuous panning (deferred).
- Changing globe input (`input.js`) — the overlay owns its own click.

## Decisions

### D1: The overlay owns its click and emits a semantic `onPick(lat, lon)` callback
Add a `click` listener on the container that runs `clientToLatLon(e.clientX, e.clientY)` and, on a non-null result, invokes an `onPick(lat, lon)` callback supplied by the controller. The controller wires `onPick` to the camera move.
- **Why:** Mirrors how the globe input is wired (`InputForwarder` takes an `onGmPull` callback the controller owns). Keeps DOM-event handling in the overlay and camera control in the controller, with a clean semantic boundary. No coupling of the overlay to `OrbitCamera`.
- **Alternative considered:** Route minimap clicks through `InputForwarder`. Rejected — that forwarder is bound to the globe canvas; the minimap is a separate element and should handle its own events.

### D2: Use a `click` event, not a pointer gesture machine
A plain `click` recenters on release and naturally ignores drags (a press that moves off the panel won't fire), so there's no need for the press/drag/long-press classification `input.js` does.
- **Why:** Recenter has no drag semantics in v1. `click` is the simplest correct trigger and avoids accidental fires.
- **Alternative considered:** `pointerdown`. Rejected — fires mid-drag and on press-and-hold; `click` matches "tap a spot to go there".

### D3: Map straight to camera orientation via `focus`, preserving zoom
`onPick(lat, lon)` → `orbit.focus({ azimuth: lon, elevation: lat }, { animate: true, duration: PULL_DURATION_MS, elevEasePower: PULL_ELEV_EASE_POWER })`. Radius is omitted so `focus` holds the current zoom.
- **Why:** `azimuth = lon` and `elevation = lat` is the same correspondence the reticle uses, so the camera lands exactly under where the user clicked — the inverse is exact for any projection. Reusing `PULL_*` constants makes the motion feel identical to the GM pull. Omitting radius matches `pullTo`'s rotate-only behavior. `focus` already shortest-paths azimuth across the ±180° seam and clamps elevation, so no edge cases.
- **Alternative considered:** Convert to scene `(x,y)` and call `pullTo`. Rejected — an unnecessary round-trip through scene coordinates; `focus` from lat/lon is direct, and we explicitly do not want `pullTo`'s sibling `firePull` networking here.

### D4: Make only the container interactive; reticle children stay inert
Set `pointer-events: auto` + `cursor: pointer` on the container; leave the box/lines `pointer-events: none`.
- **Why:** A click anywhere in the panel should pick a location; the reticle marks shouldn't intercept or change that.

## Risks / Trade-offs

- **Panel captures pointer events in its corner** → a globe orbit-drag that *starts* over the minimap will not orbit. Mitigation: the panel is a small corner element; accepted and documented. (CSS can't pass only the right-button through, and re-dispatching isn't worth it for v1.)
- **Free animation feedback** → because the reticle is redrawn from the camera each frame, the eased `focus` makes the crosshair glide to the clicked point with no extra code — a benefit, noted so it isn't re-implemented.
- **Listener lifecycle** → the `click` listener must be removed in `destroy()` so a deactivated/rebuilt overlay leaves nothing bound (the element is removed anyway, but clear the reference for symmetry with the existing lifecycle).
