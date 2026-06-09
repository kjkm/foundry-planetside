## ADDED Requirements

### Requirement: Polar caps interpolate the terrain's perimeter heights when displaced

When the globe is displaced and polar caps are present (the body does not reach the poles — Mercator, or equirectangular/equal-area with span < 90°), each cap SHALL be displaced so that its rim matches the body's displaced edge heights at the corresponding longitudes and interpolates smoothly to a single height at the pole, so the cap continues the terrain without a cliff at the boundary and without a tear at the converged pole vertex. The pole height SHALL be the mean of the body's edge heights (the rim heights must converge to one value at the pole). The cap SHALL share the body's longitude frame so its rim samples align with the body edge, and its normals SHALL be recomputed after displacement so it shades. When no heightmap is set the caps SHALL remain flat (unchanged).

Correspondingly, the body's edge displacement near a cap boundary SHALL NOT be damped (the edge carries its true heights for the cap to match); displacement damping toward a converged pole vertex SHALL apply only on a capless globe (full-sphere coverage).

#### Scenario: Cap rim matches the displaced body edge

- **WHEN** the globe is displaced and a cap is present
- **THEN** the cap's rim height at each longitude matches the body's displaced edge height there (no cliff where the cap meets the body)

#### Scenario: Cap interpolates to a single pole height

- **WHEN** a displaced cap is built
- **THEN** its surface interpolates from the per-longitude rim heights to a single (mean) height at the pole, with no tear at the converged pole vertex

#### Scenario: Flat globe leaves caps flat

- **WHEN** no heightmap is set
- **THEN** the caps are flat (no displacement), as before

### Requirement: Polar caps blend the map's perimeter colours toward the centre

When polar caps are present, each cap SHALL be coloured (per vertex) by the map's colour at the body's edge at the corresponding longitude, fading to the perimeter-average colour toward the pole (the same falloff used for the height), so the cap continues the map at its rim instead of showing a flat ring. The sampled colours SHALL be converted from sRGB to linear so they match the body's displayed colours. This applies whenever the background image is available, independent of whether a heightmap is set.

#### Scenario: Cap rim continues the map colours

- **WHEN** caps are present and the background image is loaded
- **THEN** the cap's rim colour at each longitude matches the map's colour at the body edge there, and blends to the perimeter-average toward the pole

#### Scenario: Cap colour matches the body (no brightness jump)

- **WHEN** the cap rim is coloured from the map
- **THEN** the colours are sRGB→linear converted so the rim reads at the same brightness as the adjacent body, not washed out
