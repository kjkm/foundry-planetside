## Context

Pings flow through a single capture point: `OverlayReanchor` wraps `ControlsLayer#drawPing` (catching every local and networked ping), calls the original through (flat-canvas ping untouched), and calls its own `spawnPing(sceneX, sceneY, options)`, which tracks `{ el, sceneX, sceneY, expiresAt }` and reanchors/expires each frame in `_updatePings()`. The memory note is explicit: do not add a second `drawPing` wrap (the path is fragile — `canvas.controls` rebuilds).

The minimap (`MinimapOverlay`) is a flat `%`-based panel in scene-UV space: the reticle sits at `(u,v) = latLonToUv(elevation, azimuth)`, and `clientToLatLon` already does the inverse for click-to-pull. A scene point maps to the same `(u,v)` basis via `u = (x − dims.sceneX)/sceneWidth`, `v = (y − dims.sceneY)/sceneHeight` (the first half of `overlays.sceneToScreen`).

## Goals / Non-Goals

**Goals:**
- A ping on the globe also shows as a transient marker on the minimap at the matching map position.
- Always visible — including pings on the hidden (far) hemisphere of the globe.
- Carry the ping's style (normal user-color vs alert red).
- Reuse the one existing ping capture point; no second `drawPing` wrap.

**Non-Goals:**
- No new networking (pings already broadcast through Foundry's `canvas.ping`).
- No persistent/pinned markers — they expire with the source ping.
- No change to globe ping behavior.
- No click interaction on ping markers (they're inert).

## Decisions

### D1: Fan out from `spawnPing` via an `onPing` callback — not a second `drawPing` wrap
Add an optional `onPing(sceneX, sceneY, options)` to `OverlayReanchor`, invoked inside `spawnPing` after the globe marker is created. The controller supplies it, forwarding to `minimap.spawnPing`.
- **Why:** Preserves the single-capture-point invariant (one wrap sees all pings). Mirrors the established controller-callback seam (`onGmPull`, `onPick`). The globe and minimap stay decoupled — neither knows about the other.
- **Alternatives considered:** (a) A second `drawPing` wrap on behalf of the minimap — rejected, explicitly fragile per the memory note. (b) Expose `_pings` and have the minimap diff it each frame — rejected, reintroduces per-frame work the `%`-anchor design avoids. (c) Extract a shared ping store both consumers subscribe to — cleaner in the abstract but an unjustified refactor of working ping code for a single new consumer.

### D2: Marker position is set once on spawn, in panel-relative `%`
`minimap.spawnPing` maps scene → `(u,v)` and creates a child positioned at `left: u·100%`, `top: v·100%`. No per-frame update.
- **Why:** The minimap is flat and doesn't track the camera, so the marker's map position never changes while it lives. As a `%`-anchored child of the container, it automatically follows panel moves (corner change) and resizes. This is strictly simpler than the globe path, which must reproject every frame.
- **Consequence (a feature):** far-hemisphere pings, hidden on the globe, are visible on the minimap — the panel never hides by camera facing.

### D3: Reuse the globe ping lifecycle and style, scaled down
The marker auto-removes after `CONFIG.Canvas.pings.duration` (same as globe pings) via a timer the overlay owns. Style mirrors `spawnPing`'s logic: `--ping-color` from the user color for a normal ping, the alert variant for `options.style === "alert"`. CSS gets a `.planetside-minimap-ping` class reusing the existing pulse keyframes at a smaller ring size.
- **Why:** Minimap and globe pings should appear and vanish together and read as the same event. The globe rings (~18px) are oversized against a ~280px panel, so a smaller variant; the animation itself is shared.

### D4: Markers are inert and self-managed
`pointer-events: none` on every marker; markers are children of the minimap container; pending expiry timers are tracked and cleared in `destroy()`.
- **Why:** They must not block the minimap's click-to-pull, and they must not outlive the overlay or leak timers on deactivation.

## Risks / Trade-offs

- **Timer leakage on deactivate** → track pending removal timers and clear them in `destroy()` (the container removal takes the DOM, but timers must be cancelled).
- **Marker legibility on a small/busy panel** → small pulse + drop-shadow (as the globe pings already use); transient, so no accumulation. Tunable.
- **Coupling creep** → keep `OverlayReanchor` ignorant of the minimap; it only fires a generic `onPing`. The controller owns the wiring.
- **Style drift between globe and minimap pings** → both derive color/alert from the same `options`; if `spawnPing`'s style logic changes, apply it in one shared spot or keep them trivially parallel.
