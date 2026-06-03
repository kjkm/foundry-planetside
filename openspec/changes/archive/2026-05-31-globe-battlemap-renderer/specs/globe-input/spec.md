## ADDED Requirements

### Requirement: Forward pointer events from sphere to 2D scene

The module SHALL intercept left-button pointer events on the visible Three.js canvas (pointer down, move, up), raycast against the sphere body mesh, compute UV coordinates at the hit, apply the inverse Mercator projection and add the scene rectangle offset to produce 2D canvas coordinates, and dispatch a synthesized `PIXI.FederatedPointerEvent` on `canvas.app.renderer.events.rootBoundary` at those coordinates.

Note: In v0, the visible globe is a static texture, so the player cannot see visual consequences of forwarded events. The forwarding infrastructure still runs and dispatches events; verifying it requires inspecting Foundry's 2D scene state directly (e.g., observing token selection in DevTools).

#### Scenario: Left click on the sphere produces a synthesized PIXI event at the correct scene coordinate

- **WHEN** the player left-clicks on a point of the sphere
- **THEN** a `PIXI.FederatedPointerEvent` is emitted on the rootBoundary's hit target at the 2D scene coordinate corresponding to the clicked sphere point under the inverse Mercator projection

#### Scenario: Right-click is reserved for camera orbit and is not forwarded

- **WHEN** the player right-clicks or right-drags on the sphere
- **THEN** no event is forwarded to the 2D scene

#### Scenario: Off-sphere pointer events are not forwarded

- **WHEN** the player clicks at a screen position whose raycast does not hit the sphere body
- **THEN** no event is dispatched to the 2D scene
