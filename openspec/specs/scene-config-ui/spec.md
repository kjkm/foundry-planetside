# scene-config-ui Specification

## Purpose
TBD - created by archiving change scene-config-tab. Update Purpose after archive.
## Requirements
### Requirement: Planetside tab appears in Foundry scene configuration sheet

When Foundry renders a `SceneConfig` sheet, the module SHALL inject a new tab labeled **Planetside** alongside the sheet's existing tabs (Basics, Grid, Vision, etc.). The tab SHALL be reachable by clicking its nav item the same way the existing tabs are.

#### Scenario: Tab is present on scene config

- **WHEN** the user opens any scene's configuration sheet
- **THEN** a tab labeled "Planetside" is visible in the sheet's tab navigation

#### Scenario: Tab content is reachable by clicking the nav item

- **WHEN** the user clicks the Planetside tab
- **THEN** the tab's content panel is shown and the other tab panels are hidden

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

