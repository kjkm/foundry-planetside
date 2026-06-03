## Why

Today, when Planetside is active on a scene, the globe shows the scene's background image but none of the tokens that exist on the underlying flat scene. A GM can position goblins all over the map in flat mode, switch to globe mode, and see an empty planet. This change adds a token render layer so the same tokens appear as billboarded sprite icons at the corresponding sphere positions, with nameplates, mirroring the flat scene's token state in real time.

The underlying Foundry token document remains the source of truth. The globe is a second view over the same data. All Foundry-side behavior — vision rules, status effects, module integrations like Token Magic FX, Monk's Active Tiles, Token Action HUD — continues to operate against the real token; this change only adds a parallel visual layer in the Three.js scene.

This is **v0 of the feature: display only**. Clicking, drag-to-place from sidebar, drag-to-move, right-click context menus, and other token interactions on the globe are explicitly out of scope. The GM continues to use flat mode for interaction and globe mode for cinematic display. Adding interaction on the globe is a separate future change that builds on the rendering layer this change establishes.

## What Changes

- Add a new module `scripts/tokens.js` exporting a `TokenLayer` class that owns per-token rendering state.
- On `Planetside.activate()`, instantiate the `TokenLayer`, install it (build sprites for every token already on `canvas.tokens.placeables`), and add it to the per-frame update loop.
- Each token gets:
  - A `THREE.Sprite` with the token's `texture.src` as its material map, positioned at the sphere surface point corresponding to the token's `(x, y)` via Mercator forward projection, at a slight radial offset (1.001) to avoid z-fighting with the body.
  - A DOM `<div>` nameplate in the canvas host element, repositioned each frame via the same forward-projection-to-screen math the existing `overlays.js` uses for the token HUD.
- Sprites and nameplates SHALL:
  - Update on `updateToken` hook (position, texture, scale, name, visibility, rotation).
  - Be created on `createToken` hook (load texture, add to scene, add nameplate).
  - Be removed and disposed on `deleteToken` hook.
  - Be hidden when `token.visible` is false (per-player vision rules).
  - Be hidden when the token's anchor projects to the occluded hemisphere from the camera's viewpoint (same `isFacingCamera` check the existing overlay-reanchoring uses).
- The `TokenLayer` is torn down in `Planetside.deactivate()`: all sprites disposed, all nameplates removed.
- No changes to camera, atmosphere, lighting, lens flare, starfield, input forwarding, overlay-reanchoring, or scene capture.

## Capabilities

### New Capabilities
- `token-layer`: Render Foundry tokens as billboarded sprites with DOM nameplates on the globe at positions corresponding to their flat-scene coordinates, reactive to Foundry's token data via lifecycle hooks.

### Modified Capabilities
<!-- No existing specs are modified by this change. -->

## Impact

- New `scripts/tokens.js`.
- `scripts/planetside.js`: instantiates and tears down the `TokenLayer` as part of activate/deactivate; calls its `update()` from `_frame()`.
- `scripts/main.js`: forwards `createToken`, `updateToken`, `deleteToken` hooks to `controller.tokenLayer` while the controller is active on the current scene.
- No changes to camera, atmosphere, scene rendering, lighting, lens flare, starfield, input, or overlays infrastructure.
- The token texture image files are loaded once per token via `THREE.TextureLoader`. Tokens that fail to load (broken or missing image) render with a placeholder sprite so they don't disappear silently.
- Interaction on the globe (click-to-select, drop-to-place, drag-to-move) remains explicitly out of v0 scope and is intentionally documented as the next step in this feature line.
