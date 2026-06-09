## Why

When orbiting the globe it is easy to lose track of *where* on the map you are looking — the 3D view shows only the near hemisphere with no global frame of reference. A flat minimap with a crosshair reticle gives every player an at-a-glance "you are here" against the whole map, reusing the camera↔lat/lon correspondence the module already maintains.

## What Changes

- Add an opt-in per-scene **minimap overlay**: a flat rectangle rendered over the globe view, with the same aspect ratio as the scene map, showing a stretched map image.
- Add a **crosshair reticle** on the minimap that tracks the live camera: a small center box marking the exact view-center, plus a full-width horizontal line and full-height vertical line crossing through it.
- The reticle position is derived from the existing orbit camera: `u = (azimuth+π)/2π`, `v = projection.latToV(elevation)` — longitude is always exact; latitude is exact when the image shares the globe's projection.
- The minimap image source is `flags.planetside.minimapImage`, **falling back to the scene background** when unset (the zero-config, always-exact case).
- Add scene-config controls: an **enable minimap** checkbox and a **minimap image** file-picker in the Planetside tab.
- Visible to **all users** (not GM-gated). Minimal config for v1; placement/size/opacity refinement is deferred.
- Click-to-pull is **not** implemented, but the overlay owns its own rect→`(u,v)` mapping so a future pointer handler can invert to lat/lon and call the existing pull path.

## Capabilities

### New Capabilities
- `globe-minimap`: A flat DOM/CSS minimap overlay shown while Planetside is active, displaying the (stretched-to-scene-aspect) map image with a live crosshair reticle tracking the orbit camera's view-center; enable/source driven by scene flags, removed on deactivation, hot-reloaded on flag change.

### Modified Capabilities
- `scene-config-ui`: Add a requirement for minimap controls (enable checkbox + image file-picker) in the Planetside tab, bound to `flags.planetside.*`.

## Impact

- New module `scripts/minimap.js` (`MINIMAP_DEFAULTS`, `readMinimapFlags`, `class MinimapOverlay`), modeled on `scripts/title.js`.
- `scripts/planetside.js`: instantiate/install/destroy the overlay; drive its reticle each frame from `orbit.azimuth`/`orbit.elevation`; add `refreshMinimap()`.
- `scripts/main.js`: spread `readMinimapFlags` into the scene-config template data and call `refreshMinimap()` from the `updateScene` hot-reload path (the file-picker is auto-wired by the existing `_wireFilePickers`).
- `templates/scene-config-tab.hbs`: add the enable checkbox + image file-picker fields.
- `styles/planetside.css`: minimap container + reticle styling.
- No new dependencies; pure DOM/CSS, reuses `projection.js` and `canvas.dimensions`.
