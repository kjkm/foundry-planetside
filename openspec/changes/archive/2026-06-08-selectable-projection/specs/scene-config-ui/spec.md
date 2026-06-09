## ADDED Requirements

### Requirement: Planetside tab contains projection and latitude-span controls

The Planetside tab in the scene configuration sheet SHALL contain controls for the globe projection, each whose `name` attribute is `flags.planetside.<key>` so Foundry's standard form-submit handling persists the value to the scene's flags:

- **Projection**: select dropdown bound to `flags.planetside.projection`, with options **Equirectangular**, **Mercator**, and **Equal-area**.
- **Latitude span**: number input (degrees) bound to `flags.planetside.latitudeSpan`, with reasonable bounds (e.g. 30–90), representing the latitude the map's top/bottom edges reach.

Each control SHALL reflect the scene's current flag value when the sheet is opened, falling back to the documented defaults when unset (**Equirectangular**, **±90°**). Saving the sheet SHALL persist the values; the live globe SHALL re-evaluate and rebuild to the new projection/span without a reload (consistent with how the other Planetside flags apply).

#### Scenario: Projection controls visible in the Planetside tab

- **WHEN** the GM opens any scene's configuration sheet and clicks the Planetside tab
- **THEN** the tab shows a Projection dropdown (Equirectangular / Mercator / Equal-area) and a Latitude-span field

#### Scenario: Existing flag values populate the controls on open

- **WHEN** a scene has `flags.planetside.projection` set to `mercator` and `flags.planetside.latitudeSpan` to `85`
- **THEN** opening that scene's config tab shows Mercator selected and 85 in the latitude-span field

#### Scenario: Defaults applied when flags are unset

- **WHEN** the GM opens the config tab for a scene where no projection flag has been set
- **THEN** the Projection control shows Equirectangular and the Latitude-span field shows 90

#### Scenario: Saving persists and applies the projection

- **WHEN** the GM changes the projection or latitude span and saves the scene config (for the live scene)
- **THEN** the values persist to `flags.planetside.*` and the active globe rebuilds to the new projection/span without a reload
