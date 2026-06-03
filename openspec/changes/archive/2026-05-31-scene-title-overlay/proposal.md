## Why

A planet rendered as a 3D globe with a title floating in the corner of the screen reads like a film establishing shot — "Arrival at Kepler-186f," "Day 47, New Geneva." This change adds that affordance: a per-scene title (and optional subtitle) rendered as a DOM overlay in a chosen corner of the canvas while Planetside is active on the scene. Each gets its own font family and size so the GM can style the title to match the world's tone.

This is a small, self-contained addition to the existing scene config tab — six new fields plus a corner selector — and a small rendering layer that toggles on with the rest of the globe view.

## What Changes

- Extend the **Planetside** tab in the scene configuration sheet with the following fields:
  - `flags.planetside.title` (string, may be empty)
  - `flags.planetside.subtitle` (string, may be empty)
  - `flags.planetside.titleFont` (font family choice, drawn from a curated list)
  - `flags.planetside.titleSize` (number, pixels)
  - `flags.planetside.subtitleFont` (font family choice)
  - `flags.planetside.subtitleSize` (number, pixels)
  - `flags.planetside.titleCorner` (one of `tl`, `tr`, `bl`, `br`)
- When Planetside is active on a scene, render the title and subtitle as DOM elements absolutely positioned inside the chosen corner of the canvas region. The two share a corner and stack vertically (title above subtitle).
- Empty strings hide their respective element. Both empty → no overlay rendered at all.
- Hot reload on `updateScene`: changes to any of the title-related flags update the live overlay without requiring a scene reload, the same way the enable flag already does.
- Default values when flags are unset: empty strings, system serif font for both, sizes 36 px / 18 px, corner `tl` (top-left).

## Capabilities

### New Capabilities
- `planet-title`: Render a per-scene title and optional subtitle as a DOM overlay in a chosen corner of the canvas while the module is active on the scene.

### Modified Capabilities
- `scene-config-ui`: The Planetside tab SHALL include the title, subtitle, font, size, and corner fields described above in addition to the existing enable checkbox, and these fields SHALL persist to scene flags via Foundry's standard form-submit handling.

## Impact

- Affects `templates/scene-config-tab.hbs` (new fields), `scripts/main.js` (hot reload includes new flags), and adds a new `scripts/title.js` module for the overlay.
- Wires into `scripts/planetside.js`'s activate/deactivate lifecycle so the overlay appears/disappears with the rest of the globe view.
- Visual: a small static text overlay appears in one corner of the screen while a Planetside-enabled scene is active. No interaction; purely cosmetic.
- No changes to camera, atmosphere, lighting, lens flare, starfield, input forwarding, or any other rendering subsystem.
