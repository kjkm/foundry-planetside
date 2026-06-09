## Why

A flat globe reads as a painted ball. An optional per-scene **heightmap PNG** lets the map author give the world real relief — mountains and valleys that catch the sun and break the silhouette — turning the battlemap into terrain. We do it **properly (tier 3)**: bake the height into the body geometry on the CPU so the displaced surface *is* the real surface — input, tokens, tiles, and pings all stay consistent with what's drawn, rather than a GPU-shader bulge that desyncs from raycasts.

The heightmap is **opt-in and explicit**: if a scene provides a heightmap PNG, the globe displaces; if not, it stays exactly flat (no derivation from the map's luminance, no guessing).

## What Changes

- **Heightmap PNG per scene** (`flags.planetside.heightmap`, a FilePicker path). Absent → today's flat sphere, unchanged. Present → terrain.
- **CPU-baked radial displacement.** At load, the heightmap is read back to a pixel buffer and each body vertex is offset **radially** by its sampled height × a displacement scale; vertex normals are then **recomputed** so the new surface shades correctly. Because the displaced mesh is the real geometry, the input raycast hits the visible surface and the round-trip stays exact.
- **Higher tessellation when a heightmap is active** so displaced landforms aren't faceted (flat scenes keep the current low-res sphere).
- **Derived normal map for fine relief.** A normal map is computed (Sobel/gradient) from the heightmap at load and applied to the body material, adding per-pixel shading detail the vertex resolution can't (Lambert already supports `normalMap`).
- **Surface-anchored content rests on the terrain.** A shared elevation field (`elevationAt`) raises tokens, tiles, pings, and the reanchored DOM overlays to the terrain height at their location, so nothing floats over valleys or sinks into peaks. Tokens/tiles (flat meshes) are lifted to the **max elevation under their footprint** so they rest clear of terrain they cover without clipping. Flat scene → elevation 0 → no change.
- **Polar caps continue the terrain.** When caps are present (Mercator, or span < 90°), each cap is displaced so its rim matches the body's perimeter heights and interpolates to a single pole height — no cliff at the boundary. The body's edge keeps its true heights for the cap to meet; pole-spike damping applies only on a capless (full-sphere) globe. Per-longitude rim detail fades out toward the pole (smooth dome, no pucker).
- **Polar caps continue the map's colours.** Each cap is also vertex-coloured from the map's edge colours per longitude, fading to the perimeter-average toward the centre (sRGB→linear so it matches the body) — the cap blends into the map at the rim instead of a flat gray ring. Applies whenever the image is loaded, independent of the heightmap.
- **Rebuild on change.** Heightmap / displacement-scale / relief-strength changes re-bake the body (reusing the projection rebuild path); changing the projection also re-bakes (UVs drive the sampling).
- **Scene-config controls:** heightmap file picker, displacement scale, relief strength.

## Capabilities

### New Capabilities

- `globe-terrain`: an optional heightmap displaces the globe body (CPU-baked radial offset + recomputed normals), a derived normal map adds fine relief shading, and a shared elevation field keeps surface-anchored content (placeables, pings, overlays) and input raycasting consistent with the displaced surface. Flat fallback when no heightmap is set.

### Modified Capabilities

- `scene-config-ui`: the Planetside tab gains heightmap (file picker), displacement-scale, and relief-strength controls bound to `flags.planetside.*`.
- `polar-caps`: when terrain is active, the caps are displaced to interpolate the body's perimeter heights to a single pole height (continuing the terrain), instead of staying flat.

## Impact

- **Code:** new `scripts/heightfield.js` (load + pixel buffer + `elevationAt(u,v)` + Sobel normal-map derivation), shared like `Projection`; `scripts/scene.js` (bake displacement into the body geometry, recompute normals, apply the derived `normalMap`, higher tessellation when active, re-bake in `rebuildBody`); `scripts/placeables.js` (add elevation to the radial position); `scripts/overlays.js` (`sceneToScreen` projects at the terrain radius); `scripts/planetside.js` (own the heightfield, wire it to scene/placeables/overlays, rebuild on flag change); the scene-config tab + flags; `README.md`.
- **Input:** no change needed — the raycast already hits `this.body`, which is now the baked surface, and token meshes are raised onto the terrain, so clicks/pings land on what's drawn.
- **Alignment invariant:** the heightmap shares the background image's space, sampled with the **same UV/flip the color texture uses**, so terrain registers with the map by construction (handled in one place, like the projection flip).
- **Performance:** one-time at load (readback + bake + `computeVertexNormals` + Sobel); higher static vertex count; +1 cheap height sample per placeable/overlay per frame. No new per-frame render cost; fits the dirty-gated loop.
- **Out of scope:** authoring/painting heightmaps in-app; per-vertex terrain collision for Foundry's 2D systems (the 2D scene stays flat — terrain is a globe-view display layer); water/biome shading; deriving height from the map image.
