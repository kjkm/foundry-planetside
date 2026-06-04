## Why

The globe renders tokens but not **tiles**. Tiles are the other core placeable players see on a battlemap (terrain overlays, props, interactive objects), and they're the prerequisite for the actual near-term goal: testing Monk's Active Tiles **click** triggers from the globe (you can't click a tile you can't see). This change delivers the rendering foundation only; forwarding clicks to MATT is a deliberately separate, thin follow-up (`tile-click-triggers`), mirroring how token rendering (`token-display-capture`) and token interaction (`token-interaction`) were split.

## What Changes

- Add a `TileLayer` that renders every visible Foundry tile on the globe by mirroring its live display, exactly as `TokenLayer` does for tokens: capture the tile's `PrimarySpriteMesh` image (drawn as a plain Sprite — the mesh's occlusion shader only outlines outside its primary-group framebuffer), composite into a render texture under a neutralized stage transform, map onto a flat `PlaneGeometry` mesh laid on the sphere via the surface tangent frame, positioned by Mercator forward projection of the tile center.
- Re-capture coalesced on `refreshTile` (plus `createTile`/`updateTile`/`deleteTile`), with the same per-frame budget model as tokens.
- **Refactor:** factor the shared capture / dirty-coalesce / tangent-frame-positioning machinery out of `TokenLayer` into a `PlaceableLayer` base; `TokenLayer` and the new `TileLayer` extend it with their placeable source, hooks, and any per-type specifics. `TokenLayer`'s observable behavior is unchanged (its smoke tests must still pass).
- Wire the `TileLayer` into the controller lifecycle (`activate`/`deactivate`/per-frame tick) alongside `TokenLayer`.

## Capabilities

### New Capabilities
- `tile-layer`: render Foundry tiles on the globe (capture-based, lie-flat, Mercator-positioned, live-updating), parallel to `token-layer`.

### Modified Capabilities
<!-- none — the PlaceableLayer refactor changes token-layer implementation only, not its requirements -->

## Impact

- **Code:** new `scripts/tiles.js` (`TileLayer`); new shared base (e.g. `scripts/placeables.js` or a base in `tokens.js`) factored from `TokenLayer`; `scripts/planetside.js` (instantiate/install/tick/teardown `TileLayer`); `scripts/main.js` (tile hooks → layer); reuses the capture approach proven in `token-display-capture`.
- **Dependencies:** none new.
- **Behavior:** purely additive rendering; the 2D scene and tile documents remain the source of truth. No tile interaction, selection, or editing. No change to tokens beyond the internal base-class refactor.
- **Performance:** one GPU readback per tile per change (not per frame), same model as tokens; large/video tiles are out of scope so the per-tile cost stays bounded.
- **Known visual limitation (non-goal):** large tiles rendered as flat quads will not follow the sphere's curvature; acceptable because the motivating use case (clickable interactive tiles) is small. Curved-patch rendering for large tiles is deferred.
