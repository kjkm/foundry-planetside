## MODIFIED Requirements

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
