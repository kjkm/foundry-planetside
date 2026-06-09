# scene-config-ui Specification

## Purpose
TBD - created by archiving change scene-config-tab. Update Purpose after archive.
## Requirements
### Requirement: Planetside tab appears in Foundry scene configuration sheet

When Foundry renders a `SceneConfig` sheet, the module SHALL inject a new tab labeled **Planetside** alongside the sheet's existing tabs. The injection SHALL work across Foundry's supported UI frameworks for the sheet — the ApplicationV1 sheet (Foundry v12, jQuery-rendered) and the ApplicationV2 sheet (Foundry v13, native-DOM-rendered) — adapting to each one's tab markup. The injected tab SHALL integrate with the sheet's **native tab navigation**, so it activates and deactivates the same way the built-in tabs do (no bespoke show/hide that diverges from the sheet's own tab behavior).

#### Scenario: Tab is present on scene config

- **WHEN** the user opens any scene's configuration sheet (on a supported Foundry version)
- **THEN** a tab labeled "Planetside" is visible in the sheet's tab navigation

#### Scenario: Tab content is reachable by activating the nav item

- **WHEN** the user clicks the Planetside tab nav item
- **THEN** the tab's content panel is shown and the other tab panels are hidden, using the sheet's native tab switching

#### Scenario: Works on the v13 ApplicationV2 scene config

- **WHEN** the scene config is the Foundry v13 ApplicationV2 `SceneConfig` (its render hook provides a native `HTMLElement` and its tabs use `data-action="tab"` / `data-group` markup)
- **THEN** the Planetside tab is injected into that markup and switches correctly via the AppV2 tab controller

### Requirement: Tab contains an enable checkbox bound to the scene's planetside.enabled flag

The Planetside tab SHALL contain a labeled checkbox input whose `name` attribute is `flags.planetside.enabled`. The checkbox SHALL be rendered checked if and only if the scene's `flags.planetside.enabled` is truthy at render time.

#### Scenario: Checkbox reflects current flag state on open

- **WHEN** the user opens the scene config for a scene whose `flags.planetside.enabled` is true
- **THEN** the enable checkbox is rendered checked

- **WHEN** the user opens the scene config for a scene whose `flags.planetside.enabled` is false or absent
- **THEN** the enable checkbox is rendered unchecked

#### Scenario: Saving the form persists the flag

- **WHEN** the user toggles the checkbox and clicks the sheet's save button
- **THEN** the scene's `flags.planetside.enabled` is updated to match the checkbox state via Foundry's standard form-submit handling

### Requirement: Planetside tab contains title and subtitle fields with font, size, and corner controls

In addition to the existing enable checkbox, the Planetside tab in the scene configuration sheet SHALL contain the following labeled fields, each whose `name` attribute is `flags.planetside.<key>` so Foundry's standard form-submit handling persists their values to the scene's flags:

- **Title**: text input, bound to `flags.planetside.title`.
- **Title font**: select dropdown of a curated list of font family names, bound to `flags.planetside.titleFont`.
- **Title size**: number input (px), bound to `flags.planetside.titleSize`, with reasonable min/max bounds.
- **Subtitle**: text input, bound to `flags.planetside.subtitle`.
- **Subtitle font**: select dropdown with the same options as Title font, bound to `flags.planetside.subtitleFont`.
- **Subtitle size**: number input (px), bound to `flags.planetside.subtitleSize`.
- **Corner**: select dropdown of the four corner choices (`Top-Left`, `Top-Right`, `Bottom-Left`, `Bottom-Right`), bound to `flags.planetside.titleCorner`.

Each field SHALL reflect the scene's current flag value when the config sheet is opened, falling back to the documented default if the flag is unset.

#### Scenario: All title fields visible in the Planetside tab

- **WHEN** the GM opens any scene's configuration sheet and clicks the Planetside tab
- **THEN** the tab shows the enable checkbox plus the title, title font, title size, subtitle, subtitle font, subtitle size, and corner fields

#### Scenario: Existing flag values populate the form on open

- **WHEN** a scene already has `flags.planetside.title` set to "Arrakis"
- **THEN** opening that scene's config tab shows "Arrakis" pre-filled in the Title input

#### Scenario: Saving the form persists all title fields

- **WHEN** the GM fills the title, subtitle, font, size, and corner fields and saves the scene config
- **THEN** all seven corresponding `flags.planetside.*` values are persisted to the scene's flags

#### Scenario: Defaults applied when flags are unset

- **WHEN** the GM opens the config tab for a scene where no title-related flag has ever been set
- **THEN** the form displays the documented defaults (empty title and subtitle, serif font family for both, 36/18 px sizes, top-left corner)

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

#### Scenario: Defaults applied when projection flags are unset

- **WHEN** the GM opens the config tab for a scene where no projection flag has been set
- **THEN** the Projection control shows Equirectangular and the Latitude-span field shows 90

#### Scenario: Saving persists and applies the projection

- **WHEN** the GM changes the projection or latitude span and saves the scene config (for the live scene)
- **THEN** the values persist to `flags.planetside.*` and the active globe rebuilds to the new projection/span without a reload

