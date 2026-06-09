## MODIFIED Requirements

### Requirement: Optional heightmap displaces the globe body (CPU-baked)

When a scene provides a heightmap image (`flags.planetside.heightmap`), the module SHALL displace the globe body into terrain by baking the height into the body geometry on the CPU: the heightmap SHALL be read into a pixel buffer, and each body vertex SHALL be offset **radially** by its sampled height × the displacement scale; the geometry's vertex normals SHALL then be **recomputed** so the displaced surface shades correctly under the scene's lighting. The displacement SHALL be baked into the geometry's positions (not applied as a GPU-only `displacementMap`), so that raycasting the body hits the displaced (visible) surface. When no heightmap is set, the body SHALL remain exactly flat (an unmodified sphere) — the module SHALL NOT derive height from the map image or otherwise displace.

The body SHALL use a higher tessellation when a heightmap is active so displaced landforms are not coarsely faceted, and the lower tessellation when flat. Height SHALL be sampled in the same image space and with the same UV convention (including the texture flip) as the background color map, so terrain registers with the map by construction.

The CPU-side derivation — the height readback, the normal-map (Sobel) pass, and the per-vertex bake sampling — SHALL operate at a **working resolution capped independent of the source image's resolution**, so load cost does not scale with high-resolution heightmaps. The body's color (`map`) texture SHALL remain full-resolution (it is a GPU upload, not CPU-processed). Terrain SHALL be built **asynchronously and SHALL NOT block the initial globe reveal**: the globe SHALL appear flat-textured as soon as the color texture is available, and the terrain SHALL swap in (replacing the flat body) when its build completes. The terrain SHALL be built once when its inputs are ready (no redundant full rebuilds per asset load).

#### Scenario: Heightmap displaces the globe into terrain

- **WHEN** a scene has a heightmap set and Planetside activates
- **THEN** the globe body's surface is displaced radially per the heightmap (peaks raised, valleys lowered) and its normals are recomputed so the relief catches the sun

#### Scenario: No heightmap leaves the globe flat

- **WHEN** a scene has no heightmap set
- **THEN** the body is an unmodified sphere and no height is derived from the map image

#### Scenario: The displaced surface is what input hits

- **WHEN** the globe is displaced and the user clicks or pings a point on a landform
- **THEN** the raycast hits the displaced (visible) surface and the resulting scene coordinate matches the spot under the cursor (no parallax between what is drawn and what is hit)

#### Scenario: Terrain aligns with the map

- **WHEN** a heightmap that matches the background image's framing is used
- **THEN** raised/lowered regions register with the corresponding features of the map (sampled in the same image space / UV as the color texture)

#### Scenario: Globe reveals flat-textured first, terrain swaps in

- **WHEN** a scene with a heightmap activates
- **THEN** the globe appears flat-textured as soon as the color texture loads (without waiting for the terrain build), and the terrain swaps in when its build completes — the build does not block the reveal or interaction

#### Scenario: Derivation cost is independent of source resolution

- **WHEN** a high-resolution heightmap (and/or background image) is used
- **THEN** the height readback, normal-map derivation, and bake operate at a capped working resolution so load-time CPU cost does not scale with the source image size, while the color texture remains full-resolution
