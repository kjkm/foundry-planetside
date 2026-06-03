## Context

Foundry VTT renders scenes via PIXI 7 to a single visible WebGL canvas. Walls, lighting, vision, tokens, templates, drawings, and weather all live in that 2D layer.

This change introduces a globe display alongside Foundry's normal 2D layer. The original ambition was to live-capture the PIXI canvas into a Three.js texture every frame so the globe view reflects all dynamic Foundry behavior. That capture pipeline was attempted, hit integration friction we couldn't resolve quickly (the PIXI stage transform manipulation needed to crop the capture to the scene rect was not honored at render time, producing a wrapped-padding-band visual instead of the scene content), and was stripped back. The current implementation loads the scene's background image directly via `THREE.TextureLoader` — the texture is static. Live capture remains the long-term direction but is deferred.

In place of dynamic capture, v0 went deep on the visual presentation: lit material, a sun light + sky sprite, a two-layer Fresnel atmosphere, a procedural starfield, and a screen-space lens flare. The result is a planet-in-space view of the map, even though that planet's "surface" is fixed at scene-load time.

## Goals / Non-Goals

**Goals:**
- A planetside-enabled scene shows the scene's background image projected onto a Mercator-cropped sphere, rendered via Three.js as an overlay canvas on top of Foundry's normal canvas region.
- Constrained orbit camera with world Y locked up, sphere center as look-at target.
- Cinematic space presentation: lit body, sun in sky, atmospheric halo, stars, lens flare, occluded lens flare when planet hides sun.
- Per-scene activation via a Foundry flag.
- Authors create scenes the same way they always have — a rectangular battlemap image.

**Non-Goals (v0):**
- Live capture of the running PIXI canvas (tokens, walls, lighting, vision, FX) onto the sphere. This is the obvious next milestone but is not in v0.
- 3D token meshes standing on the surface, day/night cycle animation, weather as 3D effects.
- Authoring tools, in-editor distortion preview, polar-cap art editors.
- Patching Foundry's wall/lighting/vision solvers for east-west wrap.
- Module-by-module DOM overlay compatibility beyond the Foundry-core set listed in the spec.
- Performance optimization beyond the straightforward implementation.

## Decisions

### Use Three.js for the 3D scene

Three.js, not staying inside PIXI. Lit material, custom shaders, sprites, and orthographic overlay rendering are all natural in Three.js and would be hand-rolled in PIXI.

### Three.js renderer in its own WebGL context

Separate WebGL context for the Three.js renderer. A shared context with PIXI is a known optimization for the future dynamic-capture pipeline but is not adopted in v0 (there is no per-frame texture round-trip in v0 anyway).

### Static texture load (deferred dynamic capture)

`canvas.scene.background.src` is loaded via `THREE.TextureLoader` and used directly as the body sphere's material map. The capture-PIXI-into-render-texture pipeline (`capture.js`, dirty hooks, `extract.pixels`) exists in the codebase but is not imported and not wired into the activation flow. It remains as a starting point when dynamic capture is taken up again.

### Projection: Mercator, cropped at ±85° latitude

Full-sphere Mercator. The rectangle is cropped at the geometric poles to avoid the projection's singularity. Body UVs are rewritten in `scene.js` to map Mercator V correctly across the body's geometric latitude range; U is the default sphere geometry U with `RepeatWrapping` on the texture so the east-west seam is visually continuous.

### Polar caps: average-of-perimeter, sampled once

