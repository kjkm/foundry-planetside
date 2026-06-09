## 1. Minimap overlay module

- [x] 1.1 Create `scripts/minimap.js` with `MINIMAP_DEFAULTS` (`minimapEnabled: false`, `minimapImage: ""`) and `readMinimapFlags(scene)`, mirroring `title.js`.
- [x] 1.2 Implement `class MinimapOverlay` with `install()` building a fixed-position container (`pointer-events: none`) plus three children: center box, full-width horizontal line, full-height vertical line.
- [x] 1.3 Implement `update({ enabled, imageSrc, azimuth, elevation })`: toggle visibility, set the container aspect ratio from `canvas.dimensions.sceneWidth:sceneHeight`, set the background image (with scene-background fallback), and position the reticle via `projection.latLonToUv(elevation, azimuth)` (`u → left`, `v → top`).
- [x] 1.4 Implement `destroy()` removing all elements and listeners (resize handler if used), matching the `TitleOverlay` lifecycle.
- [x] 1.5 Retain the container rect + expose/keep reachable the inverse `(u,v) → (lat,lon)` via `projection.uvToLatLon`, leaving a seam for future click-to-pull (no input wired).

## 2. Controller integration

- [x] 2.1 In `planetside.js#activate()`, instantiate `MinimapOverlay` (pass `projection`, `hostElement`), `install()` it, and apply initial flags via `readMinimapFlags(canvas.scene)`.
- [x] 2.2 In `planetside.js#_frame()`, call `minimap.update(...)` each frame with `orbit.azimuth`/`orbit.elevation` and the current enabled/image flags (resolving the scene-background fallback).
- [x] 2.3 Add `refreshMinimap()` to re-read flags and apply enabled/image state live.
- [x] 2.4 In `planetside.js#deactivate()`, `destroy()` the overlay and null the reference.

## 3. Scene-config controls

- [x] 3.1 Add the Enable-minimap checkbox (`flags.planetside.minimapEnabled`) and Minimap-image file-picker (`flags.planetside.minimapImage`) to `templates/scene-config-tab.hbs` (file-picker markup matching the existing heightmap picker so `_wireFilePickers` binds it).
- [x] 3.2 In `main.js#renderSceneConfig`, spread `...readMinimapFlags(scene)` into the template render data (import from `minimap.js`).
- [x] 3.3 In `main.js#updateScene`, call `controller.refreshMinimap()` alongside the other live-apply calls.

## 4. Configurable corner placement

- [x] 4a.1 In `minimap.js`, add `MINIMAP_CORNER_OPTIONS` (tl/tr/bl/br labels) and `minimapCorner` to `MINIMAP_DEFAULTS` (default `br`); include it in `readMinimapFlags`.
- [x] 4a.2 Make `_applyLayout(corner)` compute all four board-rect insets and anchor by the selected corner (matching `title.js#cornerStyleFromBoard`); thread `corner` through `update()` and the change-detection key.
- [x] 4a.3 Add a Minimap-corner `<select>` to `templates/scene-config-tab.hbs` and pass `MINIMAP_CORNER_OPTIONS` into the `renderSceneConfig` template data in `main.js`.
- [x] 4a.4 Add a per-corner `CORNER_EXTRA_INSET` (like `title.js`) in `_applyLayout` so each corner clears Foundry's core UI (nav, left controls, players list, hotbar).

## 5. Styling and verification

- [x] 5.1 Add minimap container + reticle styles to `styles/planetside.css` (rectangle frame, box, crosshair lines; readable over varied maps).
- [x] 5.2 Verify in Foundry: enable the minimap, confirm it shows the image stretched to scene aspect, the reticle tracks orbit/zoom, the scene-background fallback works when the image is empty, and the minimap is visible to a non-GM client.
- [x] 5.3 Verify hot-reload: toggling the enable flag and changing the image in scene config update the live minimap without a reload, and the overlay is removed on deactivation.
- [x] 5.4 Verify the corner dropdown moves the live minimap to each of the four corners without a reload.
