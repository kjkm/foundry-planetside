## Why

Today, enabling Planetside on a scene requires running `await game.modules.get("planetside").api.enableScene()` in the developer console. This is undiscoverable for anyone who doesn't already know the module exists, and unnecessarily friction-heavy even for users who do. Foundry's scene configuration modal is the canonical place for per-scene settings, and adding a Planetside tab there makes activation a normal one-click operation that any GM can find.

This change scopes to **just the on/off toggle**. Per-scene visual tuning (atmosphere color, sun direction, polar cap overrides) is deliberately not included; it can be added in a follow-up change once specific scenes start demanding it.

## What Changes

- Add a new tab labeled **Planetside** to the Foundry scene configuration sheet (`SceneConfig`), placed alongside the existing tabs (Basics, Grid, Vision, Lighting, etc.).
- The tab contains a single labeled checkbox: **Enable Planetside** (render this scene as a 3D globe).
- The checkbox is wired to the scene flag `flags.planetside.enabled` via its `name` attribute so Foundry's standard form-submit handler persists it automatically.
- When the scene config form is saved (`updateScene` hook), if the saved scene is the currently active canvas scene, the module re-evaluates its activation state: activate if the flag is now true and we're inactive, deactivate if the flag is now false and we're active. No reload required.
- The existing `enableScene()` / `disableScene()` API remains as a programmatic affordance (for macros, automation, etc.). The UI checkbox writes to the same flag the API does.

## Capabilities

### New Capabilities
- `scene-config-ui`: A Planetside tab in the Foundry scene configuration sheet, containing the enable checkbox bound to the scene's `planetside.enabled` flag.

### Modified Capabilities
- `globe-renderer`: The module SHALL react to scene-flag changes via the `updateScene` hook to activate or deactivate on the live canvas without requiring a scene reload.

## Impact

- Affects `scripts/main.js` (new hook registrations: `renderSceneConfig`, `updateScene`) and a small new template file for the tab's HTML.
- No changes to the rendering, input forwarding, overlay reanchoring, atmosphere, lens flare, or starfield code.
- No changes to `scripts/planetside.js`'s activate/deactivate semantics.
- The flag schema is unchanged — same `flags.planetside.enabled` key the current API uses.
- Documentation (README) updates to mention the UI tab in addition to (or in preference to) the console API.
