## MODIFIED Requirements

### Requirement: Mercator UV mapping with east-west wrap

The sphere body's vertex UVs SHALL be rewritten so that geometric latitude maps to texture V via a **selectable projection curve**, and the texture U axis wraps continuously across the east-west seam (`THREE.RepeatWrapping`) so the seam is visually continuous. The supported curves are **equirectangular** (latitude linear in V; the default), **Mercator** (`V ∝ ln tan(π/4+lat/2)`), and **equal-area** (`V ∝ sin lat`). Each curve SHALL be closed-form in both directions, and the module SHALL use the **same** curve for the mesh UVs (forward) and for the inverse mapping consumed by input forwarding, ping/placeable/HUD positioning, and camera targets — so a projected point and its inverse round-trip exactly (a click or ping lands where the texture shows it).

The map's latitude coverage SHALL be a configurable **latitude span**: the latitude that the image's top and bottom edges reach. When the span reaches ±90° (permitted for equirectangular and equal-area) the body covers the whole sphere; otherwise the body is cropped to the span and the remainder is handled by the polar-caps capability. Mercator's span SHALL remain bounded short of ±90° (its mapping diverges at the poles). The full-360° U wrap and the seam behavior are unchanged.

#### Scenario: Texture wraps continuously east-west

- **WHEN** the camera orbits across the longitudinal seam of the texture
- **THEN** no visible hard edge or discontinuity appears at the seam

#### Scenario: Selected projection maps latitude to V and round-trips

- **WHEN** a projection curve is selected and a scene coordinate is mapped onto the sphere and back
- **THEN** the mesh UVs use that curve's forward mapping and the inverse (input/ping/HUD) uses its exact inverse, so the point round-trips to the same location

#### Scenario: Latitude span controls polar coverage

- **WHEN** the latitude span is set to ±90° (equirectangular or equal-area)
- **THEN** the body sphere reaches the poles and no geometry is left uncovered

- **WHEN** the latitude span is less than full (or the projection is Mercator)
- **THEN** geometry beyond the span is not part of the body mesh and the uncovered region is handled by the polar caps
