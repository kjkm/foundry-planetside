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

The sphere body's vertex UVs SHALL be rewritten so that geometric latitude maps to texture V via a **selectable projection curve**, and the texture U axis wraps continuously across the east-west seam (`THREE.RepeatWrapping`) so the seam is visually continuous. The supported curves are **equirectangular** (latitude linear in V; the default), **Mercator** (`V ∝ ln tan(π/4+lat/2)`), and **equal-area** (`V ∝ sin lat`). Each curve SHALL be closed-form in both directions, and the module SHALL use the **same** curve for the mesh UVs (forward) and for the inverse mapping consumed by input forwarding, ping/placeable/HUD positioning, and camera targets — so a projected point and its inverse round-trip exactly (a click or ping lands where the texture shows it).

The map's latitude coverage SHALL be a configurable **latitude span**: the latitude that the image's top and bottom edges reach. When the span reaches ±90° (permitted for equirectangular and equal-area) the body covers the whole sphere; otherwise the body is cropped to the span and the remainder is handled by the polar-caps capability. Mercator's span SHALL remain bounded short of ±90° (its mapping diverges at the poles). The full-360° U wrap and the seam behavior are unchanged.

#### Scenario: Texture wraps continuously east-west

- **WHEN** the camera orbits across the longitudinal seam of the texture
- **THEN** no visible hard edge or discontinuity appears at the seam

#### Scenario: Selected projection maps latitude to V and round-trips

- **WHEN** a projection curve is selected and a scene coordinate is mapped onto the sphere and back
- **THEN** the mesh UVs use that curve's forward mapping and the inverse (input/ping/HUD) uses its exact inverse, so the point round-trips to the same location

#### Scenario: Latitude span controls polar coverage

- **WHEN** the latitude span is set to ±90° (equirectangular or equal-area)
- **THEN** the body sphere reaches the poles and no geometry is left uncovered

- **WHEN** the latitude span is less than full (or the projection is Mercator)
- **THEN** geometry beyond the span is not part of the body mesh and the uncovered region is handled by the polar caps

### Requirement: Globe renders on demand, not unconditionally every frame

While the module is active, the globe SHALL be re-rendered only on frames where its visible result could have changed. A frame is considered changed ("dirty") when any of the following occurred since the last render: the camera orientation changed (drag, wheel, or a step of an in-progress focus tween), a placeable capture landed (a token/tile texture was (re)captured), or the canvas was resized. On frames where none of these occurred, the module SHALL skip its WebGL render passes entirely.

DOM overlays (token HUD, chat bubbles, pings) are repositioned every frame regardless of the render gate, projecting with the current camera matrices, so they track correctly without forcing a globe render; an active ping is therefore NOT itself a dirty source (when the camera is idle a ping's screen position is fixed and its pulse is compositor-driven). This gating SHALL NOT change any visible result on frames where something did change.

#### Scenario: Idle globe performs no render work

- **WHEN** the module is active and nothing has changed since the last frame (camera still, no captures, no active pings, no resize)
- **THEN** the module does not invoke its WebGL render passes for that frame

#### Scenario: Camera movement triggers a render

- **WHEN** the camera orientation changes (user drag/wheel, or an in-progress focus tween advances)
- **THEN** the globe is re-rendered that frame so the new view is shown

#### Scenario: A landed capture triggers a render

- **WHEN** a token or tile is (re)captured (e.g. it moved, animating a glide, or changed appearance)
- **THEN** the globe is re-rendered so the updated placeable is shown at its new position

#### Scenario: Ping pulse continues while the globe is idle

- **WHEN** a ping is active and the camera is not moving
- **THEN** the ping marker's pulse animation continues smoothly (compositor-driven) even though the globe's WebGL passes may be skipped

### Requirement: Three.js overlay canvas replaces the visible PIXI canvas while active

While the module is active on a scene, a Three.js-managed `<canvas>` element SHALL be mounted in the same region as Foundry's PIXI canvas (`#board`), and `#board` SHALL be visually hidden via CSS (`body.planetside-active #board { visibility: hidden }`).

Additionally, because the hidden PIXI canvas contributes nothing visible while the globe is shown, the module SHALL suspend Foundry's per-frame 2D canvas render while active, removing **only** the render step and leaving Foundry's ticker, animation logic, timers, and hooks (including `refreshToken`) running. On deactivation the module SHALL restore Foundry's per-frame render and ensure the flat canvas is rendered before it becomes visible again. Suspension SHALL be (re)applied on each activation (it is not assumed to persist across a Foundry canvas redraw).

#### Scenario: Three.js canvas is visible, PIXI canvas is hidden

- **WHEN** the module is activated
- **THEN** the player sees the Three.js-rendered globe in the canvas area
- **AND** Foundry's PIXI canvas is not visible

#### Scenario: Foundry's redundant 2D render is suspended while active

- **WHEN** the module is active and the globe is shown
- **THEN** Foundry's per-frame full-canvas 2D render does not run
- **AND** Foundry's ticker continues to advance so animation logic, timers, and `refreshToken` still fire (token movement still propagates to the globe)

#### Scenario: Original PIXI canvas restored on deactivation

- **WHEN** the module is deactivated
- **THEN** the Three.js canvas is removed and Foundry's PIXI canvas is visible again
- **AND** Foundry's per-frame render is restored and the flat canvas is rendered before it is shown

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

