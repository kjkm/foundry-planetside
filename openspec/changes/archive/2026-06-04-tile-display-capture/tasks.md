## 1. Factor the shared PlaceableLayer base

- [x] 1.1 Extract the common machinery from `TokenLayer` into a `PlaceableLayer` base (`scripts/placeables.js`): entries map, dirty flag, `install`/`update`/`destroy`, stage-neutralized `_captureDirty`, `_captureOne`, `_unionRect`, tangent-frame positioning in `_updateEntry`, per-frame capture budget
- [x] 1.2 Define the subclass extension points: `_collection`, `_meshOf`, `_isVisible`, `_radius`, `_renderOrder`, `_centerScene`, `_decorationObjects`, `_hiddenDuringCapture`, and `_onEntry*`/`_showExtras`/`_hideExtras` for per-type extras
- [x] 1.3 Re-base `TokenLayer` onto `PlaceableLayer`, moving token-only logic (decorations, DOM nameplate, `entry.token` alias for input.js) into overrides; observable behavior preserved
- [x] 1.4 Re-run token smoke tests (image renders, border on select, status icons, orientation) — confirmed no regression from the base refactor

## 2. TileLayer

- [x] 2.1 Add `scripts/tiles.js` with `TileLayer extends PlaceableLayer`: source = `canvas.tiles.placeables`, center = `(doc.x + doc.width/2, doc.y + doc.height/2)` (tile dims are pixels), size from `tile.mesh`, visibility from `tile.visible`
- [x] 2.2 Image-only capture (no decorations, no nameplate) — relies on the base `_captureOne` image path with `_decorationObjects`/`_hiddenDuringCapture` defaulting to `[]`
- [x] 2.3 Tile radius `1.0006` (above body, below tokens) + `_renderOrder` 0 so tiles sit beneath tokens; confirm visually in smoke test
- [x] 2.4 Tiles with no `mesh` are guarded (capture returns early, stays hidden). Decision: render all `tile.visible` tiles (no overhead/foreground filtering for v1)

## 3. Hooks and controller wiring

- [x] 3.1 In `scripts/main.js`, added `createTile`/`updateTile`/`refreshTile`/`deleteTile` hooks routing to `controller.tileLayer`, gated on the active scene
- [x] 3.2 In `scripts/planetside.js`, instantiate + `install()` `TileLayer` in `activate()`, `update()` in the per-frame tick, `destroy()` in `deactivate()`

## 4. Smoke testing in Foundry

- [x] 4.1 Activate Planetside on a scene with tiles; verify each visible tile appears on the globe at the correct position, image filled (not outlined) — confirmed with an image tile (imageless MATT trigger regions correctly render nothing)
- [ ] 4.2 Move/resize a tile on the flat map; verify the globe mesh tracks on the next frame
- [ ] 4.3 Create and delete a tile; verify it appears/disappears on the globe
- [ ] 4.4 Hide a tile (and view as a non-GM, or check `tile.visible`); verify it is not rendered
- [ ] 4.5 Orbit so a tile is near the limb / on the far hemisphere; verify occlusion works (note flat-quad curvature on any large tiles as the known limitation)
- [ ] 4.6 Deactivate Planetside; verify no tile meshes/textures leak
- [x] 4.7 Confirm tokens still render correctly (regression check after the base refactor) — confirmed

## 5. Docs

- [x] 5.1 Added a "Tile layer" subsection to the README: tiles render via the same capture pipeline; noted non-goals (interaction, large-tile curvature, video, overhead/occlusion)
