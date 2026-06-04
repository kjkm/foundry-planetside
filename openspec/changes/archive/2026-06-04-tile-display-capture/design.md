## Context

`TokenLayer` (`scripts/tokens.js`, shipped in `token-display-capture`) renders each token by capturing its live Foundry rendering into a `THREE.CanvasTexture` on a flat `PlaneGeometry` mesh laid on the sphere. The hard-won mechanics: the token image is a `PrimarySpriteMesh` in the `PrimaryCanvasGroup` (cannot be reparented; its occlusion shader only outlines outside the primary framebuffer), so the image is drawn as a plain `PIXI.Sprite` of `mesh.texture`; capture happens under a neutralized stage transform; positions/sizes are computed in that bounds world-space (never document space); orientation uses an explicit surface tangent frame (`scene.surfaceFrame`); re-capture is coalesced on `refreshToken` with a per-frame budget.

Tiles are structurally the same: `tile.mesh` is also a `PrimarySpriteMesh` in the `PrimaryCanvasGroup`, positioned in scene coordinates, with `refreshTile`/`createTile`/`updateTile`/`deleteTile` hooks. So tile rendering is largely the token pipeline pointed at `canvas.tiles`. This change renders tiles only; clicking them to fire MATT (`document.trigger`, already validated in exploration) is the separate `tile-click-triggers` follow-up.

## Goals / Non-Goals

**Goals:**
- Every tile visible to the current user appears on the globe at its Mercator-projected position, mirroring its flat-map image, updating live on create/move/delete/refresh.
- Share one capture implementation between tokens and tiles so they cannot drift.

**Non-Goals:**
- Any tile interaction (click → MATT, selection, drag, editing) — that's `tile-click-triggers` and later work.
- Curved-patch rendering for large tiles (flat quads only; large tiles won't follow curvature).
- Video/animated tiles (continuous re-capture), overhead/roof tiles + occlusion, foreground/elevation layering, tile tint/alpha edge cases beyond what the capture naturally carries.
- Tile decorations (selection frame/handles) — tiles render image-only on the globe.
- Any change to token *behavior*.

## Decisions

### Port the token capture pipeline to tiles

Reuse the exact capture approach from `token-display-capture` for `tile.mesh`: stage-neutralize, render a plain `PIXI.Sprite` of `mesh.texture` (sized/rotated from `mesh.width/height/rotation`) into a `RenderTexture` offset by the union region, `extract.canvas` → `THREE.CanvasTexture` on a flat plane, anchored at the mesh AABB center, oriented by `scene.surfaceFrame(lat, lon)`. Position from Mercator forward projection of the tile center `(doc.x + doc.width/2, doc.y + doc.height/2)`.

- **Alternative — `generateTexture(tile)` / render the Tile container**: rejected for the same reasons as tokens (image lives in the primary group; container render risks occlusion artifacts).

### Factor a shared `PlaceableLayer` base

Move the common machinery — capture (`_captureOne`, stage neutralize, union region, anchor/offset, dispose), dirty-flag coalescing with per-frame budget, tangent-frame positioning, lifecycle (`install`/`update`/`destroy`) — into a base class. `TokenLayer` and `TileLayer` subclass it, supplying: the placeable collection (`canvas.tokens` vs `canvas.tiles`), the center/size/visibility accessors, and any per-type extras (tokens: DOM nameplate + decoration objects; tiles: none for v1).

- **Alternative — duplicate the pipeline into `TileLayer`**: rejected; the capture logic was intricate and bug-prone, and divergence would mean fixing the same bug twice.
- **Alternative — extract free functions instead of a base class**: viable, but the state (entries map, dirty flags, scene refs) fits a class better than threading params.
- **Constraint:** `TokenLayer`'s observable behavior must not change — the `token-layer` smoke tests (image, border, status icons, orientation) must still pass after the refactor.

### Decorations: tokens keep theirs, tiles render image-only

The base handles the image. Token-specific decoration rendering (`border`/`bars`/`effects`/`target`) and the DOM nameplate stay in `TokenLayer`. Tiles render only the image for v1 (no selection frame, no nameplate) — nothing else is needed to see and later click them.

### Flat quads; large-tile curvature is a documented non-goal

Tiles use the same flat `PlaneGeometry` as tokens. Small tiles (the interactive ones that matter for the MATT goal) look correct; large tiles won't follow the sphere's curvature. Curved-patch or tile-layer-shell rendering is deferred to a future change if large-tile fidelity is wanted.

### Re-capture on `refreshTile`, coalesced

Mirror the token signal model: `refreshTile` marks the entry dirty; capture ≤ once per tile per frame under the per-frame budget; `createTile`/`updateTile`/`deleteTile` add/refresh/remove entries.

## Risks / Trade-offs

- **[Refactor regresses tokens]** → The base extraction touches working, verified token code. Mitigation: keep `TokenLayer`'s behavior identical and re-run the token smoke tests (image/border/icons/orientation) as part of this change's verification.
- **[Large tiles render as floating/curving flat quads]** → Accepted and documented; the motivating use case is small interactive tiles. Revisit with a curved-patch/shell approach later.
- **[Video tiles look static / may capture a single frame]** → Out of scope; they'll show a still (or whatever the first capture grabs). Note as a limitation.
- **[Many large tiles → readback cost / big textures]** → Capture is change-driven and resolution-capped; large background tiles are uncommon as interactive tiles. Per-frame budget guards bursts.
- **[Overhead/roof tiles]** → Rendered like background tiles (no occlusion); may look wrong over the map. Acceptable v1; could be filtered out if distracting.

## Open Questions

- Whether to **filter which tiles render** (e.g., skip overhead/hidden/foreground) or render all visible tiles uniformly for v1. Lean: render all `tile.visible` tiles; refine if noisy.
- Whether the shared base lives in a new `scripts/placeables.js` or as a base exported from `tokens.js` — cosmetic; decide during implementation.
- Tile **z-ordering** vs tokens on the globe (background tiles under tokens). Lean: small radial offset so tiles sit just below tokens; confirm visually.
