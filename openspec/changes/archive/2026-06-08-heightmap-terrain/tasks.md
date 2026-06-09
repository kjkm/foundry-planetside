## 1. Heightfield module

- [x] 1.1 New `scripts/heightfield.js` (class `Heightfield`): `configure({ src, displacementScale, reliefStrength })` (mutates in place); loads the PNG, reads it to a grayscale buffer (canvas readback); `ready` state + an onLoad callback/promise so the body can re-bake when it arrives
- [x] 1.2 `elevationAt(u, v)` → radial offset in globe units (bilinear sample × displacementScale, U-wrapped at the seam); returns 0 when no heightmap / not yet loaded
- [x] 1.3 Derive a normal map from the height buffer (Sobel/gradient) → `THREE.CanvasTexture`, scaled by reliefStrength; expose it; null when no heightmap
- [x] 1.4 Damp displacement toward the poles (avoid a pole-vertex spike at ±90° span) and ensure seam columns (u=0 ≡ u=1) sample equal height

## 2. Scene: bake terrain

- [x] 2.1 `scene.js`: when the heightfield is active, build the body at a higher tessellation (~256×128); flat → keep 96×64
- [x] 2.2 In `_buildBody` after UVs: bake displacement — per vertex, `elevationAt(uv)` → move to radius `1 + h` along its radial normal; then `geometry.computeVertexNormals()`
- [x] 2.3 Apply the derived `normalMap` (+ `normalScale` from relief strength) to the body material when active
- [x] 2.4 `rebuildBody()` re-bakes using the current projection + heightfield; re-bake when the heightmap finishes loading
- [x] 2.5 Pole-spike damping (in the bake) applies only on a capless globe (`coversPoles`); the body edge keeps true heights where caps exist. Displaced caps (`_bakeCapDisplacement`, rotated to the body frame) interpolate per-longitude rim heights → mean pole height (variation fades `(1-t)^p` toward the pole for a smooth dome), normals recomputed; flat caps when no heightmap
- [x] 2.6 Caps vertex-coloured from the map's per-longitude edge colours, fading to the perimeter-average toward the pole (sRGB→linear; `_applyCapColors`/`_sampleBgColor`); store the bg pixel buffer at load and rebuild so caps pick it up; applies whenever the image is loaded

## 3. Content rests on terrain

- [x] 3.1 `placeables.js _updateEntry`: lift the mesh to the MAX elevation under its footprint (`_footprintMaxElevation`, 3×3 sample; per-type `_footprintScene`) so it rests clear of terrain it covers without clipping
- [x] 3.2 `overlays.js sceneToScreen`: project the world point at radius `1 + heightfield.elevationAt(u, v)` (covers pings, HUD, bubbles, tooltips)
- [x] 3.3 Confirm input needs no change (raycasts the baked body; token meshes are raised) — verify clicks/pings land on the displaced surface

## 4. Controller wiring + rebuild

- [x] 4.1 `planetside.js`: construct the `Heightfield` from `flags.planetside.{heightmap,displacementScale,reliefStrength}`; pass it to Scene, token/tile layers, and OverlayReanchor
- [x] 4.2 `applyProjection`/equivalent: on heightmap/scale/strength (and projection) flag change, `configure()` the heightfield and `rebuildBody()`

## 5. Scene-config controls

- [x] 5.1 Add a Heightmap **FilePicker** (image, `name="flags.planetside.heightmap"`), Displacement-scale and Relief-strength number fields to the Planetside tab; wire FilePicker the way Foundry expects for v12 + v13
- [x] 5.2 Reflect current flag values on open; empty heightmap → flat; saving re-bakes live without reload

## 6. Docs

- [x] 6.1 README: document the heightmap terrain (PNG required, flat otherwise), CPU-baked displacement, derived normal map, content resting on terrain, and that the 2D scene stays flat
- [x] 6.2 `openspec validate heightmap-terrain --strict`

## 7. Smoke testing in Foundry

- [x] 7.1 Provide a heightmap → globe displaces into terrain; relief catches the sun (normals recomputed); fine detail reads via the normal map
- [x] 7.2 **Round-trip on terrain:** ping/click a peak and a valley — markers/selection land on the displaced surface under the cursor (no parallax)
- [x] 7.3 Tokens/tiles rest on the surface; pings and the Token HUD sit at terrain height; nameplates follow
- [x] 7.4 No crack at the E-W seam; no spike/tear at the poles (test equirect ±90° and a Mercator/band scene)
- [x] 7.5 Empty heightmap → exactly flat (no displacement, no normal map), everything as before
- [x] 7.6 Changing heightmap / displacement scale / relief strength in the config tab re-bakes live without a reload; works under each projection
- [x] 7.7 Caps (Mercator, or a band scene with span < 90°) continue the terrain: the cap rim meets the body edge with no cliff/tear, closes to a smooth dome (no pucker), and its colour continues the map at the rim → average toward the centre (no flat gray ring, no brightness jump)
