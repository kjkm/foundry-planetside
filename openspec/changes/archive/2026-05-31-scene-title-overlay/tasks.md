## 1. Scene config tab fields

- [x] 1.1 Extend `templates/scene-config-tab.hbs` with `Title` text input bound to `flags.planetside.title`
- [x] 1.2 Add `Title font` select with the curated font family options bound to `flags.planetside.titleFont`
- [x] 1.3 Add `Title size` number input (px, min 8, max 120) bound to `flags.planetside.titleSize`
- [x] 1.4 Add `Subtitle` text input bound to `flags.planetside.subtitle`
- [x] 1.5 Add `Subtitle font` select (same options) bound to `flags.planetside.subtitleFont`
- [x] 1.6 Add `Subtitle size` number input bound to `flags.planetside.subtitleSize`
- [x] 1.7 Add `Corner` select (`Top-Left`/`Top-Right`/`Bottom-Left`/`Bottom-Right`) bound to `flags.planetside.titleCorner`
- [x] 1.8 In `renderSceneConfig` hook, populate template context with current flag values + defaults so each field pre-fills correctly on open

## 2. Title overlay module

- [x] 2.1 Create `scripts/title.js` exporting a `TitleOverlay` class
- [x] 2.2 Constructor takes `{ hostElement }`; `install()` creates the container `<div>` with absolute positioning + z-index, plus title and subtitle child `<div>`s; appends container to host
- [x] 2.3 `update(flags)` method sets text via `textContent`, applies font/size/corner from flags (with defaults), hides empty title/subtitle elements via `display: none`
- [x] 2.4 `destroy()` removes the container from the DOM
- [x] 2.5 Apply CSS styling: white color, multi-stop text shadow, font-weight, no pointer events

## 3. Wire into Planetside controller

- [x] 3.1 In `scripts/planetside.js`, instantiate `TitleOverlay` in `activate()`, call `install()` then `update(currentFlags)`
- [x] 3.2 Read all seven title-related flags from `canvas.scene.flags.planetside` in a small helper
- [x] 3.3 Tear down via `titleOverlay.destroy()` in `deactivate()`

## 4. Hot reload on `updateScene`

- [x] 4.1 In `scripts/main.js`, extend the existing `updateScene` hook: if the updated scene is current and `flags.planetside` is in the change object (any sub-key), call `controller.refreshTitle()`
- [x] 4.2 Add `refreshTitle()` method to `Planetside` that reads current flags and calls `titleOverlay.update()` if active
- [x] 4.3 Confirm that enable-flag changes still go through full activate/deactivate (titleOverlay torn down with the rest)

## 5. Docs

- [x] 5.1 Update README with a brief note about title/subtitle settings in the scene config tab

## 6. Smoke testing in Foundry

- [x] 6.1 Open scene config → Planetside tab; verify all new fields are visible and pre-fill with defaults
- [x] 6.2 Set title only, save; verify it appears in the top-left corner of the canvas in the default font/size
- [x] 6.3 Set subtitle only, save; verify it appears in the top-left corner with no title above it
- [x] 6.4 Change corner to `Bottom-Right`, save; verify both elements move to the bottom-right
- [x] 6.5 Change fonts and sizes, save; verify the overlay updates without reload
- [x] 6.6 Clear both fields, save; verify no overlay is present
- [x] 6.7 Deactivate Planetside via the enable checkbox; verify the overlay disappears with the globe view
