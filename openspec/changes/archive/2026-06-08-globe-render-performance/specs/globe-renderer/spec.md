## ADDED Requirements

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

## MODIFIED Requirements

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
