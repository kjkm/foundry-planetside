## ADDED Requirements

### Requirement: Polar caps filled with perimeter-average color of loaded image

The module SHALL fill the polar regions of the sphere (the spherical caps above and below the Mercator-cropped body) with a flat color derived from the average of the loaded background image's perimeter pixels. The cap color SHALL be computed once at image-load time and applied to both polar cap meshes.

#### Scenario: Caps are filled with derived color

- **WHEN** the background image finishes loading
- **THEN** the perimeter of that image is sampled and averaged into a single RGB color
- **AND** both polar cap meshes are colored with that average

#### Scenario: Caps are not transparent or hardcoded

- **WHEN** the globe is rendered with a loaded scene texture
- **THEN** the polar regions appear as a flat color derived from the image, not transparent and not a hardcoded default
