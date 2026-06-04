## Context

Token rendering today (`scripts/tokens.js`) is **image replication**: each token is a unit `PlaneGeometry` mesh whose `MeshBasicMaterial.map` is the token image loaded by `THREE.TextureLoader` from `doc.texture.src`, with a shared URL→texture refcount cache. The plane is positioned by Mercator forward projection of the token center, oriented with `lookAt(origin)` + `rotateZ(rotation)`, and accompanied by a billboarded DOM nameplate. None of Foundry's token decorations (selection border, status icons, bars, target reticle, module extras) are mirrored, because they are siblings of the token image inside the `Token` PIXI container and never reach the image URL.

The project's north star is "the globe is a re-rendering of an otherwise standard Foundry battlemap." `scripts/capture.js` already demonstrates the canonical PIXI→`RenderTexture`→pixel-extract→Three.js `DataTexture` pattern for the background. This change applies the same mirror philosophy per token: capture the live `Token` display object instead of redrawing its parts.

The previous change (`token-interaction`, archived) established that the globe drives Foundry through real handlers and that the 2D scene/token documents remain the source of truth; this change is purely a rendering fidelity upgrade and changes no input or document behavior.

## Goals / Non-Goals

**Goals:**
- Globe tokens visually mirror the flat `Token` display: image + selection/control border + status-effect icons + resource bars + target reticle, always in sync. (See Decisions — Foundry v12's token anatomy means decorations are enumerated explicitly rather than captured wholesale, so arbitrary module-drawn decorations are NOT automatically included.)
- One capture path replaces the bespoke image pipeline; adding a decoration is a one-line change to the rendered-objects list.
- Decorations lie flat on the sphere with consistent orientation (no roll wobble), with the token's rotation reflected as on the flat map.
- Re-capture is change-driven and coalesced, not per-frame, to keep cost bounded.

**Non-Goals:**
- Hover border (Foundry's hover border needs `token.hover`, which the semantic-input pipeline never sets; deferred — could later set `token.hover` purely as a render trigger).
- Redrawing bars/targets as billboarded DOM for legibility; for v1 they bake flat with everything else.
- Shared-WebGL-context zero-copy capture (the same optimization already deferred for the background); v1 accepts GPU→CPU→GPU readback.
- Any change to token input, movement, vision, or the 2D scene.
- Rendering selection/target state for tokens NOT visible to the current user (existing visibility rules unchanged).

## Decisions

> **Note (post-implementation):** the original plan was a single `renderer.generateTexture(token)` capturing the whole `Token`. Foundry v12's token anatomy made that impossible; the decisions below reflect what was actually built. See "Foundry v12 token anatomy constraints" for the discoveries that forced the change.

### Foundry v12 token anatomy constraints (discovered during implementation)

Three hard constraints shaped the real implementation:

1. **The image is not a child of the `Token`.** `token.mesh` is a `PrimarySpriteMesh` parented to the `PrimaryCanvasGroup` (for occlusion/sorting). `generateTexture(token)` therefore captures only decorations, not the image.
2. **The image mesh cannot be reparented and won't render in isolation.** Adding `token.mesh` to a temp container throws (`PrimaryCanvasObject instances may only be direct children of the PrimaryCanvasGroup`), and rendering the mesh through its occlusion shader outside the primary-group framebuffer produces only an **outline** (the fill is discarded).
3. **The `Token` container holds occlusion/interaction children** (beyond border/bars/effects/tooltip/target/nameplate) that render a token-shaped **erase/transparent hole**; compositing the whole container over the image punches that hole out.

### Capture per token via a stage-neutralized two-pass render

Replace `TextureLoader.load(src)` with a per-token capture into a `THREE.CanvasTexture`:

1. Once per frame, neutralize the canvas stage transform (`position=0, scale=1`) using `enableTempParent()`/`updateTransform()`/`disableTempParent()` (the root stage has no parent, so a raw `updateTransform()` dereferences null). This makes `getBounds()` return a stable, pan/zoom-independent world space.
2. For each dirty token, compute the capture region as the union of the mesh's world AABB and the visible decoration objects' bounds; create a `RenderTexture`; then render with a projection `transform` that offsets by `-region.{x,y}`:
   - **Image:** a plain `PIXI.Sprite` of `mesh.texture` (default shader → filled), sized to `mesh.width/height` (includes appearance scale), rotated by `mesh.rotation`, sign-flipped for mirrored tokens, anchored 0.5 at the mesh AABB center.
   - **Decorations:** `token.border`, `token.bars`, `token.effects`, `token.target` — rendered **individually**, never the whole `Token` container (constraint 3).
3. `renderer.extract.canvas(rt)` → `THREE.CanvasTexture` onto the plane.

- **Alternative — `generateTexture(token)`**: rejected — captures only decorations (constraint 1).
- **Alternative — capture `token.mesh` (reparented or in place)**: rejected — throws / renders outline-only (constraint 2).
- **Alternative — recreate each decoration as 3D geometry**: rejected. Reimplements Foundry's border-color and effect-grid layout, never covers module decorations, accrues debt per decoration.
- **Alternative — DOM overlays** (like nameplates): rejected for border/icons. Screen-flat overlays don't foreshorten with the sphere and a rectangular border can't match a curved, limb-foreshortened footprint.
- **Trade-off:** because we enumerate specific decoration objects rather than capturing the container, module-drawn decorations that are *not* one of those four objects will not appear (the original "everything for free" promise is reduced). Adding more is a one-line list change.

### Re-capture coalesced on `refreshToken`

`refreshToken(token, flags)` is Foundry's "this token's display changed" signal (control, hover, effects, bars, movement). Listen to it (plus existing `createToken`/`updateToken`/`deleteToken`) and set a per-entry dirty flag; perform the capture at most once per token per frame in the layer's `update()` tick. This mirrors `capture.js`'s dirty model and is philosophically exact: we re-mirror precisely when Foundry re-draws.

- **Alternative — capture every frame**: rejected; wasteful readback for static tokens.
- **Alternative — subscribe to granular hooks** (`controlToken`, effect CRUD, `updateActor`, `targetToken`…): rejected as primary mechanism — plural, easy to miss a case; `refreshToken` is the single catch-all. Granular hooks may still be used to *force* dirty where `refreshToken` does not fire.

### Bake rotation; orient from an explicit surface tangent frame

Drop the sprite `rotateZ`. The captured texture already contains the rotated image with axis-aligned border/effects (exactly Foundry's flat behavior). To make "axis-aligned" meaningful on the sphere — and to fix the latent roll instability of `lookAt(origin)` (its up vector is undefined/degenerate near the poles) — orient each plane from the tangent basis at the token's `(lat, lon)`: local up = meridian/north tangent, local right = east tangent, normal = radial. A small helper on `scene.js` builds this basis. The token's rotation then reads as "rotation relative to north," matching the flat map.

- **Alternative — keep `lookAt` + `rotateZ`**: rejected; double-rotates the baked image and rolls the border/icon column inconsistently around the globe.

### Anchoring via the mesh AABB center (NOT document coordinates)

The decoration bounds expand the region asymmetrically, so the texture center ≠ the token center; the plane is offset along the tangent frame so the token *center* lands on its sphere point. **Critical subtlety discovered in implementation:** under the neutralized stage, `getBounds()` returns a world space whose origin does **not** match Foundry document coordinates (the primary group / token layer carry their own offset). So all capture math is done in that bounds space, and the token's visual center is taken from the **mesh AABB center** (the image is centered on the token), never from `token.center` (document space) — mixing the two produced a ~1500px bogus offset that flung the mesh off the sphere. Plane size = region size in globe units.

- **Alternative — use `token.center` for the offset**: rejected — different coordinate space than `getBounds()`; caused the off-sphere bug.
- **Alternative — fixed capture region** (e.g. 2× footprint): simpler but clips conditions on heavily-statused tokens. Not needed once the region is the union of mesh + decoration bounds.

### Exclude the nameplate from capture; keep the DOM nameplate

Hide `token.nameplate` during capture so the name is not baked flat onto the sphere, preserving the billboarded DOM nameplate as the single name source. Bars/target/effects/border remain in the capture for v1.

### Per-token owned texture; no render-target pool (yet)

Retire the shared URL refcount cache (each composite is unique). Each capture creates a `RenderTexture`, extracts to a `CanvasTexture`, and destroys the RT; the previous `CanvasTexture` is disposed on swap, and the owned texture on token removal / teardown. **RT pooling was deliberately NOT implemented** — captures are change-driven and infrequent, so pooling would optimize an unmeasured cost (matches the project's "don't pre-optimize" stance). The per-frame capture budget is the only guard.

## Risks / Trade-offs

- **[Readback cost per capture]** → Capture is change-driven and coalesced (≤1/token/frame), so static scenes cost nothing. Mass simultaneous movement is the stress case; mitigate with a per-frame capture budget (capture N tokens/frame, defer the rest) if profiling shows spikes.
- **[Resolution / crispness]** → Capture at footprint-pixels × a small supersample factor, capped, so tokens stay sharp when the camera zooms in without unbounded texture sizes.
- **[Tangent frame at the poles]** → The body is Mercator-cropped at ±85°, so tokens never sit exactly at a pole; the tangent basis is well-defined within the rendered band. Guard the degenerate case anyway.
- **[`refreshToken` fires before children are laid out]** → Capture on the next frame tick (not synchronously in the hook) so Foundry has finished its own refresh/layout before we read pixels.
- **[Bars/targets baked flat may read poorly near the limb]** → Accepted for v1; the nameplate's DOM-billboard pattern is the escape hatch if a later change decides bars need it.
- **[Module decorations with their own tickers/animation]** → Animated decorations only update on our re-capture cadence, so they may look stepped on the globe. Acceptable; out of scope to chase per-frame.

## Open Questions

- **Capture API**: RESOLVED — neither `generateTexture(token)` nor mesh capture works (see constraints). Settled on the stage-neutralized two-pass render (image Sprite + per-decoration objects).
- **Module decorations beyond the four enumerated objects** (border/bars/effects/target): not captured. If a needed module draws elsewhere on the token, extend the decoration list — open until a concrete case arises.
- **Multi-token movement stress (task 5.8)**: the per-frame capture budget (`MAX_CAPTURES_PER_FRAME`) is unverified under many simultaneously-moving effect-laden tokens; tune or batch if it stutters.
- **Bars**: keep baking flat (v1 default) or split into billboarded DOM in a follow-up — defer.
- **Hover border**: leave absent, or set `token.hover` on raycast-hover as a pure render trigger — defer.
