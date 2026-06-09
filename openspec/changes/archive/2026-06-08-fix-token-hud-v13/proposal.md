## Why

On Foundry v13, right-clicking a token on the globe opens the Token HUD in the **lower-right corner** instead of over the token. The HUD reanchor (`OverlayReanchor._reanchorTokenHud`) is v12-era and resolves the HUD element with `canvas.hud.token.element?.[0]`. Under v12 `.element` is a jQuery object so `[0]` is the HUD DOM node; under v13 `.element` is the **HTMLElement** itself — a `<form id="token-hud">` — and `form[0]` returns the form's **first field** (the `elevation` input). So the module reanchors the wrong node: the input gets our `translate(-50%,-50%)` styles while the actual `#token-hud` form keeps Foundry's flat-canvas position (`left:1600 top:1025 scale(0.25)`) and lands lower-right. Confirmed from the live v13 DOM.

This is a latent v13 incompatibility from the migration, surfaced now. The projection itself is fine (pings reanchor through the same path and work); only the HUD element resolution is wrong.

## What Changes

- **Resolve the Token HUD root element robustly across Foundry versions.** `_reanchorTokenHud` SHALL target the HUD root (the `#token-hud` form), handling both v12 (jQuery-wrapped `.element[0]`) and v13 (ApplicationV2 `.element` as an HTMLElement), and never a descendant field. One-line fix in `scripts/overlays.js`.
- Side effect (desired): once the form is the target, our reanchor's `transform: translate(-50%,-50%)` replaces Foundry's `scale(...)`, so the HUD renders full-size centered on the token (the intended globe behavior) rather than zoom-scaled.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities

- `overlay-reanchoring`: Clarify the DOM-overlay reanchoring requirement so the Token HUD element is resolved at the HUD **root** across Foundry v12/v13 (jQuery `.element[0]` vs ApplicationV2 `.element` HTMLElement), not a descendant. Behavior-preserving relative to the original intent; closes the v13 gap.

## Impact

- **Code:** `scripts/overlays.js` — `_reanchorTokenHud` element resolution (one line). No other call site uses the `.element?.[0]` pattern (chat bubbles and tooltip already use `querySelector`).
- **Risk:** minimal; the fix only changes which element is selected. Verify the HUD now tracks the token on v13 (and still works on v12 if available).
- **Dependencies:** none.
