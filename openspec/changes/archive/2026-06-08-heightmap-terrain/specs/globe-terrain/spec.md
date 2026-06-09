## ADDED Requirements

### Requirement: Optional heightmap displaces the globe body (CPU-baked)

When a scene provides a heightmap image (`flags.planetside.heightmap`), the module SHALL displace the globe body into terrain by baking the height into the body geometry on the CPU: the heightmap SHALL be read into a pixel buffer, and each body vertex SHALL be offset **radially** by its sampled height × the displacement scale; the geometry's vertex normals SHALL then be **recomputed** so the displaced surface shades correctly under the scene's lighting. The displacement SHALL be baked into the geometry's positions (not applied as a GPU-only `displacementMap`), so that raycasting the body hits the displaced (visible) surface. When no heightmap is set, the body SHALL remain exactly flat (an unmodified sphere) — the module SHALL NOT derive height from the map image or otherwise displace.

The body SHALL use a higher tessellation when a heightmap is active so displaced landforms are not coarsely faceted, and the lower tessellation when flat. Height SHALL be sampled in the same image space and with the same UV convention (including the texture flip) as the background color map, so terrain registers with the map by construction.

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

### Requirement: Derived normal map adds fine relief shading

When a heightmap is active, the module SHALL derive a normal map from the height buffer (a gradient/Sobel pass) and apply it to the body material with a configurable relief strength, so surface detail finer than the vertex resolution is shaded. When no heightmap is set, no normal map SHALL be applied.

#### Scenario: Fine relief is shaded beyond vertex resolution

- **WHEN** a heightmap is active
- **THEN** the body material carries a derived normal map so small features read as relief under lighting even between displaced vertices

#### Scenario: Relief strength is configurable

- **WHEN** the relief strength is changed
- **THEN** the intensity of the normal-map shading changes accordingly

### Requirement: Surface-anchored content rests on the terrain

When the globe is displaced, the module SHALL raise surface-anchored content to the terrain via a shared elevation field. Tokens and tiles (flat meshes) SHALL be lifted clear of the terrain they cover — their radial position SHALL include the **maximum** elevation sampled over their footprint — so a mesh rests on its highest covered point and does not clip into terrain. Reanchored DOM overlays (pings, token HUD, chat bubbles, tooltips) SHALL project from the terrain elevation at their anchor point. When no heightmap is set, the elevation field SHALL return zero everywhere and content SHALL be positioned exactly as before.

#### Scenario: Tokens and tiles rest clear of the terrain they cover

- **WHEN** the globe is displaced and a token or tile is shown
- **THEN** it is lifted to the highest terrain under its footprint, so the flat mesh rests grounded on its tallest covered point and does not clip into nearby relief

#### Scenario: Pings and overlays follow the terrain

- **WHEN** the globe is displaced and a ping or a reanchored overlay is shown
- **THEN** it is positioned at the terrain elevation of its scene coordinate

#### Scenario: Flat scene is unaffected

- **WHEN** no heightmap is set
- **THEN** the elevation field returns zero and all content is positioned exactly as it was before this capability
