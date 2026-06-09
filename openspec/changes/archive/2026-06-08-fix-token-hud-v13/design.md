## Context

`OverlayReanchor._reanchorTokenHud()` (in `scripts/overlays.js`) repositions Foundry's Token HUD over the globe token each frame:

```js
const el = tokenHud.element?.[0] ?? document.querySelector("#token-hud");
```

This was written for v12, where `canvas.hud.token.element` is a jQuery object and `[0]` unwraps to the DOM node. The project later migrated to v13 (ApplicationV2), where `.element` is the **HTMLElement** directly — and the Token HUD root is a `<form id="token-hud">`. A `<form>` exposes its controls by index, so `form[0]` is its **first field** (the `elevation` input), which is truthy — so the `?? "#token-hud"` fallback never runs.

Confirmed from the live v13 DOM the user captured:

```
<form id="token-hud" style="left:1600px; top:1025px; transform: scale(0.25);">   ← Foundry's values (untouched)
  <input name="elevation" style="position:absolute; left:723px; top:713px;
                                 transform: translate(-50%,-50%);">              ← OUR reanchor styles (wrong node)
```

So the projection, the guard (`rendered`/`object`), and the `#token-hud` id are all fine — only `.element?.[0]` resolves wrong under v13. Pings, which reanchor through the identical `sceneToScreen → projectWorldToScreen → _reanchorElement` path, position correctly, corroborating that the fault is isolated to HUD element resolution.

## Goals / Non-Goals

**Goals:**
- The Token HUD reanchors over the globe token on v13 (and remains correct on v12).
- Resolve the HUD **root** element, never a descendant.

**Non-Goals:**
- Any change to projection, the guard, or other overlays (chat bubbles/tooltip already use `querySelector`).
- Broader v13 HUD restyling.

## Decisions

### D1: Version-robust element resolution

Resolve `.element` accounting for both shapes, falling back to the stable id:

```js
const raw = tokenHud.element;
const el = (raw instanceof HTMLElement ? raw : raw?.[0]) ?? document.querySelector("#token-hud");
```

- v12: `raw` is jQuery (not an `HTMLElement`) → `raw?.[0]` → the DOM node.
- v13: `raw` is the `<form>` HTMLElement → used directly (never `form[0]`).
- Fallback: `#token-hud` (id is stable across both versions, per the captured DOM).

Alternative considered: `document.querySelector("#token-hud")` only. Simpler and would work, but going through `.element` first respects Foundry's own handle to the HUD (more robust if multiple/!default HUDs ever exist); the `instanceof` guard costs nothing.

### D2: Keep overwriting `transform`

`_reanchorElement` sets `transform: translate(-50%,-50%)`, replacing Foundry's `scale(...)`. That is intended on the globe (HUD shown full-size, centered on the token, not flat-canvas-zoom-scaled). No change.

## Risks / Trade-offs

- **[Other Foundry versions shape `.element` differently again]** → the `instanceof HTMLElement` branch plus the `#token-hud` id fallback covers both known shapes and degrades to the id lookup otherwise. Low risk.
- **[The HUD root id changes in a future Foundry]** → would break the fallback, but `.element` (the primary path) would still resolve; revisit if Foundry changes it.
