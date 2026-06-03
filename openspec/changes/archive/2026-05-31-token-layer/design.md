## Context

Planetside currently renders the scene's static background image on a sphere. The flat scene continues to run underneath, with its full token / wall / lighting / module pipeline, but none of that is reflected on the globe. The goal of this change is to project just the token layer onto the globe — not via PIXI capture, but by reading from Foundry's token data model directly and rendering tokens as our own Three.js objects.

Tokens are a particularly good fit for this approach because they are discrete, addressable objects (one document per token) with well-defined Foundry lifecycle hooks. We don't need to invent a capture pipeline; we subscribe to the hooks Foundry already provides and rebuild from the document state.

The math primitives required already exist in the codebase:
- `Mercator.latLonToSpherePoint(lat, lon, radius)` for placing sprites on the sphere.
- `Mercator.uvToLatLon` and the scene's `sceneRect`-based UV math (used by `overlays.js`) for translating from `(x, y)` scene coordinates to `(lat, lon)`.
- `Scene.projectWorldToScreen(point)` for forward-projecting sphere points to screen coordinates (used by `overlays.js` for the existing token HUD reanchoring).
- `Scene.isFacingCamera(point)` for determining if a sphere point is on the visible hemisphere.

This change assembles these primitives into a token-specific rendering layer. It does not modify any of them.

## Goals / Non-Goals

**Goals:**
- Tokens that exist on a Planetside-active scene appear as billboarded sprite icons at the corresponding sphere position when globe mode is on.
- DOM nameplates appear below each visible sprite when Foundry's `displayName` setting permits, anchored each frame to the sprite's screen position.
- The render layer is reactive: token create / update / delete events on the underlying scene immediately propagate to the globe view without polling.
- Tokens hidden by per-player vision rules (`token.visible === false`) are not rendered.
- Tokens whose sphere position is on the far (occluded) hemisphere from the camera are hidden each frame.
- The Foundry token document remains the authoritative source; we never store any token state.

**Non-Goals (v0):**
- Token interaction on the globe (click-to-select, drag-to-move, drop-from-sidebar, right-click context menus, hover tooltips, drag-preview).
- Status effect icons stacked on / around the sprite (in flat Foundry these appear as floating icons around the token; we render only the base token texture in v0).
- Target indicators or targeting affordances.
- Token bars (HP, resources) shown below the token in flat Foundry.
- Combat tracker integration visuals (turn indicator, etc.).
- Animation / interpolation between positions on update (instant snap on each update event for v0).
- Performance optimization beyond the straightforward implementation.

## Decisions

### Per-token Three.js Sprite, billboarded to camera

Each rendered token is one `THREE.Sprite` with `THREE.SpriteMaterial` (`map = token texture`, `transparent: true`, `depthTest: true`, `depthWrite: false`). Sprites natively billboard to the camera in Three.js, which is the "icons on a map" look we want. No custom shader; standard `SpriteMaterial`.

Alternatives considered:
- Tangent-plane meshes (sprites laid flat on the surface) → rejected: less readable as the camera rotates; reserve for the eventual 3D-token feature.
- Custom shader for additional effects (outlines, glow) → not v0; can be added later by switching to `ShaderMaterial`.

### Sprite positioned at radius 1.001

The body sphere is at radius 1.0. Placing sprites at exactly 1.0 z-fights with the body fragment. A small radial offset (1.001) puts them just outside, visible without artifacts, with the depth buffer correctly occluding far-side sprites with the body.

### Sprite scale derived from token document dimensions

The token's `width` × `height` in Foundry units (typically 1, 2, 3 grid cells) is mapped to a sprite scale in world units. The reference equation:

```
spriteScale = (token.width × grid.size / sceneWidth) × TOKEN_SIZE_BASE
```

Where `TOKEN_SIZE_BASE` is a tunable constant (e.g., 0.4) chosen so a 1×1 token on a typical scene looks like a recognizable map pin at default camera distance. `sizeAttenuation: true` (the Sprite default) — tokens get larger as the camera zooms in, as expected.

### Texture loading via `THREE.TextureLoader`, with a placeholder fallback

Each token's `texture.src` is loaded asynchronously via `THREE.TextureLoader`. On success, attach to the sprite material. On failure (404, broken image, missing file), substitute a procedurally-generated placeholder texture (a colored disc with the first character of the token's name) so the token still appears at its correct sphere position even when its art is broken.

Loaded textures are cached per `texture.src` URL across tokens — multiple instances of the same actor share one Three.js texture.

### DOM nameplate as a sibling of the canvas

Each token has a single `<div>` nameplate appended to the canvas host element (same host the Three.js canvas lives in). Styling (white text, drop shadow, font, size) follows the same pattern as `title.js` so nameplates and titles look consistent.

Each frame, the nameplate's `left` / `top` are computed from the sprite's world position projected to screen via `Scene.projectWorldToScreen`. The element's `display` is set to `none` when the token is hidden (vision, occlusion, or `displayName: NONE`).

