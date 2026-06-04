# token-layer Specification

## Purpose
TBD - created by archiving change token-layer. Update Purpose after archive.
## Requirements
### Requirement: Tokens render as flat textured meshes at correct sphere positions

While Planetside is active on a scene, the module SHALL render every Foundry token visible to the current user as a textured `THREE.Mesh` (a unit `PlaneGeometry`) in the Three.js scene. The mesh's world position SHALL be the sphere surface point computed by Mercator forward projection of the token's center `(x, y)` scene coordinate, at a slight radial offset outside the body sphere (greater than 1.0 by a small margin) to avoid z-fighting.

The mesh's texture SHALL be produced by **capturing the live Foundry token rendering** (via the renderer's render-to-texture / pixel-extract path) rather than loading the token image URL directly. The capture SHALL composite the token image together with the token's standard decoration objects — the selection/control border, resource bars, status-effect icons (including the overlay effect), and the target reticle — exactly as composited on the flat map. (Implementation note: Foundry v12 stores the token image in the `PrimaryCanvasGroup`, separate from the `Token` container, and the container holds occlusion children that must be excluded; the capture therefore composites the image and the enumerated decoration objects explicitly. Arbitrary module-drawn decorations outside those objects are out of scope.)

The mesh SHALL NOT billboard (face the camera); it SHALL lie flat against the sphere surface, oriented by an explicit surface tangent frame (local up aligned to the meridian/north direction, local right to east) so that axis-aligned decorations (the border, the status-icon column) keep a consistent orientation everywhere on the sphere. The token's rotation SHALL be reflected by the captured image itself (baked in), NOT by rotating the mesh, mirroring how Foundry rotates only the token image and keeps border/effects grid-aligned.

The capture SHALL exclude Foundry's own token nameplate so that the separately rendered DOM nameplate remains the single name source. The mesh SHALL be depth-occluded by the body sphere when the token's position falls on the far hemisphere.

#### Scenario: Existing tokens appear on the globe on activation

- **WHEN** Planetside is activated on a scene that already contains tokens
- **THEN** every token visible to the current user appears as a flat mesh on the globe at the sphere position corresponding to its 2D coordinates, showing the same image and decorations Foundry draws on the flat map

#### Scenario: Controlled token shows its selection border

- **WHEN** a token is controlled (selected)
- **THEN** the selection/control border Foundry draws on that token appears on the globe mesh, in the same color Foundry uses

#### Scenario: Token with active status effects shows its icons

- **WHEN** a token has one or more active status effects
- **THEN** the status-effect icons (and overlay effect, if any) appear on the globe mesh in the same arrangement Foundry draws them

#### Scenario: Far-side mesh is occluded by the planet body

- **WHEN** the camera orbits so a token's sphere position falls on the far hemisphere
- **THEN** the sphere body depth-occludes the mesh (the player does not see it)

### Requirement: Mesh position mirrors live token coordinate changes

The module SHALL re-position a token's mesh immediately when Foundry fires the `updateToken` hook with a change to the token's coordinates. The new mesh position SHALL be the Mercator forward projection of the token's updated `(x, y)`.

#### Scenario: Moving a token on the flat scene moves the mesh on the globe

- **WHEN** a token's `(x, y)` coordinate is updated by any means (flat-map drag, console, macro, another client)
- **THEN** the corresponding mesh on the globe re-positions to the new sphere surface point on the next frame

### Requirement: Tokens added or removed propagate to the render layer

The module SHALL create a mesh when Foundry fires `createToken` and remove + dispose the mesh when Foundry fires `deleteToken`.

#### Scenario: New token appears

- **WHEN** a new token is created on the active scene by any client
- **THEN** a mesh for that token is added to the Three.js scene and is visible (subject to vision and occlusion rules)

#### Scenario: Deleted token disappears

- **WHEN** a token is deleted on the active scene
- **THEN** the corresponding mesh is removed from the Three.js scene and its texture / material disposed

### Requirement: Mesh hidden when token is not visible to the current user

The module SHALL hide a token's mesh when Foundry's `token.visible` property is `false` (per-player vision rules). The mesh SHALL be visible again when `token.visible` becomes `true`.

#### Scenario: Token hidden by vision is not rendered

- **WHEN** Foundry's vision computation sets `token.visible` to `false` for the current user
- **THEN** the corresponding mesh is not rendered on the globe

#### Scenario: GM sees all tokens regardless of vision

- **WHEN** the current user is a GM
- **THEN** every token in the scene is rendered (subject only to occlusion and explicit `hidden`)

### Requirement: DOM nameplate accompanies each visible mesh

For each mesh whose token has a non-`NONE` `displayName` setting, the module SHALL render a DOM `<div>` containing the token's name, anchored each frame to the mesh's projected screen position. The nameplate element SHALL be hidden when its mesh is hidden (vision, occlusion, or `displayName: NONE`).

#### Scenario: Nameplate appears under visible mesh

- **WHEN** a token has `displayName` set to a non-`NONE` mode and the mesh is visible
- **THEN** a nameplate DOM element with the token's name appears at the mesh's screen position

#### Scenario: Nameplate follows mesh as camera moves

- **WHEN** the camera orbits, moving the mesh's screen position
- **THEN** the nameplate's DOM position updates each frame to track the mesh

#### Scenario: Nameplate hidden when mesh is hidden

- **WHEN** the mesh is hidden by vision, occlusion, or `displayName: NONE`
- **THEN** the nameplate element is also hidden

### Requirement: Render layer is torn down when Planetside deactivates

The module SHALL remove all token meshes from the Three.js scene, dispose their materials and textures, and remove all nameplate DOM elements when Planetside deactivates on the scene.

#### Scenario: Deactivation cleans up the token layer

- **WHEN** Planetside is deactivated on the current scene
- **THEN** no token meshes remain in the Three.js scene
- **AND** no nameplate DOM elements remain in the canvas host

### Requirement: Token texture is re-captured when its Foundry display refreshes

The module SHALL re-capture a token's texture whenever Foundry refreshes that token's display, using the `refreshToken` hook as the change signal (in addition to the existing create/update hooks). Re-captures SHALL be coalesced via a per-token dirty flag so that at most one capture occurs per token per rendered frame, even when the refresh signal fires repeatedly (e.g. during a movement animation). Each re-capture SHALL dispose or reuse the token's previous texture so the pipeline does not leak GPU resources.

#### Scenario: Toggling a condition updates the icons on the globe

- **WHEN** a status effect is added to or removed from a token
- **THEN** the token's globe mesh re-captures and shows the updated set of status-effect icons on the next frame

#### Scenario: Selecting a token updates its border on the globe

- **WHEN** a token becomes controlled or is released
- **THEN** the token's globe mesh re-captures and shows or hides the selection border accordingly

#### Scenario: Repeated refreshes during movement are coalesced

- **WHEN** Foundry fires `refreshToken` many times in quick succession (e.g. a movement animation)
- **THEN** the module performs at most one texture capture for that token per rendered frame
