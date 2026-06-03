## Context

Planetside currently exposes activation only through a programmatic API (`game.modules.get("planetside").api.enableScene()`) that writes `flags.planetside.enabled` on the active scene and immediately calls the controller. Per-scene state is already stored as a flag — the missing piece is a discoverable surface for setting that flag.

Foundry V12's `SceneConfig` application is a tabbed sheet with a stable extension pattern: hook `renderSceneConfig`, inject a tab nav item and a tab content panel, and let Foundry's form-submit handler do the persistence. Form fields named `flags.<module-id>.<key>` are routed to the scene's flags automatically; no custom submit handler needed.

The change is small, but it introduces the project's first user-facing UI and the pattern that future per-scene tuning will follow.

## Goals / Non-Goals

**Goals:**
- A Planetside tab appears in `SceneConfig` for every scene.
- Inside it: one labeled checkbox bound to `flags.planetside.enabled`.
- Saving the scene config persists the flag and triggers re-evaluation of the live canvas's activation state if the saved scene is the current one.
- The existing `enableScene` / `disableScene` API continues to function for programmatic use.

**Non-Goals:**
- Per-scene tuning of any visual parameter (atmosphere color, sun direction, cap color, etc.).
- Module-level (`game.settings.register`) configuration for global aesthetic defaults.
- A scene-controls toolbar button for in-session toggling.
- Localization beyond the default English label (Foundry's localization machinery is available; we'll use it lightly but not invest in multi-language strings for v0 of this UI).

## Decisions

### Tab injected via `renderSceneConfig` hook

`renderSceneConfig` fires whenever the scene configuration sheet renders. We use the hook signature `(app, html, data)` to receive the application instance, a jQuery-wrapped DOM root, and the data context. We append a tab nav `<a>` to `.sheet-tabs` and a tab content `<div>` to the appropriate sibling, then call `app.setPosition()` to let the sheet resize for the new content.

Alternatives considered: subclass `SceneConfig` directly via `CONFIG.Scene.sheetClasses` (heavier, fights the rest of Foundry's UI ecosystem); a separate standalone modal (worse discoverability — defeats the point).

### Form field named `flags.planetside.enabled` for auto-persist

The checkbox input is `<input type="checkbox" name="flags.planetside.enabled" ...>`. Foundry's form parser handles the dot-notation routing into the scene document's `flags` object on submit. No custom submit hook needed.

If the flag is `true`, the input is rendered with `checked`. If false or absent, unchecked.

### Hot reload via `updateScene` hook

After form submission, Foundry emits an `updateScene` hook with `(scene, changes, options, userId)`. We listen for this and, if the changes object contains `flags.planetside.enabled` and the updated scene is the currently active canvas scene, we read the new flag value and call `controller.activate()` or `controller.deactivate()` accordingly.

This means the user does not have to reload the world or switch scenes after toggling — the change takes effect immediately.

For scenes other than the current one, the flag is persisted and will take effect the next time the scene is loaded (handled by the existing `canvasReady` hook).

### Tab template via a Handlebars file under `templates/`

The tab's HTML lives in a small file at `templates/scene-config-tab.hbs` rendered via `renderTemplate("modules/planetside/templates/scene-config-tab.hbs", { enabled: ... })`. This is conventional for Foundry modules and keeps the markup out of JS string literals.

Alternative considered: inline HTML string. Rejected for the same reason Foundry's convention exists — templates are easier to localize and reskin later.

### Existing API unchanged

`game.modules.get("planetside").api.enableScene()` and `disableScene()` continue to work as they do today. Both they and the new UI write the same flag; the same `updateScene` hook fires either way. The API is now most useful for macros and automation rather than as the only discoverable activation path.

## Risks / Trade-offs

- **Tab injection via hook is fragile across Foundry minor versions.** The DOM selectors (`.sheet-tabs`, the tab content sibling) could change. → Mitigation: keep the injection logic small and isolated; if Foundry changes the structure, we update one place. Document the targeted version (12.343).
- **`updateScene` hot reload races with Foundry's own canvas updates.** Rapid toggle-save-toggle-save sequences could interleave. → Mitigation: the controller's `activate()` and `deactivate()` are already idempotent (return early if already in the target state). No additional locking needed.
- **Modules that also extend `SceneConfig` (e.g., other tab-adding modules) may interact.** → Mitigation: append our tab last; don't assume specific neighbors. Use a stable, namespaced `data-tab` value (`planetside`).
- **The form field's `name="flags.planetside.enabled"` collides with no other module's flag (planetside is our namespace).** No risk here.

## Open Questions

- Should the tab include any explanatory text below the checkbox describing what activation does, or is the checkbox label sufficient? Decide at implementation time based on how the rendered tab looks — if it feels empty, add a one-sentence description; if it's clear enough, leave it.
- Whether to add an inline link from the tab to the module's README. Probably yes if it's a one-liner; defer if it requires more affordance.
- Whether the existing module-load `init` hook should also register a `getSceneConfigTabs` filter (a newer V12 alternative to `renderSceneConfig` for tab structure). If both work, prefer whichever is more stable across Foundry minor versions. Decide at implementation time.
