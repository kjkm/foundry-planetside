## Context

planetside targets Foundry v12 (`compatibility.maximum: "12"`). Foundry v13 is now the target (Lancer supports it; the dev install is migrated). Grounding done in the running v13 install:

- `game.release.generation === 13`, **`PIXI.VERSION === "7.4.3"`** — v13 deferred PIXI 8, so the canvas/capture/input code is unaffected.
- `SceneConfig` is **ApplicationV2**: `renderSceneConfig` passes a vanilla `HTMLElement`; `app.element instanceof HTMLElement`. Its tab markup:
  - nav: `<nav class="sheet-tabs tabs" data-application-part="tabs">` containing tab buttons `<a data-action="tab" data-group="sheet" data-tab="basics" class="active">…</a>`.
  - content: `<div class="tab scrollable" data-group="sheet" data-tab="basics" …>` sections, with a `<footer>` after them.
- jQuery is still bundled in v13 (`$` works), but AppV2 hands native DOM and the v1 markup/selectors differ.

## Goals / Non-Goals

**Goals:**
- planetside loads and functions on Foundry v13; v12 continues to work (dual support).
- The Scene Config "Planetside" tab appears and behaves on v13's AppV2 SceneConfig.
- All canvas features verified working on v13.

**Non-Goals:**
- PIXI 8 (not in v13).
- Converting planetside's own UI to ApplicationV2 (we have no AppV2 apps; we only inject into core's).
- Deep restyling of the tab content to match v13 AppV2 form aesthetics (functional parity only).
- Any canvas/capture/input rewrite.

## Decisions

### No canvas changes — PIXI 7.4.3 confirmed

`placeables.js`, `input.js`, `capture.js`, `scene.js` are untouched. The stage-neutralize capture, `getBounds`, `renderer.render({transform})`, `extract.canvas`, `FederatedPointerEvent`/`rootBoundary`, `enableTempParent` all remain PIXI-7 APIs. Verification is by smoke test, not code change.

### Scene Config tab injection: target v13 AppV2 markup, branch for v12

Rework `renderSceneConfig` to detect the framework and inject accordingly:
- **v13 / AppV2** (`element instanceof HTMLElement`): append a nav button `<a data-action="tab" data-group="sheet" data-tab="planetside"><i class="fa-solid fa-globe"></i><span>Planetside</span></a>` to `nav.sheet-tabs[data-application-part="tabs"]`, and a content section `<div class="tab" data-group="sheet" data-tab="planetside">…</div>` before `<footer>`. Use native DOM (`insertAdjacentHTML`/`append`). Rely on AppV2's built-in tab controller (it toggles `.active` for `[data-action="tab"]` clicks within a `data-group`).
- **v12 / AppV1** (jQuery): keep the existing injection (the current code).
- Detect via `element instanceof HTMLElement` (or `game.release.generation >= 13`).

- **Alternative — v13-only (drop v12)**: simpler (one path), but loses the v12 fallback install the user wanted during the transition. Dual support is cheap (the v12 path already exists). Revisit/drop v12 later if it becomes a burden.

### Verify AppV2 picks up the injected tab; bind a fallback if not

AppV2's tab controller is driven by a delegated listener on `[data-action="tab"]`; a button added to the DOM after render *should* be handled. If testing shows the injected tab doesn't switch (controller cached the original node list), bind a click handler that calls the app's tab-change API (`app.changeTab("planetside", "sheet")`) and toggles `.active` manually. Decide during apply based on observed behavior.

### Template helpers: prefer the v13 namespace with a fallback

Use `foundry.applications.handlebars.loadTemplates` / `renderTemplate` when present (v13), else the bare globals (v12). The globals still work on v13 but emit deprecation warnings.

### Overlay/HUD selectors audited, not assumed

`overlays.js` reanchors `#hud` / `#token-hud` (and `#tooltip`, `#chat-bubbles`). v13's Token HUD is AppV2 and the HUD DOM may have changed. This is verified by dumping the v13 HUD DOM during apply (open the Token HUD on the globe, inspect the elements) and fixing selectors / `canvas.hud.token.bind` usage as needed. Treated as a verify-and-fix task rather than a blind rewrite.

## Risks / Trade-offs

- **[AppV2 tab controller ignores dynamically-injected nav button]** → Fallback: bind a click handler calling `app.changeTab(...)`. Cheap to add if observed.
- **[v13 Token HUD DOM differs from v12]** → `overlays.js` HUD reanchoring (right-click HUD position) could be off or the IDs renamed. Mitigation: dump the v13 HUD DOM and fix selectors; the right-click HUD feature is the smoke-test that surfaces it.
- **[`renderSceneConfig` hook args/timing in AppV2]** → AppV2 render hooks fire with `(app, element, context)`; our 2-arg `(app, html)` still binds `html=element`. Confirm the hook fires post-render so the nav exists when we inject.
- **[verified build number]** → set `verified` to the actual installed v13 build during apply.
- **[Dual v12/v13 branch drift]** → two injection paths to maintain; acceptable and small, and the v12 path is frozen (existing code).

## Open Questions

- Keep v12 support, or go v13-only and simplify to one injection path? (Proposing dual; trivial to drop the v12 branch.)
- Does AppV2's tab controller pick up the injected tab natively, or do we bind `changeTab`? (Resolve by observation during apply.)
- Exact v13 Token HUD DOM (resolve by dumping during apply; affects `overlays.js`).
