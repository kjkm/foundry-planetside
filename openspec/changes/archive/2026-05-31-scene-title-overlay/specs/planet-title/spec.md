## ADDED Requirements

### Requirement: Title and subtitle DOM overlay rendered in chosen canvas corner while Planetside active

While Planetside is active on a scene with a non-empty `flags.planetside.title` or `flags.planetside.subtitle`, the module SHALL render those strings as DOM elements absolutely positioned inside one of the four corners of the canvas region. The corner is determined by `flags.planetside.titleCorner` (one of `tl`, `tr`, `bl`, `br`). Title and subtitle share the same corner and stack vertically with the title above the subtitle.

#### Scenario: Title renders in chosen corner when Planetside is active

- **WHEN** Planetside is active on a scene whose `flags.planetside.title` is "Kepler-186f" and `flags.planetside.titleCorner` is `tr`
- **THEN** a DOM element containing the text "Kepler-186f" appears in the top-right corner of the canvas region

#### Scenario: Empty title hides the title element but allows subtitle

- **WHEN** the scene's `flags.planetside.title` is empty and `flags.planetside.subtitle` is "Stellar Survey Day 12"
- **THEN** no title element is rendered, but the subtitle "Stellar Survey Day 12" appears in the chosen corner

#### Scenario: Both empty renders no overlay

- **WHEN** both `flags.planetside.title` and `flags.planetside.subtitle` are empty
- **THEN** no overlay DOM elements are present

#### Scenario: Overlay disappears on deactivation

- **WHEN** Planetside is deactivated on a scene that had an active title overlay
- **THEN** the overlay DOM elements are removed from the page

### Requirement: Title and subtitle use independent font family and size

The title element SHALL use the font family specified by `flags.planetside.titleFont` and the size in pixels specified by `flags.planetside.titleSize`. The subtitle element SHALL use `flags.planetside.subtitleFont` and `flags.planetside.subtitleSize` respectively. Each is applied as the element's CSS `font-family` and `font-size` properties.

#### Scenario: Independent font for title and subtitle

- **WHEN** `flags.planetside.titleFont` is "Impact" and `flags.planetside.subtitleFont` is "Georgia"
- **THEN** the title element's computed `font-family` includes "Impact" and the subtitle's includes "Georgia"

#### Scenario: Independent size for title and subtitle

- **WHEN** `flags.planetside.titleSize` is 48 and `flags.planetside.subtitleSize` is 20
- **THEN** the title element's CSS `font-size` is 48px and the subtitle's is 20px

### Requirement: Sensible defaults when title flags are absent

When any of the seven title-related flags is unset on a scene, the module SHALL apply defaults: empty title, empty subtitle, `serif` font family for both, 36px title size, 18px subtitle size, top-left corner.

#### Scenario: Newly enabled scene shows no overlay by default

- **WHEN** Planetside is activated on a scene that has never had any title flag set
- **THEN** no title or subtitle overlay is visible

### Requirement: Hot reload of title-related flags

While the module is active on the current scene, on `updateScene` events whose changes object touches any `flags.planetside.*` key, the module SHALL re-apply the title overlay state from the scene's current flags without going through full activate/deactivate. Changes to the enable flag continue to use the existing activate/deactivate path.

#### Scenario: Editing the title in scene config updates the live overlay

- **WHEN** the GM edits `flags.planetside.title` in the scene config and saves, while Planetside is active on the current scene
- **THEN** the live title overlay updates to show the new text without a scene reload

#### Scenario: Changing corner moves the overlay

- **WHEN** the GM changes `flags.planetside.titleCorner` from `tl` to `br` and saves
- **THEN** the live overlay moves to the bottom-right corner of the canvas region
