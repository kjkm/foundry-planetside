## Context

The body is a `SphereGeometry` (96×64) with `MeshLambertMaterial({ map })`, lit by a directional sun + low ambient, rendered on-demand (dirty-gated). UVs are rewritten per the selected projection; `scene.js` already supports `rebuildBody()` (dispose + rebuild from the current projection). three 0.160's Lambert supports `normalMap` and `displacementMap` natively, but we use **CPU-baked** displacement (not the GPU `displacementMap`) so the raycast surface matches the visible surface.

Everything that sits on the globe derives from `lat/lon → sphere point at radius r`: placeables (`placeables.js`, `r = _radius()`), and DOM overlays (`overlays.js sceneToScreen`, `r = 1`). Input raycasts `this.body` and inverse-projects the hit. So "make content rest on terrain" = "add the terrain elevation to `r`" in those two spots, and input follows for free once the body and the token meshes are raised.

## Goals / Non-Goals

**Goals:**
- Optional per-scene heightmap displaces the globe into real terrain; absent → exactly flat (no derivation).
- The displaced mesh is the true surface: input, tokens, tiles, pings, overlays all consistent with what's drawn.
- Fine relief detail beyond vertex resolution (derived normal map).
- Terrain aligns with the map by construction.

**Non-Goals:**
- GPU `displacementMap` (desyncs raycast — the whole reason we bake).
- Affecting Foundry's flat 2D scene (walls/vision/collision stay 2D; terrain is globe-view only).
- In-app heightmap authoring; deriving height from map luminance; biome/water shading.

## Decisions

### D1: A shared `Heightfield` (like `Projection`)

New `heightfield.js`: loads the heightmap PNG, reads it to a grayscale buffer (canvas readback, as `_onImageLoaded` already does for the cap color), and exposes:
- `elevationAt(u, v)` → radial offset in globe units (bilinear sample × `displacementScale`), `0` when no heightmap.
- a derived **normal map** (`THREE.CanvasTexture`) via a Sobel pass over the height buffer, with a `reliefStrength`.
- `configure({ src, displacementScale, reliefStrength })` that mutates in place (so scene/placeables/overlays holders track changes without re-wiring — same pattern the `Projection` rename established).

The controller owns one instance and passes it to `Scene`, the placeable layers, and `OverlayReanchor`. When no `heightmap` flag is set, the field is inert (`elevationAt → 0`, no normal map) and everything behaves as today.

### D2: CPU-baked radial displacement + recomputed normals

In `_buildBody`, after the projection UVs are written, for each body vertex: read its UV, `h = heightfield.elevationAt(u, v)`, and move the vertex to `radius (1 + h)` along its (radial) normal. Then `geometry.computeVertexNormals()` so the **displaced** surface shades correctly (without this it would shade as a smooth sphere). The derived normal map layers finer detail on top. Baking (not GPU displacement) is the core decision: Three's raycaster uses the stored positions, so the baked surface is what input hits — the round-trip the `selectable-projection` change enshrined stays exact, now even with relief.

### D3: Alignment — one UV/flip, by construction

The heightmap is authored in the **same image space** as the background map. Height is sampled with the **same UV (including the texture flip) the color map uses**, so a heightmap pixel displaces exactly the map pixel above it — no separate registration. The flip lives in one place (mirroring the projection-flip discipline). `elevationAt(u, v)` takes the color/scene UV; the bake passes each vertex's texture UV; placeables/overlays convert their scene `(x, y)` to `(u, v)` the same way they already do for positioning.

### D4: Tessellation scales with terrain

Flat scenes keep 96×64. When a heightmap is active, the body is built at a higher tessellation (e.g. ~256×128) so landforms aren't faceted; the normal map carries sub-vertex detail. Higher vertex count is static (built once); render is trivial; the per-click raycast over ~more triangles is still cheap (add a BVH only if it ever bites).

### D5: Content rests on terrain via the elevation field

- `placeables.js _updateEntry`: `r = _radius() + heightfield.elevationAt(u, v)` for the entry's center.
- `overlays.js sceneToScreen`: project the world point at `1 + heightfield.elevationAt(u, v)` — covers pings, token HUD, chat bubbles, tooltips in one spot.
- Token nameplates already follow the (now-raised) token position.
- Input needs nothing: it raycasts the baked body, and token meshes are raised, so clicks/pings land on the drawn surface.

### D6: Rebuild triggers

`rebuildBody()` re-bakes using the current projection + heightfield. Triggered by heightmap / displacement-scale / relief-strength changes **and** projection/span changes (projection drives the sampling UVs). Reuses the existing flag-change → rebuild path.

## Risks / Trade-offs

- **[Forgetting `computeVertexNormals` → flat shading on relief]** → it's the step that makes baked displacement actually catch light; called out in tasks and verified by eye.
- **[E-W seam crack]** → the seam meridian (u=0 ≡ u=1) must displace equally; sample the height with U-wrapping so seam vertices share a height. Verify no gap at the seam.
- **[Pole spike at ±90° (equirect/equal-area)]** → the pole is a single vertex fed by many top-row heights; nonzero pole height could tear. Damp displacement toward the poles (or sample a single pole height). Verify at full span.
- **[Heightmap ≠ map alignment if authored at a different aspect]** → documented: the heightmap must match the background image's framing; sampled in the same normalized space, so a matching PNG just works.
- **[Raycast cost at high tessellation]** → per-click only; fine at ~64k tris. BVH is a later option, not needed now.
- **[Displacement scale units]** → in globe radii (sphere radius = 1); a small scale (e.g. 0.01–0.05) gives visible-but-sane relief. Tunable; pick defaults by eye.

## Open Questions

- **O1:** Displacement-scale parameterization — fraction of globe radius (simple) vs scene-distance-aware (tie to grid units)? Lean: globe-radius fraction, tuned by eye.
- **O2:** Tessellation — fixed higher value when active, or a quality knob? Lean: fixed (~256×128); expose later if needed.
- **O3:** Should the caps also displace at their boundary to meet a displaced body edge (when span < 90°)? Lean: no — caps stay flat; the body edge meets them at base radius (displacement damped to 0 at the span boundary to avoid a lip).
