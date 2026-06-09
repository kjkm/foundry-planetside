## ADDED Requirements

### Requirement: Planetside tab contains heightmap terrain controls

The Planetside tab in the scene configuration sheet SHALL contain controls for the globe terrain, each whose `name` attribute is `flags.planetside.<key>` so Foundry's standard form-submit handling persists the value to the scene's flags:

- **Heightmap**: an image file-picker bound to `flags.planetside.heightmap` (a Foundry FilePicker for image paths). Empty means no terrain (flat globe).
- **Displacement scale**: number input bound to `flags.planetside.displacementScale`, with reasonable bounds, controlling how much the heightmap raises/lowers the surface.
- **Relief strength**: number input bound to `flags.planetside.reliefStrength`, controlling the derived normal-map shading intensity.

Each control SHALL reflect the scene's current flag value when the sheet is opened, falling back to documented defaults when unset (empty heightmap → flat). Saving the sheet SHALL persist the values; the live globe SHALL re-bake the terrain to the new heightmap/scale/strength without a reload (consistent with how the other Planetside flags apply).

#### Scenario: Terrain controls visible in the Planetside tab

- **WHEN** the GM opens any scene's configuration sheet and clicks the Planetside tab
- **THEN** the tab shows a Heightmap file-picker, a Displacement-scale field, and a Relief-strength field

#### Scenario: Existing flag values populate the controls on open

- **WHEN** a scene has `flags.planetside.heightmap` set to an image path
- **THEN** opening that scene's config tab shows that path in the Heightmap picker and the saved scale/strength values

#### Scenario: Empty heightmap means flat

- **WHEN** the GM leaves the Heightmap field empty and saves
- **THEN** the globe renders flat (no displacement, no derived normal map)

#### Scenario: Saving persists and re-bakes the terrain

- **WHEN** the GM sets or changes the heightmap / displacement scale / relief strength and saves the scene config (for the live scene)
- **THEN** the values persist to `flags.planetside.*` and the active globe re-bakes to the new terrain without a reload
