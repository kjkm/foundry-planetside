## Why

Foundry VTT scenes are flat rectangular battlemaps, which limits the visual narrative for campaigns that take place on or around a planetary body (space-faring, planetary survey, world-spanning travel). This change introduces a 3D globe view of the scene's background image, presented in space with directional lighting, a layered atmosphere, a starfield, and a lens flare, so the scene reads as a planet seen from orbit rather than a flat tile.

This is v0. The 2D battlemap layer continues to run inside Foundry, but the globe view samples only the scene's static background image — not the live PIXI canvas. Live capture of tokens, walls, lighting, vision, FX, and module overlays into the globe view is deferred. The infrastructure for forwarding input from the globe back into the 2D scene, and for re-anchoring DOM overlays to projected sphere positions, is wired up but produces no visible feedback on the sphere yet because the texture is static.

## What Changes

- Add a new Foundry VTT module (`planetside`) targeting Foundry v12.343.
- Per-scene activation via a Foundry flag (`game.modules.get("planetside").api.enableScene()`).
- Load the active scene's background image (`canvas.scene.background.src`) directly as a Three.js texture. Map it onto a sphere via Mercator UVs, cropped at ±85° latitude.
- Auto-fill the polar caps with the average color of the loaded image's perimeter, sampled once at load time.
- Display the globe via a Three.js scene mounted as an overlay canvas that replaces the visible PIXI canvas while the module is active.
- Constrained orbit camera around the sphere center: world Y always up, always facing the center, free azimuth, elevation clamped short of ±90°, mouse-wheel zoom.
- Cinematic space presentation:
  - **Directional sun light** + low ambient light, illuminating the sphere body (lit material).
  - **Sun sprite** in the sky at a fixed world direction, drawn as a procedural radial-gradient flare.
  - **Two-shell atmosphere** with custom Fresnel shaders: an outer pale-blue halo and an inner bright-white limb glow, both modulated by sun direction so the dark side of the planet shows no atmospheric glow.
  - **Lens flare**: a row of colored sprite elements drawn through an overlay orthographic camera, positioned along the screen-space line from the sun to the opposite side of the frame. Occluded when the planet passes between camera and sun.
  - **Procedural starfield**: 5000 points on a large sphere, with varied brightness, occasional bluish/yellowish tints, and a rare population of dim red-orange dwarfs.
- **Input forwarding** (wired, value pending dynamic capture): raycast sphere clicks, inverse-Mercator-project to 2D scene coordinates, dispatch synthesized `PIXI.FederatedPointerEvent`s on the offscreen PIXI stage. Events that miss the sphere are not forwarded.
- **DOM overlay reanchoring** (wired, value pending dynamic capture): each frame, reproject the screen position of a small set of Foundry-core DOM overlays (token HUD, chat bubbles, tooltips) so they appear at the sphere-projected location of their underlying 2D scene anchor. Hide them when their anchor is on the occluded hemisphere.

## Capabilities

### New Capabilities
- `globe-renderer`: Load the active scene's background image and project it onto a Mercator-cropped sphere via Three.js. Mounts a Three.js overlay canvas in place of the visible PIXI canvas while active.
- `polar-caps`: Fill the unaddressable polar regions of the sphere with the average color of the loaded image's perimeter.
- `globe-camera`: Constrained orbit camera around the sphere with always-upright orientation and always-facing-center.
- `globe-input`: Forward pointer input on the sphere back to the 2D scene by inverting the Mercator projection and synthesizing PIXI pointer events.
- `overlay-reanchoring`: Reposition Foundry-core DOM overlays each frame to track their underlying 2D scene anchors as projected onto the sphere.
- `space-lighting`: Light the sphere body with an ambient term plus a directional sun light. The body uses a lit material so it darkens on the side facing away from the sun.
- `sun-sprite`: Draw a procedural radial-gradient flare in the sky at the fixed sun direction.
- `atmosphere`: Render two BackSide-rendered shell spheres around the planet with custom Fresnel shaders; each shell's brightness fades smoothly between day and night sides based on sun direction.
- `lens-flare`: Render a row of colored flare sprites in screen space, anchored on the line from the sun's screen position through the screen center, with occlusion when the planet is between the camera and the sun.
- `starfield`: Render a procedurally generated point cloud as a starfield background, with per-star brightness and color tint variation.

### Modified Capabilities
<!-- No existing specs to modify; this is a new module. -->

## Impact

- New module `planetside` for Foundry v12.343. Dependencies: Three.js 0.160 (vendored), PIXI 7 (already bundled by Foundry).
- While planetside is active on a scene, the visible PIXI canvas (`#board`) is visually hidden via CSS and the Three.js canvas is positioned in its place. Foundry's PIXI scene continues to run underneath.
- Dynamic capture of the live PIXI canvas onto the sphere is **deferred**. The infrastructure for input forwarding and overlay reanchoring is in place, but neither produces user-visible feedback on the sphere until dynamic capture lands.
- No changes to Foundry's wall, lighting, vision, or scene data models. No changes to scene authoring affordances.
