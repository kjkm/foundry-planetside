## ADDED Requirements

### Requirement: Planetside tab contains lighting and atmosphere controls

The Planetside tab in the scene configuration sheet SHALL contain controls for the globe's lighting and atmosphere, each whose `name` attribute is `flags.planetside.<key>` so Foundry's standard form-submit handling persists the value to the scene's flags:

- **Sun color**: color input bound to `flags.planetside.sunColor`.
- **Sun intensity**: number/range input bound to `flags.planetside.sunIntensity`.
- **Sun azimuth** (degrees, 0–360, "time of day"): number/range input bound to `flags.planetside.sunAzimuth`.
- **Sun elevation** (degrees, −90–90): number/range input bound to `flags.planetside.sunElevation`.
- **Ambient / dark-side intensity**: number/range input bound to `flags.planetside.ambientIntensity`.
- **Atmosphere color**: color input bound to `flags.planetside.atmosphereColor`.
- **Atmosphere intensity**: number/range input bound to `flags.planetside.atmosphereIntensity`.

Each control SHALL reflect the scene's current flag value when the sheet is opened, falling back to the documented defaults (the current built-in lighting values) when unset. Saving the sheet SHALL persist the values; the live globe SHALL apply them immediately (without a reload or geometry rebuild), consistent with how the other Planetside flags apply.

#### Scenario: Lighting controls visible in the Planetside tab

- **WHEN** the GM opens any scene's configuration sheet and clicks the Planetside tab
- **THEN** the tab shows sun color/intensity/azimuth/elevation, ambient intensity, and atmosphere color/intensity controls

#### Scenario: Existing flag values populate the controls on open

- **WHEN** a scene has lighting flags set (e.g. `flags.planetside.sunAzimuth`)
- **THEN** opening that scene's config tab shows the saved values, and unset controls show the documented defaults

#### Scenario: Saving applies the lighting live

- **WHEN** the GM changes a lighting/atmosphere control and saves the scene config (for the live scene)
- **THEN** the values persist to `flags.planetside.*` and the active globe updates immediately without a reload or rebuild
