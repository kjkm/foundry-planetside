## 1. Token layer module

- [x] 1.1 Create `scripts/tokens.js` exporting a `TokenLayer` class
- [x] 1.2 Constructor takes `{ scene3d, mercator, hostElement }`; track `Map<tokenId, { token, sprite, nameplate, textureKey }>`
- [x] 1.3 `install()` enumerates `canvas.tokens.placeables` and calls `addToken(token)` for each
- [x] 1.4 `addToken(token)`: load texture (with placeholder fallback), create sprite, position via Mercator, add nameplate `<div>`, push entry into the map
- [x] 1.5 `updateToken(token, changes)`: re-read fields, update sprite position / scale / rotation / opacity / texture / nameplate text / visibility flags as appropriate
- [x] 1.6 `removeToken(token)`: remove sprite from scene, dispose material + texture (only if texture is not shared), remove nameplate element from DOM, drop map entry
- [x] 1.7 `update()` per-frame: for each entry, recompute sphere world position from current token coords, set sprite position, project to screen for nameplate placement, evaluate visibility (vision + occlusion + `displayName != NONE`), apply display style
- [x] 1.8 `destroy()`: iterate all entries and call `removeToken` for each, then clear the map

## 2. Sprite and nameplate styling

- [x] 2.1 Sprite material: `THREE.SpriteMaterial` with token texture, `transparent: true`, `depthTest: true`, `depthWrite: false`
- [x] 2.2 Sprite scale derived from `(token.width × grid.size / sceneWidth) × TOKEN_SIZE_BASE` constant; tune `TOKEN_SIZE_BASE` for legibility at default camera distance
- [x] 2.3 Sprite positioned at radius 1.001 from sphere center to avoid z-fighting
- [x] 2.4 Nameplate `<div>` styling: white text, drop shadow (consistent with title.js), small font size, `pointer-events: none`, `position: fixed`, low z-index so Foundry chrome wins

## 3. Texture loading

- [x] 3.1 Build a per-`TokenLayer` texture cache keyed by `texture.src`; shared across tokens with the same image
- [x] 3.2 Use `THREE.TextureLoader` with success and error callbacks
- [x] 3.3 On error, generate a placeholder canvas texture (colored disc with first letter of token name); attach to sprite material
- [x] 3.4 Dispose textures only when no remaining token references them (refcount in the cache)

## 4. Hook integration

- [x] 4.1 In `scripts/main.js`, register `Hooks.on("createToken", ...)`: if controller is active and scene matches, call `controller.tokenLayer.addToken(tokenDocument.object)`
- [x] 4.2 Same for `updateToken` → `tokenLayer.updateToken(token, changes)`
- [x] 4.3 Same for `deleteToken` → `tokenLayer.removeToken(token)`
- [x] 4.4 Guard each handler so a non-active controller does nothing

## 5. Controller wiring

- [x] 5.1 In `scripts/planetside.js`, instantiate `TokenLayer` in `activate()` after `scene3d.init()` and call `install()`
- [x] 5.2 Call `tokenLayer.update()` from `_frame()` alongside `scene3d.render()` and `overlays.update()`
- [x] 5.3 Call `tokenLayer.destroy()` in `deactivate()` and null the reference
- [x] 5.4 Expose `controller.tokenLayer` so `main.js` hook handlers can reach it

## 6. Docs

- [x] 6.1 Update README with a brief note about tokens appearing on the globe (display only in v0)

## 7. Smoke testing in Foundry

- [x] 7.1 Activate Planetside on a scene with several tokens; verify each token appears as a sprite at the correct sphere position
- [x] 7.2 Drag a token around the flat scene; verify the corresponding sprite re-positions on the globe
- [x] 7.3 Create a new token via drag-from-sidebar on the flat scene; verify it appears on the globe
- [x] 7.4 Delete a token on the flat scene; verify the sprite disappears from the globe
- [x] 7.5 Toggle a token's hidden flag (GM-only); verify behavior matches expectation for GM and player views
- [x] 7.6 Verify nameplates appear / track / hide correctly
- [x] 7.7 Orbit camera so tokens pass to the far hemisphere; verify occlusion
- [x] 7.8 Deactivate Planetside; verify all sprites and nameplates are removed
