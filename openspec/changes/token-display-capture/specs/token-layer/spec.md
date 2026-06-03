## MODIFIED Requirements

### Requirement: Tokens render as billboarded sprites at correct sphere positions

While Planetside is active on a scene, the module SHALL render every Foundry token visible to the current user as a textured `THREE.Mesh` (a unit `PlaneGeometry`) in the Three.js scene. The mesh's world position SHALL be the sphere surface point computed by Mercator forward projection of the token's center `(x, y)` scene coordinate, at a slight radial offset outside the body sphere (greater than 1.0 by a small margin) to avoid z-fighting.

The mesh's texture SHALL be produced by **capturing the live Foundry `Token` display object** (via the renderer's `generateTexture` / pixel-extract path) rather than loading the token image URL directly. Because the capture includes the token container's children, the rendered mesh SHALL therefore include the token image **and** every decoration Foundry draws on the token — the selection/control border, status-effect icons, the overlay effect, resource bars, and any decorations added by other modules — composited exactly as on the flat map.

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

## ADDED Requirements

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
