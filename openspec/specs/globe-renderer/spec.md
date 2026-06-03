# globe-renderer Specification

## Purpose
TBD - created by archiving change globe-battlemap-renderer. Update Purpose after archive.
## Requirements
### Requirement: Load active scene's background image as sphere texture

When activated on a Foundry scene, the module SHALL load the scene's background image (`canvas.scene.background.src`) via `THREE.TextureLoader` and bind it to a sphere mesh as the body's material map. The sphere body SHALL be a partial sphere covering ±85° of latitude (the Mercator-cropped region); the geometric polar caps are handled by a separate capability.

#### Scenario: Background image appears on sphere

- **WHEN** a scene with a valid background image is activated
- **THEN** the visible globe shows the scene's background image projected onto the sphere body

#### Scenario: Scene without a background image

- **WHEN** a scene without a `background.src` is activated
- **THEN** activation aborts with an error logged to the console and the globe is not displayed

### Requirement: Mercator UV mapping with east-west wrap

The sphere body's vertex UVs SHALL be rewritten so that geometric latitude maps to texture V via the Mercator projection, and the texture U axis wraps continuously across the east-west seam (`THREE.RepeatWrapping`) so the seam is visually continuous.

#### Scenario: Texture wraps continuously east-west

- **WHEN** the camera orbits across the longitudinal seam of the texture
- **THEN** no visible hard edge or discontinuity appears at the seam

#### Scenario: Polar regions are not sampled by the body sphere

- **WHEN** the sphere body is constructed
- **THEN** geometry above and below ±85° latitude is not part of the body mesh

### Requirement: Three.js overlay canvas replaces the visible PIXI canvas while active

While the module is active on a scene, a Three.js-managed `<canvas>` element SHALL be mounted in the same region as Foundry's PIXI canvas (`#board`), and `#board` SHALL be visually hidden via CSS (`body.planetside-active #board { visibility: hidden }`).

#### Scenario: Three.js canvas is visible, PIXI canvas is hidden

- **WHEN** the module is activated
- **THEN** the player sees the Three.js-rendered globe in the canvas area
- **AND** Foundry's PIXI canvas is not visible

#### Scenario: Original PIXI canvas restored on deactivation

- **WHEN** the module is deactivated
- **THEN** the Three.js canvas is removed and Foundry's PIXI canvas is visible again

### Requirement: Module re-evaluates activation when planetside.enabled flag changes on the current scene

While the module is loaded, on every `updateScene` hook for the currently active canvas scene whose update changes the `flags.planetside.enabled` flag, the module SHALL re-evaluate its activation state:
- If the new flag value is truthy and the module is currently inactive, the module SHALL activate.
- If the new flag value is falsy and the module is currently active, the module SHALL deactivate.

This SHALL happen without requiring a world reload, scene switch, or canvas re-render trigger from the user.

#### Scenario: Toggling enabled to true on current scene activates the globe

- **WHEN** the currently loaded scene's `flags.planetside.enabled` is updated to true (e.g., via the scene config tab) and the module is currently inactive
- **THEN** the module activates on the live canvas, displaying the globe view

#### Scenario: Toggling enabled to false on current scene deactivates the globe

- **WHEN** the currently loaded scene's `flags.planetside.enabled` is updated to false and the module is currently active
- **THEN** the module deactivates and the original PIXI canvas becomes visible again

#### Scenario: Updates to non-current scenes do not affect the live canvas

- **WHEN** a scene that is not the currently loaded canvas scene has its `flags.planetside.enabled` flag updated
- **THEN** the live canvas's active state does not change
- **AND** the new flag value takes effect the next time that scene is loaded as the active canvas

