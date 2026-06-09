## 1. Fix

- [x] 1.1 `scripts/overlays.js` `_reanchorTokenHud`: resolve the HUD root robustly — `const raw = tokenHud.element; const el = (raw instanceof HTMLElement ? raw : raw?.[0]) ?? document.querySelector("#token-hud");` (never `form[0]`)

## 2. Verify

- [x] 2.1 v13: right-click a token on the globe → the Token HUD appears centered over the token (not lower-right), tracks it while orbiting, and hides on the far hemisphere
- [x] 2.2 The HUD renders full-size (our `translate(-50%,-50%)` replaces Foundry's `scale`), and its buttons still work (control-icons, bars, status effects)
- [x] 2.3 (If v12 available) the HUD still reanchors correctly there
- [x] 2.4 `openspec validate fix-token-hud-v13 --strict`
