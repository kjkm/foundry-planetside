## 1. Tab template

- [x] 1.1 Create `templates/scene-config-tab.hbs` containing the tab content: a `<div class="tab" data-tab="planetside" data-group="main">` with a labeled checkbox `<input type="checkbox" name="flags.planetside.enabled">`
- [x] 1.2 Decide at render-time whether a short description line under the checkbox is needed; include it in the template if so

## 2. Tab injection

- [x] 2.1 Register a `renderSceneConfig` hook in `scripts/main.js` that runs on every scene config render
- [x] 2.2 In the hook, render the Handlebars template with the scene's current `flags.planetside.enabled` value
- [x] 2.3 Inject a tab nav `<a class="item" data-tab="planetside">Planetside</a>` into `.sheet-tabs`
- [x] 2.4 Append the rendered tab content as a sibling of the existing `.tab` elements
- [x] 2.5 Call `app.setPosition({ height: "auto" })` to let the sheet resize for the new content

## 3. Hot reload via updateScene hook

- [x] 3.1 Register an `updateScene` hook in `scripts/main.js`
- [x] 3.2 If the update's `changes` object contains `flags.planetside.enabled` and the updated scene's id matches `canvas.scene.id`, read the new flag value
- [x] 3.3 Call `controller.activate()` or `controller.deactivate()` as appropriate (these are already idempotent, no extra guards needed)

## 4. Documentation

- [x] 4.1 Update README to mention the scene config tab as the recommended activation path; keep the console API documented as the programmatic alternative for macros

## 5. Smoke testing in Foundry

- [x] 5.1 Open scene config, verify Planetside tab is present alongside other tabs
- [x] 5.2 Toggle the checkbox on, save, verify globe appears immediately on the current scene
- [x] 5.3 Toggle the checkbox off, save, verify globe disappears immediately
- [x] 5.4 Edit a non-current scene's config, toggle the checkbox, save, switch to that scene and verify it activates as expected
- [x] 5.5 Verify the existing `enableScene()` / `disableScene()` API still functions and reflects in the checkbox state on the next config open
