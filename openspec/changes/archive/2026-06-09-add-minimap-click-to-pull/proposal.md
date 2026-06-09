## Why

The minimap shows where the camera is looking but can't yet change it — to reach a spot on the map you still have to orbit the globe by hand. Letting a user click the minimap to send their own view there turns it from a passive indicator into a navigation control, complementing the reticle (it shows *where you are*; the click says *go there*).

## What Changes

- Make the minimap panel clickable: a click anywhere on it eases the **local** camera so its view-center moves to the clicked map position.
- The click maps `(clientX, clientY) → (u, v) → lat/lon` via the overlay's existing `clientToLatLon` seam, then rotates the camera with the existing eased `OrbitCamera.focus` (reusing the GM pull's duration/easing feel).
- **Rotate only — preserve the viewer's current zoom** (matches `pullTo`).
- **Local only, all users.** No networking, no pings, no role-gating. Party-wide refocus stays the GM's existing `firePull` (Shift+long-press on the globe) — the minimap is explicitly *not* a party-wide camera tool.
- The minimap container becomes interactive (`pointer-events: auto`, `cursor: pointer`); the reticle children stay non-interactive.
- Deferred: drag-to-scrub the reticle for continuous panning.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `globe-minimap`: Add a requirement that clicking the minimap eases the local camera to the clicked map position (local-only, zoom preserved).

## Impact

- `scripts/minimap.js`: enable pointer events on the container, add a `click` listener that runs `clientToLatLon` and invokes a new `onPick(lat, lon)` callback; minor `destroy()` cleanup for the listener.
- `scripts/planetside.js`: pass an `onPick` callback when constructing `MinimapOverlay` in `activate()`, wired to `orbit.focus({ azimuth: lon, elevation: lat }, { animate, duration: PULL_DURATION_MS, elevEasePower: PULL_ELEV_EASE_POWER })`.
- `styles/planetside.css`: `cursor: pointer` affordance on the panel.
- No `input.js` change (the overlay owns its own click); no new dependencies; no networking.
- Trade-off: the panel now captures pointer events in its corner, so a globe orbit-drag that *starts* over the minimap will not orbit.
