## Context

Token rendering today (`scripts/tokens.js`) is **image replication**: each token is a unit `PlaneGeometry` mesh whose `MeshBasicMaterial.map` is the token image loaded by `THREE.TextureLoader` from `doc.texture.src`, with a shared URL→texture refcount cache. The plane is positioned by Mercator forward projection of the token center, oriented with `lookAt(origin)` + `rotateZ(rotation)`, and accompanied by a billboarded DOM nameplate. None of Foundry's token decorations (selection border, status icons, bars, target reticle, module extras) are mirrored, because they are siblings of the token image inside the `Token` PIXI container and never reach the image URL.

The project's north star is "the globe is a re-rendering of an otherwise standard Foundry battlemap." `scripts/capture.js` already demonstrates the canonical PIXI→`RenderTexture`→pixel-extract→Three.js `DataTexture` pattern for the background. This change applies the same mirror philosophy per token: capture the live `Token` display object instead of redrawing its parts.

The previous change (`token-interaction`, archived) established that the globe drives Foundry through real handlers and that the 2D scene/token documents remain the source of truth; this change is purely a rendering fidelity upgrade and changes no input or document behavior.

## Goals / Non-Goals

**Goals:**
- Globe tokens visually mirror the flat `Token` display: image + selection/control border + status-effect icons + overlay effect + bars + target reticle + module-drawn decorations, always in sync.
- One capture mechanism replaces the bespoke image pipeline; future decorations require no new code.
- Decorations lie flat on the sphere with consistent orientation (no roll wobble), with the token's rotation reflected as on the flat map.
- Re-capture is change-driven and coalesced, not per-frame, to keep cost bounded.

**Non-Goals:**
- Hover border (Foundry's hover border needs `token.hover`, which the semantic-input pipeline never sets; deferred — could later set `token.hover` purely as a render trigger).
- Redrawing bars/targets as billboarded DOM for legibility; for v1 they bake flat with everything else.
- Shared-WebGL-context zero-copy capture (the same optimization already deferred for the background); v1 accepts GPU→CPU→GPU readback.
- Any change to token input, movement, vision, or the 2D scene.
- Rendering selection/target state for tokens NOT visible to the current user (existing visibility rules unchanged).

## Decisions

### Capture the `Token` display object, not the image URL

Replace `TextureLoader.load(src)` with `canvas.app.renderer.generateTexture(token)` (or an equivalent render into a pooled `RenderTexture` followed by `renderer.extract`), feeding the result into a per-token `THREE.CanvasTexture`/`DataTexture` mapped onto the existing plane. The token image arrives as the container's `mesh` child, so no separate image load is needed.

- **Alternative — recreate each decoration as 3D geometry** (ring mesh for border, quads for icons): rejected. Reimplements Foundry's border-color and effect-grid layout, never covers module decorations, and accrues debt per decoration.
- **Alternative — DOM overlays** (like nameplates): rejected for border/icons. Screen-flat overlays do not foreshorten with the sphere and a rectangular border cannot match a curved, limb-foreshortened token footprint.

### Re-capture coalesced on `refreshToken`

`refreshToken(token, flags)` is Foundry's "this token's display changed" signal (control, hover, effects, bars, movement). Listen to it (plus existing `createToken`/`updateToken`/`deleteToken`) and set a per-entry dirty flag; perform the capture at most once per token per frame in the layer's `update()` tick. This mirrors `capture.js`'s dirty model and is philosophically exact: we re-mirror precisely when Foundry re-draws.

- **Alternative — capture every frame**: rejected; wasteful readback for static tokens.
- **Alternative — subscribe to granular hooks** (`controlToken`, effect CRUD, `updateActor`, `targetToken`…): rejected as primary mechanism — plural, easy to miss a case; `refreshToken` is the single catch-all. Granular hooks may still be used to *force* dirty where `refreshToken` does not fire.

### Bake rotation; orient from an explicit surface tangent frame

Drop the sprite `rotateZ`. The captured texture already contains the rotated image with axis-aligned border/effects (exactly Foundry's flat behavior). To make "axis-aligned" meaningful on the sphere — and to fix the latent roll instability of `lookAt(origin)` (its up vector is undefined/degenerate near the poles) — orient each plane from the tangent basis at the token's `(lat, lon)`: local up = meridian/north tangent, local right = east tangent, normal = radial. A small helper on `scene.js` builds this basis. The token's rotation then reads as "rotation relative to north," matching the flat map.

- **Alternative — keep `lookAt` + `rotateZ`**: rejected; double-rotates the baked image and rolls the border/icon column inconsistently around the globe.

### Anchoring via dynamic bounds with a center offset

The effect column / bars expand the captured bounds asymmetrically, so the captured image's center ≠ the token center. Use the dynamic captured bounds (no clipping) and offset the plane by the measured (bounds-center − token-center) vector, expressed in the tangent frame, so the token *center* still lands on its sphere point. Size the plane to the captured bounds in globe units.

- **Alternative — fixed capture region** (e.g. 2× footprint, centered): simpler anchoring but clips conditions on heavily-statused tokens. Rejected; clipping a player's visible conditions is worse than deterministic offset math. (Revisit if dynamic bounds prove fiddly.)

### Exclude the nameplate from capture; keep the DOM nameplate

Hide `token.nameplate` (and only that) during capture so the name is not baked flat onto the sphere, preserving the existing billboarded, legible DOM nameplate as the single name source. Bars and other children remain in the capture for v1.

### Per-token owned texture + pooled render target

Retire the shared URL refcount cache (each composite is unique). Each entry owns its texture and a reusable `RenderTexture` sized to its capture; on re-capture, render into the pooled RT and refresh the Three texture, disposing the old one. On token removal / layer teardown, dispose both.

## Risks / Trade-offs

- **[Readback cost per capture]** → Capture is change-driven and coalesced (≤1/token/frame), so static scenes cost nothing. Mass simultaneous movement is the stress case; mitigate with a per-frame capture budget (capture N tokens/frame, defer the rest) if profiling shows spikes.
- **[Resolution / crispness]** → Capture at footprint-pixels × a small supersample factor, capped, so tokens stay sharp when the camera zooms in without unbounded texture sizes.
- **[Tangent frame at the poles]** → The body is Mercator-cropped at ±85°, so tokens never sit exactly at a pole; the tangent basis is well-defined within the rendered band. Guard the degenerate case anyway.
- **[`refreshToken` fires before children are laid out]** → Capture on the next frame tick (not synchronously in the hook) so Foundry has finished its own refresh/layout before we read pixels.
- **[Bars/targets baked flat may read poorly near the limb]** → Accepted for v1; the nameplate's DOM-billboard pattern is the escape hatch if a later change decides bars need it.
- **[Module decorations with their own tickers/animation]** → Animated decorations only update on our re-capture cadence, so they may look stepped on the globe. Acceptable; out of scope to chase per-frame.

## Open Questions

- **Capture API**: `renderer.generateTexture(token, {resolution, region})` vs. an explicit pooled-RT `renderer.render(token, {renderTexture})` + `extract` (the `capture.js` pattern). Both work; pick during implementation based on control over resolution/region and allocation churn.
- **Bars**: keep baking flat (v1 default) or split into billboarded DOM in a follow-up — defer until we see them on the globe.
- **Hover border**: leave absent, or set `token.hover` on raycast-hover as a pure render trigger — defer.
