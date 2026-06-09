## 1. Overlay click handling

- [x] 1.1 In `minimap.js#install()`, make the container interactive: `pointer-events: auto` and `cursor: pointer` (leave the reticle children `pointer-events: none`).
- [x] 1.2 Accept an `onPick` callback in the `MinimapOverlay` constructor and store it.
- [x] 1.3 Add a `click` listener on the container that runs `clientToLatLon(e.clientX, e.clientY)` and, on a non-null `{lat, lon}`, invokes `onPick(lat, lon)`.
- [x] 1.4 Remove the `click` listener and clear the callback reference in `destroy()`.

## 2. Controller wiring

- [x] 2.1 In `planetside.js#activate()`, pass `onPick: (lat, lon) => this.orbit.focus({ azimuth: lon, elevation: lat }, { animate: true, duration: PULL_DURATION_MS, elevEasePower: PULL_ELEV_EASE_POWER })` when constructing `MinimapOverlay` (rotate only — omit `radius` to preserve zoom).

## 3. Styling and verification

- [x] 3.1 Add the `cursor: pointer` affordance for the minimap panel in `styles/planetside.css` (if not set inline). — set inline in `install()`.
- [x] 3.2 Verify in Foundry: clicking various points on the minimap eases the camera so the view-center (and the reticle) lands on the clicked spot, across projections.
- [x] 3.3 Verify zoom is preserved on click, and that the interaction is purely local (no ping, no other client's camera moves) for both a GM and a non-GM client.
- [x] 3.4 Verify the longitude seam and poles: clicking near the left/right edges and top/bottom eases correctly (shortest-path azimuth, clamped elevation) with no errors.