When the background image finishes loading, it is drawn to an offscreen 2D canvas, the perimeter pixels of the image are averaged, and the resulting color is applied as a flat `MeshLambertMaterial` color to two cap spheres covering the polar regions. No per-scene authoring, no recompute (the texture doesn't change).

### Lit body and caps via MeshLambertMaterial + `useLegacyLights = true`

The body and caps use `MeshLambertMaterial` so the sun light produces a visible terminator. `WebGLRenderer.useLegacyLights = true` is set so directional light intensity 1.0 means "fully lit" rather than the physical-units default that requires intensity ≈ π for similar visual brightness. Simpler to tune.

### Sun: fixed direction, two roles

A constant world-space direction (`SUN_DIRECTION`) plays two roles:
1. Drives the planet's `THREE.DirectionalLight`, producing the terminator.
2. Anchors the in-sky `THREE.Sprite` (a procedural radial gradient drawn to a canvas, used as a `THREE.CanvasTexture` with additive blending).

Sun world position is `SUN_DIRECTION * SUN_DISTANCE`; sprite scales with size attenuation, so changing `SUN_DISTANCE` shrinks/grows the apparent sun.

### Two-shell atmosphere

Two BackSide-rendered shell spheres around the planet, each with a custom `ShaderMaterial`:
- The outer shell (radius 1.06, pale blue) gives the wider atmospheric halo extending into space.
- The inner shell (radius 1.04, white) gives a tight, very bright limb glow that reads as "hot" atmosphere closest to the surface.

The shader computes a rim brightness from `pow(max(0, -dot(N, V)), power)` (peak at the planet's limb, fading to zero at the shell silhouette), modulated by a sun-angle factor `smoothstep(dayLo, dayHi, dot(N, sunDir))` so the night side has no atmospheric glow. Additive blending, no depth write.

The inner shell's intensity is intentionally far above 1.0 so additive blending clips to saturated white at the limb.

### Lens flare via orthographic overlay scene

A separate `THREE.Scene` + `THREE.OrthographicCamera` is rendered after the main scene with `renderer.autoClear = false`. Multiple `THREE.Sprite` elements, each with a procedurally generated radial-gradient texture in a chosen color, are positioned each frame along the screen-space line from the sun's projected NDC through the screen center. Distance parameter per element controls position on that line.

Occlusion: raycast (analytical sphere intersection) from camera through sun world position; if it intersects the planet sphere between camera and sun, hide all flare elements that frame. Edge fade: as the sun's NDC approaches the screen boundary, fade all elements out.

### Starfield as a single Points cloud

A `THREE.Points` of 5000 vertices placed uniformly at random on a sphere of radius 150 (well outside the sun at distance 160 — though stars at sun direction can be occluded by the sun sprite). `sizeAttenuation: false` so points are constant pixel size. Per-vertex colors give:
- ~91% white with `pow(random, 3)` brightness skew so most stars are dim and few are bright.
- ~6% bluish, ~2% warm-yellow, ~1% rare dim red-orange "dwarf" stars (explicitly capped at low brightness).

### Camera: constrained orbit

(azimuth, elevation, radius) around the sphere center. World Y up, look-at origin. Elevation clamped strictly short of ±90° to avoid the up-vector singularity. Right-click drag for orbit, scroll wheel for zoom.

### Input forwarding: present but inert in v0

`InputForwarder` intercepts pointer events on the Three.js canvas, raycasts the sphere, inverse-Mercator-projects to 2D scene coords (with sceneRect offset), and dispatches synthesized `PIXI.FederatedPointerEvent`s on `canvas.app.renderer.events.rootBoundary`. Foundry's 2D scene receives the events normally — but since the sphere's texture is the static background image, the player can't see any visual response on the globe. Right-clicks are reserved for the orbit camera and not forwarded.

### Overlay reanchoring: present but inert in v0

`OverlayReanchor` repositions a small set of Foundry-core DOM overlays each frame (token HUD, chat bubbles, tooltips). It forward-projects the overlay's 2D anchor through the Mercator UV mapping, sphere geometry, and camera projection to a screen position, hiding overlays whose anchor is on the occluded hemisphere. Same caveat as input forwarding: it works against the live 2D scene's coordinates, but since the visible sphere doesn't reflect token positions, the visual coherence the system promises is currently abstract.

## Risks / Trade-offs

- **Static texture is the largest deviation from the original vision.** Anyone reading the original proposal would expect a dynamic sphere; what ships shows a still image. The README and this design are honest about it; the project memory is honest about it; the input/overlay subsystems are present so dynamic capture can later light them up without further architectural work. → Acknowledged; addressed by the deferred-work note in the proposal and README.
- **Module ecosystem compatibility is untested.** Foundry-core overlays are the only ones reanchored. Modules with custom DOM overlays will appear in their original screen positions regardless of where their target lands on the sphere.
- **East-west seam discontinuity in 2D logic** would matter once dynamic capture is added. Currently it does not, because nothing on the sphere reflects the 2D layer's solvers.
- **Performance is fine** at the current visual budget (two shell shaders, 5000 points, ~7 flare sprites). No optimization has been done because none has been needed.

## Open Questions

- The path to dynamic capture: the next milestone. The first attempt mutated `canvas.stage.position` to crop the capture; that didn't take effect at render time. Alternatives to try: capture the full canvas and shift UVs on the sphere body (avoids stage mutation), or use the PIXI render `transform` option to apply a translation matrix at render time.
- Whether the synthesized PIXI events that `InputForwarder` dispatches today fully exercise downstream module hooks (drag operations, hover state, modifier keys). Not yet observable until dynamic capture is in.
- Whether the inner atmosphere shell's saturated white limb should be moved into a screen-space post effect (bloom) once that pipeline exists, or kept as a Fresnel shell.