Whether a nameplate shows is determined by Foundry's standard `token.displayName` setting (always, always for owner, hovered, hovered for owner, never), evaluated using `token.actor` ownership where applicable. For v0 we treat any non-`NONE` setting as "always show"; finer-grained behavior is a follow-up.

### Reactivity via Foundry hooks

```
   Foundry hook            What we do
   ────────────────        ─────────────────────────────────────
   canvasReady             enumerate canvas.tokens.placeables,
                           build initial sprites + nameplates
                           (handled implicitly via Planetside's
                           own canvasReady → activate flow)

   createToken             load texture, create sprite + nameplate,
                           position from token.x, token.y

   updateToken             re-read all relevant fields from token
                           document; re-position, re-style, re-text.
                           Position changes: recompute sphere point.
                           Texture changes: load new texture.
                           Hidden / visible toggles: hide/show.

   deleteToken             remove sprite from scene, dispose its
                           geometry/material/texture, remove nameplate
                           DOM element
```

Hook handlers live in `main.js` (alongside the existing module-wide hooks) and forward to `controller.tokenLayer` if the controller is active and on the affected scene.

### Per-frame update

`TokenLayer.update()` is called from `Planetside._frame()`. Each frame, for every tracked token:
- Compute sphere world position from the (possibly updated) token coords.
- Set sprite position.
- Project sprite world position to screen for nameplate placement.
- Evaluate visibility (`token.visible` + facing-camera check + non-empty nameplate text).
- Hide or show sprite and nameplate accordingly.

This is intentionally simple: re-evaluate every frame rather than diffing. For typical token counts (under ~50 per scene), the cost is trivial.

### Mounted in the existing Three.js scene, not a separate scene

Sprites are added to `Scene.scene` (the main 3D scene) alongside the planet body, atmosphere, lens flare, etc. Depth-testing them against the body gives free far-side occlusion.

Alternative considered: separate overlay scene rendered after the main scene. Rejected — would lose body-occlusion for free, and we'd have to compute occlusion manually.

### Vision visibility filtering

A token's `token.visible` property is computed by Foundry's vision system per player and reflects whether the local user is allowed to see this token. We respect it directly:

```
   if (!token.visible) hide sprite and nameplate
```

GMs see everything (Foundry sets `visible: true` for them on all tokens). Players see only what their tokens' vision reveals. No additional code needed beyond reading `token.visible`.

### `displayName` evaluation: simplified for v0

Foundry has five `displayName` modes (`NONE`, `OWNER`, `HOVER`, `OWNER_HOVER`, `ALWAYS`). v0 treats it as a binary: anything other than `NONE` shows the nameplate when the token is visible. `HOVER` and `OWNER_HOVER` semantics (only show when mouse hovers) would require pointer tracking that v0 doesn't have. Document the simplification; refine when interaction lands.

## Risks / Trade-offs

- **Token texture load failures** → use placeholder texture; log a warning.
- **High token count** (100+) → per-frame iteration cost grows linearly; we accept this for v0. If a deployment shows real friction, switch to a dirty-flag system on the existing update path. No premature optimization.
- **Token rotation looks odd on billboards** — Foundry tokens can rotate (e.g., to face a direction). A billboard sprite is camera-facing, so applying rotation around the camera-axis is technically correct but visually unusual ("the token spins relative to the planet surface as the camera rotates"). v0: apply rotation directly to the sprite's `material.rotation`. If visually wrong, evaluate alternatives (rotate the icon within a fixed-orientation sprite, or render an arrow indicator separately) in a follow-up.
- **Nameplate-vs-title overlap** — both the existing scene title overlay and the new nameplates are DOM elements positioned in the canvas host. A nameplate may visually overlap the title in a corner. We accept this for v0; nameplates have a lower z-index than the title.
- **Hot-loading textures stalls frames** — `TextureLoader.load` is async; the first frame after `createToken` shows the placeholder until the real texture arrives. Acceptable for v0.
- **Per-player vision in multiplayer requires every client to filter independently** — `token.visible` is computed locally per user, which is already the case for the flat map. We just consume the property; correctness comes for free.

## Open Questions

- Whether to interpolate sprite position on `updateToken` (smooth slide) rather than snap. Foundry's flat map animates token movement; we don't, and on a curved surface a snap may feel abrupt. Decide based on how it looks; trivial to add a tween later.
- Whether the placeholder texture should be a colored disc, a glyph, or just transparent. Decide at implementation time based on what reads cleanest.
- Whether to apply token alpha (`token.document.alpha`) to the sprite material's opacity. Defaulting yes; trivial.
- Whether to render hidden-from-vision tokens with a GM-only "ghosted" style (translucent silhouette) so the GM can see what players cannot. v0 just hides them; the GM can switch to flat mode for the omniscient view. Could be a setting later.
