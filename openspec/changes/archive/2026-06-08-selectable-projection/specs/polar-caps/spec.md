## MODIFIED Requirements

### Requirement: Polar caps filled with perimeter-average color of loaded image

The module SHALL render polar caps **only when the body does not cover the full sphere** — i.e. when the latitude span is less than ±90° or the projection (e.g. Mercator) cannot reach the poles. When caps are rendered, the module SHALL fill the polar regions of the sphere (the spherical caps above and below the projected body) with a flat color derived from the average of the loaded background image's perimeter pixels, computed once at image-load time and applied to both cap meshes. When the body covers the full sphere (e.g. equirectangular or equal-area at ±90° span), the module SHALL NOT render polar caps.

#### Scenario: Caps are filled with derived color when present

- **WHEN** the body does not reach the poles (span < full, or Mercator) and the background image finishes loading
- **THEN** the perimeter of that image is sampled and averaged into a single RGB color
- **AND** both polar cap meshes are colored with that average

#### Scenario: No caps when the map covers the full sphere

- **WHEN** the projection and latitude span cover the whole sphere (e.g. equirectangular at ±90°)
- **THEN** no polar cap meshes are rendered (the map itself reaches the poles)

#### Scenario: Caps are not transparent or hardcoded

- **WHEN** caps are rendered with a loaded scene texture
- **THEN** the polar regions appear as a flat color derived from the image, not transparent and not a hardcoded default
