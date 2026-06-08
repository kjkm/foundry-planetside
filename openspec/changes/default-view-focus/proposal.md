## Why

When Planetside activates, the globe always opens at a fixed orientation `(azimuth 0, elevation 0, radius 2.5)`, ignoring the scene's configured default view. Foundry scenes carry an initial view position (`scene.initial = { x, y, scale }`); the globe should open aimed at the corresponding sphere location and zoom, the same way the flat canvas opens at the default view.

Beyond this immediate feature, the user wants a foundation for **camera-control synchronization** — eventually mirroring Foundry's GM "pull"/ping system so a GM can auto-rotate every player's globe to a location. Default-view and ping-pan are the same primitive ("drive the globe camera to a scene location") with different triggers, so this change builds that primitive and uses default-view as its first consumer.

## What Changes

- Add a reusable **camera focus primitive** to `OrbitCamera`: `focus(target, { animate, duration })` that moves the camera to a target orientation, where the target derives from a scene coordinate (or lat/lon) + zoom. Animation is an **eased tween** on the ticker (shortest-path azimuth wrap), and it **cancels if the user starts orbiting**. Instant moves are `animate: false` (same path, zero duration).
- Add a pure converter **`sceneToCameraTarget(x, y, scale)`**: scene coordinate → `{ azimuth: lon, elevation: lat, radius }` via the Mercator inverse (`uvToLatLon`) — exploiting that the orbit camera's `(az, el)` parameterization is identical to the Mercator sphere-point parameterization, so `azimuth = lon`, `elevation = lat` — and a zoom heuristic mapping Foundry `scale` → orbit radius.
- **Default-view consumer**: on activation, read `scene.initial` and `focus` the camera (eased) on it. `x`/`y` null (no default set — the common case) falls back to the scene center; `scale` maps to radius.
- The focus primitive is **source-agnostic** so future triggers (GM ping/pull pan, recenter hotkey, token-follow) are drop-in callers — explicitly designed-for but out of scope here.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `globe-camera`: gains a focus capability (move/animate the camera to a target derived from a scene location + zoom) and opens at the scene's default view on activation instead of a fixed orientation.

## Impact

- **Code:** `scripts/camera.js` (`focus` + eased tween + cancel-on-drag), a `sceneToCameraTarget` converter (in `camera.js` or a small helper using `mercator`), `scripts/planetside.js` (call `focus` on activate from `scene.initial`). No canvas/capture changes.
- **Behavior:** the globe opens aimed at the scene's default view (eased); manual orbit is unchanged and interrupts an in-progress focus.
- **Forward-looking:** the `focus()` seam is what future camera-sync (GM ping-pan, mirroring Foundry's pull) calls — Foundry already broadcasts pings over its socket, so that future feature is a trigger wired to `focus()`, not new networking. Not built here.
- **Dependencies:** none new.
