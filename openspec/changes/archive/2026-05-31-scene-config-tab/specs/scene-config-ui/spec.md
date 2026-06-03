## ADDED Requirements

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
