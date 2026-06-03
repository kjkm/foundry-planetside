## Context

The module renders a 3D globe in the canvas region; per the existing `scene-config-ui`, a GM activates Planetside on a scene via a tab in `SceneConfig`. This change adds title and subtitle text overlays so the planet visual can be framed with a name (the planet's, the location's, a chapter heading, etc.). Foundry already has scene-name banners for scene transitions, but those are transient and styled by Foundry; what's needed here is a persistent, GM-styled overlay that lives with the active Planetside scene.

The overlay is text; the right place for text is the DOM, not the 3D scene. Rendering text in WebGL requires either bitmap glyphs (limited) or canvas-rendered textures (heavyweight). A pair of `<div>`s positioned absolutely is simpler, sharper, and respects browser font rendering and accessibility (text is selectable, screen-reader-readable).

## Goals / Non-Goals

**Goals:**
- One title and one subtitle per scene, each optional (empty string hides it).
- Title and subtitle share one corner (one of the four). Stack vertically.
- Independent font family and size for each.
- All seven settings are persisted as scene flags via the standard scene config form.
- Hot reload: changing any setting and saving updates the live overlay immediately on the current scene.
- Overlay appears only while Planetside is active on the scene; deactivating Planetside hides it.

**Non-Goals (v0):**
- Color customization (default white with a soft drop shadow for legibility on any background; can come later).
- Stroke / outline / glow / animation.
- Non-corner positions (center, edge midpoints).
- Multi-line text formatting (newlines render literally; no rich text).
- Per-character font controls.
- Bundled custom fonts (Google Fonts, etc.). We use a curated list of system fonts and Foundry's built-in `Signika`.
- Localization of the field labels in the config UI; English-only for v0.
- Animated entrances on activation (could be nice, not necessary).

## Decisions

### DOM overlay, not WebGL text

A pair of `<div>` elements inside a container, positioned absolutely in the chosen corner of the canvas region. The container is a sibling of the Three.js canvas inside the same host element. Rendering text via WebGL would require glyph atlas management for arbitrary fonts and produces blurrier results at non-power-of-two pixel sizes; the DOM gets us crisp text and free font handling.

### Container positioned inside the canvas host, not the viewport

The overlay's container is appended to `#board`'s parent (same host the Three.js canvas mounts in). This means the title is anchored to the canvas region, not the viewport, so it doesn't overlap Foundry's sidebar, hotbar, or controls. The four corner choices (`tl`, `tr`, `bl`, `br`) correspond to corners of the canvas region.

### Font family choices: curated dropdown

Rather than a free-text font-family input or a system font detector, the config exposes a small dropdown of broadly available font families:

- `serif` (browser default serif)
- `sans-serif` (browser default sans)
- `monospace` (browser default mono)
- `Signika` (Foundry's bundled UI font)
- `Arial`
- `Georgia`
- `Trebuchet MS`
- `Verdana`
- `Times New Roman`
- `Courier New`
- `Impact`
- `Palatino`

These are the names that go directly into the element's `font-family` CSS property as a fallback chain (e.g., `"Impact", sans-serif`). Users who need other fonts can extend the list in a follow-up.

### Size in pixels, with reasonable input range

Size fields are `<input type="number">` with `min="8"` and `max="120"` and `step="1"`. Stored as a number on the flag. No live preview in the config dialog — visible feedback happens on save.

### Defaults

When any of the title-related flags is unset on a scene, the module applies:
- `title`: `""` (empty — overlay hidden)
- `subtitle`: `""`
- `titleFont`: `"serif"`
- `titleSize`: `36`
- `subtitleFont`: `"serif"`
- `subtitleSize`: `18`
- `titleCorner`: `"tl"`

The empty-string default for title and subtitle means a freshly enabled scene shows no overlay until the GM writes something.

### Styling: white text with a soft drop shadow

Both elements have CSS `color: #ffffff` and a multi-stop text shadow (`text-shadow: 0 0 8px rgba(0,0,0,0.85), 0 2px 2px rgba(0,0,0,0.7)`) so the text remains legible on bright atmospheres, dark night sides, and starfield backgrounds alike. No color picker in the config in v0; if a scene needs a stylistic exception, it can be added as a future field.

### Lifecycle

The `TitleOverlay` class is constructed and mounted as part of `Planetside.activate()`. Its `update(flags)` method is called immediately after construction with the scene's current flags. On `deactivate()`, the overlay's DOM container is removed and destroyed.

The `updateScene` hook already handles flag-driven hot reload for the enable flag. We extend it: if any of the title-related flags changed and the module is active on the current scene, the controller calls `titleOverlay.update(currentFlags)` without going through activate/deactivate. This avoids reinitializing the Three.js scene for a font change.

If the enable flag changes, the existing activate/deactivate path handles teardown including the overlay.

### Field name routing in the config tab

All fields use `name="flags.planetside.<key>"` so Foundry's form parser routes them automatically into the scene's flags. No custom save handler.

## Risks / Trade-offs

- **Curated font list excludes designer choices.** A GM who wants a specific sci-fi face can't pick it without code changes. → Accept for v0; bundled-fonts feature can come later if the demand shows up.
- **Z-index conflicts with other module DOM overlays.** The overlay container has a fixed `z-index`; if some other module renders into the same range, layering may surprise. → Pick a `z-index` that sits above the canvas but below Foundry's chrome (e.g., 10).
- **Text shadow may be insufficient on extremely bright backgrounds.** Real-world test: a Mercator-projected map of pale sand against a pale sky could wash out white text. → Acceptable for v0; color customization is the eventual mitigation.
- **Hot-reload diff logic could miss new flag types.** If a future change adds another flag, we'd need to remember to add it to the diff. → Keep the change detection broad: re-apply on any `flags.planetside.*` change, not a specific allowlist. Cheap to re-apply.
- **Empty title and non-empty subtitle layout.** The two stack vertically; if title is empty and subtitle isn't, the subtitle takes the upper slot. → Handle by giving the title element `display: none` when empty, so the subtitle flows naturally to the corner.

## Open Questions

- Should the title field accept rich text or HTML? Decision: plain text only in v0; render as `textContent`, not `innerHTML`, to avoid injection and keep the contract simple.
- Should we expose a "hide on next scene reload" toggle for transient titles? Decision: no, out of scope; just clear the title field.
- Whether to add a quick-action macro to toggle visibility without editing the scene. Decision: not in this change; the `enable` toggle is the macro target for now.
