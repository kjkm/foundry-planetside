## ADDED Requirements

### Requirement: Planetside tab contains minimap controls

The Planetside tab in the scene configuration sheet SHALL contain controls for the minimap overlay, each whose `name` attribute is `flags.planetside.<key>` so Foundry's standard form-submit handling persists the value to the scene's flags:

- **Enable minimap**: checkbox bound to `flags.planetside.minimapEnabled`. Unchecked means no minimap.
- **Minimap image**: an image file-picker bound to `flags.planetside.minimapImage` (a Foundry FilePicker for image paths). Empty means the minimap falls back to the scene background.
- **Minimap corner**: select dropdown of the four corner choices (`Top-Left`, `Top-Right`, `Bottom-Left`, `Bottom-Right`), bound to `flags.planetside.minimapCorner`.

Each control SHALL reflect the scene's current flag value when the sheet is opened, falling back to documented defaults when unset (minimap disabled, empty image, bottom-right corner). Saving the sheet SHALL persist the values; the live minimap SHALL apply them without a reload (consistent with how the other Planetside flags apply).

#### Scenario: Minimap controls visible in the Planetside tab

- **WHEN** the GM opens any scene's configuration sheet and clicks the Planetside tab
- **THEN** the tab shows an Enable-minimap checkbox, a Minimap-image file-picker, and a Minimap-corner dropdown

#### Scenario: Existing flag values populate the controls on open

- **WHEN** a scene has `flags.planetside.minimapEnabled` true and `flags.planetside.minimapImage` set to an image path
- **THEN** opening that scene's config tab shows the checkbox checked and that path in the Minimap-image picker

#### Scenario: Defaults applied when minimap flags are unset

- **WHEN** the GM opens the config tab for a scene where no minimap flag has been set
- **THEN** the Enable-minimap checkbox is unchecked, the Minimap-image field is empty, and the Minimap-corner dropdown shows Bottom-Right

#### Scenario: Saving persists and applies the minimap controls

- **WHEN** the GM toggles the minimap or sets the image and saves the scene config (for the live scene)
- **THEN** the values persist to `flags.planetside.*` and the active minimap updates without a reload
