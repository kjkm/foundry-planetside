## Context

Planetside renders a Foundry scene as a 3D globe. The orbit camera (`scripts/camera.js`) is parameterized by `azimuth`/`elevation`, and the module already treats those as the longitude/latitude of the view-center — `planetside.js:sceneToCameraTarget` sets `azimuth = lon, elevation = lat`, and `projection.js` owns `latLonToUv` / `latToV`. There is an established pattern for a flag-driven DOM overlay (`scripts/title.js` → `TitleOverlay`): a fixed-position container the controller installs in `activate()`, updates from scene flags, and removes in `deactivate()`, with hot-reload via the `updateScene` hook in `main.js`. Scene-config fields live in `templates/scene-config-tab.hbs`, are populated by `read*Flags` spreads in the `renderSceneConfig` hook, and file-pickers are auto-wired by `_wireFilePickers`.

The minimap reuses all of this. The only genuinely new behavior is reading the live camera each frame and positioning three DOM elements.

## Goals / Non-Goals

**Goals:**
- A flat minimap overlay that shows the map image stretched to the scene's aspect ratio.
- A crosshair reticle (center box + full-span horizontal/vertical lines) that tracks the camera view-center live.
- Opt-in per scene; visible to all users; minimal config (enable + image).
- Exact longitude tracking always; exact latitude when the image shares the globe's projection (guaranteed when falling back to the scene background).
- Architecture that leaves a clean seam for future click-to-pull.

**Non-Goals:**
- Click-to-pull interaction (deferred; only the rect→`(u,v)` inverse is left reachable).
- A footprint/extent box that scales with zoom (the visible region of a sphere under perspective is a curved cap, not a UV rectangle — out of scope).
- GM-only gating, configurable placement/size/opacity, projection reprojection of a mismatched custom image. These are deferred refinements.

## Decisions

### D1: Pure DOM/CSS overlay modeled on `TitleOverlay`, not a WebGL/canvas layer
A positioned `<div>` container with the image as `background-size: 100% 100%` (this *is* the "stretch/compress to fit"), and three absolutely-positioned children (box, h-line, v-line). Repositioning the reticle is `style.left`/`style.top` writes — cheap enough to do every frame.
- **Why:** Mirrors the proven `title.js` lifecycle (install/update/destroy, controller-owned, hot-reloaded). No renderer state, no disposal hazards, no second WebGL context.
- **Alternative considered:** Draw the minimap into the Three.js scene or a 2D canvas. Rejected — heavier, no benefit for a flat rectangle + 3 lines.

### D2: Reticle position from the existing camera↔lat/lon correspondence
Each frame, read `orbit.azimuth`/`orbit.elevation` and compute `{u, v} = projection.latLonToUv(elevation, azimuth)`. Place: vertical line at `left: u*100%` (full height), horizontal line at `top: v*100%` (full width), box centered at `(u*100%, v*100%)`.
- **Why:** This is the same mapping `sceneToCameraTarget`, pings, and overlays already use, so the reticle agrees with the rest of the module by construction. Longitude (`u`) is linear and always exact.
- **Alternative considered:** Recompute from the camera world-matrix. Rejected — `orbit.azimuth/elevation` already *are* the answer; no need to re-derive.

### D3: Image source is `minimapImage`, falling back to the scene background
When `flags.planetside.minimapImage` is empty, use `canvas.scene.background.src` (the same texture the globe samples).
- **Why:** The fallback is the zero-config, always-exact case — both globe and minimap derive latitude from the same `projection.latToV`, so the reticle is pixel-accurate for any projection. A custom image is the explicit override for decorative/labeled maps.
- **Trade-off:** A custom image in a different projection than the globe drifts in latitude (longitude still exact). Acceptable for v1; documented, not corrected.

### D4: Box aspect ratio locked to the scene, driven each frame from the controller
The container's width:height is set from `canvas.dimensions.sceneWidth:sceneHeight` so `(u,v)` maps linearly into it. The controller calls `minimap.update(azimuth, elevation)` from `_frame()`.
- **Why:** Linear `(u,v)`→pixel mapping requires the box to carry the scene aspect; sizing from `canvas.dimensions` keeps it correct across scenes. Driving from `_frame()` matches how `overlays.update()` already runs each tick.
- **Alternative considered:** Give the overlay a direct reference to the `OrbitCamera`. Rejected for v1 in favor of passing `(az, el)` — looser coupling, and the controller already orchestrates per-frame updates.

### D5: Leave a click-to-pull seam without building it
The overlay exposes (or internally retains) its rect and the inverse `(u,v) → (lat,lon)` via `projection.uvToLatLon`, so a later pointer handler can map a click to a scene coordinate and call the existing `controller.pullTo()`.
- **Why:** The user asked to keep the door open. No input is wired in v1; we just avoid baking in assumptions that would block it.

## Risks / Trade-offs

- **Latitude drift with a mismatched custom image** → Default to the scene background (exact); document that custom art should match the globe's projection.
- **Minimap occludes part of the globe view** → Small, corner-anchored, `pointer-events: none` so it never steals input; size/placement refinement is a deferred follow-up.
- **Per-frame DOM writes** → Three `style` writes per frame is negligible; the camera only moves on dirty frames anyway, and the existing `overlays.update()` already runs every tick.
- **Longitude seam at ±180°** → The vertical line is a single column at `u`; it simply wraps with `u`. No special-casing needed for a point/line reticle (a footprint box would split here — another reason it's out of scope).
