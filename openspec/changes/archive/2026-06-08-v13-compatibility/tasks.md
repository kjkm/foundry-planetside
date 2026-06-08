## 1. Manifest

- [x] 1.1 `module.json` compatibility → `{ minimum: "12", verified: "13", maximum: "13" }` (set `verified` to the exact installed build if desired)
- [x] 1.2 Module enables on v13 without the incompatibility block — confirmed

## 2. Template helpers

- [x] 2.1 `main.js` `loadTpl`/`renderTpl` helpers route through `foundry.applications.handlebars.*` when present, falling back to the globals; `init` and `renderSceneConfig` use them

## 3. Scene Config tab injection (ApplicationV2)

- [x] 3.1 `renderSceneConfig` branches on `html instanceof HTMLElement` (AppV2/v13) vs jQuery (AppV1/v12); `_injectPlanetsideTabV1` preserves the existing v12 path
- [x] 3.2 `_injectPlanetsideTabV2` (native DOM): appends the `<a data-action="tab" data-group="sheet" data-tab="planetside">` nav button and the content section after the last `div.tab[data-group="sheet"]` (else before `<footer>`)
- [x] 3.3 Reuses the existing template via `renderTpl`, remapping the wrapper's `data-group` from `"main"` → `"sheet"`; field `name`s stay `flags.planetside.*`
- [x] 3.4 Injected tab switches via AppV2's native tab controller — confirmed (no manual `changeTab` binding needed)
- [x] 3.5 Double-injection guarded (`root.querySelector('[data-tab="planetside"]')`)

## 4. Overlay / HUD audit on v13

- [x] 4.1 v13 HUD reanchoring verified working (right-click HUD lands on the globe token); no `overlays.js` selector changes needed — the `#hud`/`#token-hud` DOM held across AppV2
- [x] 4.2 `canvas.hud.token.bind` + reanchor confirmed on v13 (right-click HUD works)
- [x] 4.3 `#tooltip` / `#chat-bubbles` reanchoring resolves on v13

## 5. Smoke testing on v13 (PIXI 7.4.3 — passed)

- [x] 5.1 Globe renders (background, atmosphere, starfield, camera orbit) — confirmed
- [x] 5.2 Tokens render via capture (image filled, border on select, status icons) — confirmed
- [x] 5.3 Tiles render via capture; image tiles appear — confirmed
- [x] 5.4 Token interaction: select / deselect / right-click HUD / double-click sheet — confirmed
- [x] 5.5 Tile MATT triggers (click / double / right / double-right) fire — confirmed
- [x] 5.6 Scene Config Planetside tab: appears, switches, enable toggle + title-overlay fields persist — confirmed
- [ ] 5.7 v12 dual-support regression — NOT re-tested (v12 injection path is the unchanged original code; low risk). Verify if/when a v12 fallback is needed.

## 6. Docs

- [x] 6.1 README states v12 + v13 support; notes PIXI 7 on both and the unchanged canvas path
