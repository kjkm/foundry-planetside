## ADDED Requirements

### Requirement: Tokens render as billboarded sprites at correct sphere positions

While Planetside is active on a scene, the module SHALL render every Foundry token in the scene as a `THREE.Sprite` in the Three.js scene. Each sprite's world position SHALL be the sphere surface point computed by Mercator forward projection of the token's `(x, y)` scene coordinate, at a slight radial offset outside the body sphere (greater than 1.0 by a small margin) to avoid z-fighting. The sprite SHALL use the token's `texture.src` image as its material map and SHALL face the camera (billboard).

#### Scenario: Existing tokens appear on the globe on activation

- **WHEN** Planetside is activated on a scene that already contains tokens
- **THEN** every token visible to the current user appears as a billboarded sprite on the globe at the sphere position corresponding to its 2D coordinates

#### Scenario: Far-side sprite is occluded by the planet body

- **WHEN** the camera orbits so a token's sphere position falls on the far hemisphere
- **THEN** the sphere body depth-occludes the sprite (the player does not see it)

### Requirement: Sprite position mirrors live token coordinate changes

The module SHALL re-position a token's sprite immediately when Foundry fires the `updateToken` hook with a change to the token's coordinates. The new sprite position SHALL be the Mercator forward projection of the token's updated `(x, y)`.

#### Scenario: Moving a token on the flat scene moves the sprite on the globe

- **WHEN** a token's `(x, y)` coordinate is updated by any means (flat-map drag, console, macro, another client)
- **THEN** the corresponding sprite on the globe re-positions to the new sphere surface point on the next frame

### Requirement: Tokens added or removed propagate to the render layer

The module SHALL create a sprite when Foundry fires `createToken` and remove + dispose the sprite when Foundry fires `deleteToken`.

#### Scenario: New token appears

- **WHEN** a new token is created on the active scene by any client
- **THEN** a sprite for that token is added to the Three.js scene and is visible (subject to vision and occlusion rules)

#### Scenario: Deleted token disappears

- **WHEN** a token is deleted on the active scene
- **THEN** the corresponding sprite is removed from the Three.js scene and its texture / material disposed

### Requirement: Sprite hidden when token is not visible to the current user

The module SHALL hide a token's sprite when Foundry's `token.visible` property is `false` (per-player vision rules). The sprite SHALL be visible again when `token.visible` becomes `true`.

#### Scenario: Token hidden by vision is not rendered

- **WHEN** Foundry's vision computation sets `token.visible` to `false` for the current user
- **THEN** the corresponding sprite is not rendered on the globe

#### Scenario: GM sees all tokens regardless of vision

- **WHEN** the current user is a GM
- **THEN** every token in the scene is rendered (subject only to occlusion and explicit `hidden`)

### Requirement: DOM nameplate accompanies each visible sprite

For each sprite whose token has a non-`NONE` `displayName` setting, the module SHALL render a DOM `<div>` containing the token's name, anchored each frame to the sprite's projected screen position. The nameplate element SHALL be hidden when its sprite is hidden (vision, occlusion, or `displayName: NONE`).

#### Scenario: Nameplate appears under visible sprite

- **WHEN** a token has `displayName` set to a non-`NONE` mode and the sprite is visible
- **THEN** a nameplate DOM element with the token's name appears at the sprite's screen position

#### Scenario: Nameplate follows sprite as camera moves

- **WHEN** the camera orbits, moving the sprite's screen position
- **THEN** the nameplate's DOM position updates each frame to track the sprite

#### Scenario: Nameplate hidden when sprite is hidden

- **WHEN** the sprite is hidden by vision, occlusion, or `displayName: NONE`
- **THEN** the nameplate element is also hidden

### Requirement: Render layer is torn down when Planetside deactivates

The module SHALL remove all sprites from the Three.js scene, dispose their materials and textures, and remove all nameplate DOM elements when Planetside deactivates on the scene.

#### Scenario: Deactivation cleans up the token layer

- **WHEN** Planetside is deactivated on the current scene
- **THEN** no token sprites remain in the Three.js scene
- **AND** no nameplate DOM elements remain in the canvas host
