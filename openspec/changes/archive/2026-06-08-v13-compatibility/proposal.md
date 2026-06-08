## Why

The Lancer system now supports Foundry VTT v13, and the local dev environment has been migrated to v13. planetside currently declares `compatibility.maximum: "12"`, so v13 disables it outright. We need the module to load and work on v13. Crucially, **v13 stays on PIXI 7** (7.4.3 confirmed in the running install) — Foundry deferred the PIXI 8 migration — so the entire Three.js capture pipeline and input forwarding are unaffected. The work concentrates in Foundry's **ApplicationV2** migration (Scene Config) and a manifest bump.

## What Changes

- **module.json**: widen `compatibility` to `{ minimum: "12", verified: "13", maximum: "13" }` so v13 loads it (and v12 still works).
- **Scene Config tab injection (`main.js`)**: v13's `SceneConfig` is now ApplicationV2 — `renderSceneConfig` hands a vanilla `HTMLElement`, and the markup changed. Rework the injection to target the v13 structure: nav button `<a data-action="tab" data-group="sheet" data-tab="planetside">` and content `<div class="tab" data-group="sheet" data-tab="planetside">`, relying on AppV2's native tab controller instead of our custom show/hide. Branch on AppV1 (v12) vs AppV2 (v13) so both Foundry versions work.
- **Template helpers**: use `foundry.applications.handlebars.loadTemplates/renderTemplate` on v13 (the bare globals are deprecated shims), with a fallback to the globals for v12.
- **Overlay/HUD selector audit (`overlays.js`)**: v13's Token HUD is AppV2; verify the `#hud` / `#token-hud` / `#tooltip` reanchoring selectors and `canvas.hud.token.bind` still behave, and fix if the DOM changed.
- **Smoke-test** the canvas features on v13 (expected to pass on PIXI 7): globe render, token/tile capture, token select/HUD/sheet, tile click/right-click MATT triggers.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `scene-config-ui`: the "Planetside tab appears in scene config" requirement is restated to be framework-agnostic (works under both AppV1 and the v13 AppV2 SceneConfig), integrating with the sheet's native tab navigation rather than a custom mechanism. Tab *behavior* is unchanged.

## Impact

- **Code:** `module.json` (compatibility), `scripts/main.js` (AppV2 tab injection + template-helper namespace), `scripts/overlays.js` (HUD/overlay selector audit), `README.md` (compatibility note). No changes to the canvas/capture/input code — PIXI 7.4.3 on v13.
- **Compatibility:** targets v13 while preserving v12 (minimum 12, maximum 13), so the v12 fallback install keeps working.
- **Dependencies:** none new. Monk's Active Tiles is v13-verified, so tile-trigger testing is intact on v13.
- **Risk concentration:** AppV2 DOM surfaces (Scene Config tab, HUD/overlay reanchoring), not the canvas.
