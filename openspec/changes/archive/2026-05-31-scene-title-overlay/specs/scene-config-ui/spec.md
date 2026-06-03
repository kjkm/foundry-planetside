## ADDED Requirements

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
