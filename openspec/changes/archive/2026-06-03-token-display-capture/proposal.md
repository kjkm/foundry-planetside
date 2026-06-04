## Why

Tokens on the globe today render only their **image** (`doc.texture.src` on a single plane). All the decorations Foundry draws on a flat token — the selection/control border, status-effect icons, resource bars, target reticles, and anything modules add — are missing. Re-implementing each decoration as bespoke 3D geometry would accrue endless reimplementation debt and never cover module-drawn extras. Instead we flip the token pipeline to **mirror Foundry's own token rendering** by capturing the live `Token` display object to a texture — the same "re-render the real battlemap" philosophy already used for the background, now applied per token. One mechanism yields border + icons + bars + targets + module extras, always in sync.

## What Changes

- **BREAKING (internal):** Replace the per-token image-load pipeline (`THREE.TextureLoader` + shared URL `textureCache`) with a **display-capture** pipeline: `canvas.app.renderer.generateTexture(token)` → pixel extract → per-token owned `CanvasTexture` mapped onto the existing plane mesh. The image arrives as a byproduct of the capture (it is the token's `mesh` child).
- Capture **coalesced on `refreshToken`** (Foundry's "this token's display changed" signal) plus existing create/update/delete hooks; a per-entry dirty flag re-captures at most once per frame per token (mirrors `capture.js`'s dirty model).
- **Selection/control border** and **status-effect icons** now appear on globe tokens automatically, because they are children of the captured `Token` container.
- **Rotation is baked into the capture**; the sprite's `rotateZ` is removed. Each plane is oriented from an explicit **surface tangent frame** (local-up = meridian/north, local-right = east) so square borders and the vertical icon column align consistently around the sphere instead of rolling with `lookAt`'s undefined roll.
- **Anchoring** accounts for asymmetric bounds: the effect column / bars expand the captured bounds past the token footprint, so the plane is offset to keep the token *center* on its sphere point.
- **Nameplate** is excluded from the capture (Foundry's `token.nameplate` hidden during render) so the existing billboarded DOM nameplate remains the single, legible name source.
- Per-token texture lifecycle: owned texture + pooled render target, disposed on re-capture and on token removal (the shared URL refcount cache is retired).

Deferred (explicitly out of scope): hover-border (our semantic input never sets flat `token.hover`); bars/targets redrawn as billboarded DOM (they bake flat for now); shared-WebGL-context zero-copy capture (same optimization already deferred for the background).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `token-layer`: tokens render by mirroring the captured `Token` display object (border, status icons, bars, etc.) instead of only the image; rotation baked; orientation from a surface tangent frame; re-capture driven by `refreshToken`.

## Impact

- **Code:** `scripts/tokens.js` (rendering pipeline rewrite); `scripts/scene.js` (tangent-frame orientation helper); reuse of the PIXI→texture capture pattern from `scripts/capture.js`; `scripts/main.js` (ensure `refreshToken` hook reaches the layer).
- **Dependencies:** none new — uses Foundry's `renderer.generateTexture` / `renderer.extract` and the existing Three.js vendor.
- **Performance:** introduces a GPU→CPU→GPU readback per token *per change* (not per frame); cheap for typical token counts, with mass-simultaneous-movement as the stress case to watch (throttle if needed).
- **Behavior:** no change to the 2D scene (still source of truth); globe token visuals become a faithful mirror of the flat token, including module-drawn decorations.
