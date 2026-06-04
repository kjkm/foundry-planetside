# tile-layer Specification

## Purpose

Render Foundry tiles on the Planetside globe by mirroring their live display, parallel to the token layer: each visible tile appears as a flat textured mesh at its Mercator-projected position, updating on create/move/delete/refresh. Tiles are display-only here; forwarding tile clicks to triggers (e.g. Monk's Active Tiles) is a separate capability.

## Requirements

### Requirement: Tiles render as flat textured meshes at correct sphere positions

While Planetside is active on a scene, the module SHALL render every Foundry tile visible to the current user as a textured `THREE.Mesh` (a unit `PlaneGeometry`) in the Three.js scene. The mesh's world position SHALL be the sphere surface point computed by Mercator forward projection of the tile's center `(x + width/2, y + height/2)` scene coordinate, at a slight radial offset outside the body sphere to avoid z-fighting.

The mesh's texture SHALL be produced by **capturing the live Foundry tile rendering** (the same render-to-texture path used for tokens): the tile image (`tile.mesh`, a `PrimarySpriteMesh` in the `PrimaryCanvasGroup`) is drawn as a plain sprite of its texture and composited into a render texture under a neutralized stage transform. The mesh SHALL lie flat against the sphere surface, oriented by the surface tangent frame, with the tile's rotation reflected by the captured image (baked in). Tiles SHALL render image-only on the globe (no selection frame, no nameplate). The mesh SHALL be depth-occluded by the body sphere when the tile's position falls on the far hemisphere.

#### Scenario: Existing tiles appear on the globe on activation

- **WHEN** Planetside is activated on a scene that already contains tiles
- **THEN** every tile visible to the current user appears as a flat mesh on the globe at the sphere position corresponding to its 2D coordinates, showing the tile's image

#### Scenario: Far-side tile is occluded by the planet body

- **WHEN** the camera orbits so a tile's sphere position falls on the far hemisphere
- **THEN** the sphere body depth-occludes the tile mesh

### Requirement: Tile mesh position mirrors live tile coordinate changes

The module SHALL re-position a tile's mesh when Foundry fires `updateTile` with a change to the tile's coordinates or dimensions. The new mesh position SHALL be the Mercator forward projection of the tile's updated center.

#### Scenario: Moving a tile on the flat scene moves the mesh on the globe

- **WHEN** a tile's position is updated by any means (flat-map drag, console, macro, another client)
- **THEN** the corresponding mesh on the globe re-positions to the new sphere surface point on the next frame

### Requirement: Tiles added or removed propagate to the render layer

The module SHALL create a mesh when Foundry fires `createTile` and remove + dispose the mesh (and its texture) when Foundry fires `deleteTile`.

#### Scenario: New tile appears

- **WHEN** a new tile is created on the active scene by any client
- **THEN** a mesh for that tile is added to the Three.js scene and is visible (subject to visibility and occlusion rules)

#### Scenario: Deleted tile disappears

- **WHEN** a tile is deleted on the active scene
- **THEN** the corresponding mesh is removed from the Three.js scene and its texture / material disposed

### Requirement: Tile mesh hidden when the tile is not visible to the current user

The module SHALL hide a tile's mesh when Foundry's `tile.visible` is `false` (e.g. a hidden tile for a non-GM). The mesh SHALL be shown again when `tile.visible` becomes `true`.

#### Scenario: Hidden tile is not rendered for a player

- **WHEN** a tile is hidden and the current user is not a GM
- **THEN** the corresponding mesh is not rendered on the globe

### Requirement: Tile texture is re-captured when its Foundry display refreshes

The module SHALL re-capture a tile's texture whenever Foundry refreshes that tile's display, using the `refreshTile` hook (in addition to create/update hooks). Re-captures SHALL be coalesced via a per-tile dirty flag so at most one capture occurs per tile per rendered frame, bounded by a per-frame capture budget shared with the rest of the placeable rendering. Each re-capture SHALL dispose or reuse the tile's previous texture so the pipeline does not leak GPU resources.

#### Scenario: Changing a tile's image updates it on the globe

- **WHEN** a tile's texture/image is changed
- **THEN** the tile's globe mesh re-captures and shows the new image on a subsequent frame

#### Scenario: Repeated refreshes are coalesced

- **WHEN** Foundry fires `refreshTile` many times in quick succession
- **THEN** the module performs at most one texture capture for that tile per rendered frame

### Requirement: Tile render layer is torn down when Planetside deactivates

The module SHALL remove all tile meshes from the Three.js scene and dispose their materials and textures when Planetside deactivates on the scene.

#### Scenario: Deactivation cleans up the tile layer

- **WHEN** Planetside is deactivated on the current scene
- **THEN** no tile meshes remain in the Three.js scene and their textures are disposed
