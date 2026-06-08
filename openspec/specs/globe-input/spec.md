# globe-input Specification

## Purpose
TBD - created by archiving change globe-battlemap-renderer. Update Purpose after archive.
## Requirements
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

### Requirement: Token mesh raycast precedes sphere raycast for pointer events

For each pointer event the module forwards, the module SHALL first raycast the active `TokenLayer`'s token meshes; if a mesh is hit and the mesh's underlying token is on the visible (facing-camera) hemisphere, the module SHALL treat that token as the interaction target. Otherwise the module SHALL fall through to the existing sphere-raycast path.

Because Foundry v12's `MouseInteractionManager` will not promote synthesized PIXI pointer events into its `HOVER → CLICKED` state machine (its private hover handler silently refuses synthesized events, so no click is ever recognized), token interaction SHALL be forwarded **semantically**: on a token hit, the module SHALL invoke Foundry's real high-level handlers/APIs directly rather than synthesizing raw PIXI events. These are genuine Foundry operations and fire the usual hooks (e.g. `controlToken`).

#### Scenario: Left click on a token selects it

- **WHEN** the player left-clicks on a screen position where a token mesh is visibly rendered
- **THEN** the module calls `token.control({ releaseOthers: !shiftKey })`, so the token becomes selected (`canvas.tokens.controlled` contains it) exactly as a flat-map click would, and the `controlToken` hook fires

#### Scenario: Left click on empty sphere deselects

- **WHEN** the player left-clicks (without shift) on a screen position that hits the sphere body but no token mesh
- **THEN** the module calls `canvas.tokens.releaseAll()`, deselecting any currently controlled tokens, mirroring the flat-map behavior

#### Scenario: Click off both tokens and sphere is not forwarded

- **WHEN** the player clicks at a screen position that hits neither a token mesh nor the sphere body
- **THEN** no token interaction occurs and no PIXI event is dispatched

### Requirement: Right-click on a token mesh opens the Token HUD instead of orbiting the camera

When the user right-clicks (button === 2) on a screen position where a token mesh is hit by a raycast, the module SHALL open the Token HUD for that token (`canvas.hud.token.bind(token)`, controlling the token first if needed), AND SHALL prevent the camera orbit from receiving the same DOM event for this gesture by calling `stopImmediatePropagation()` (the orbit camera listens on the same DOM element and is installed after the forwarder).

Right-click anywhere else (off any token mesh) SHALL continue to be consumed by the camera orbit as before.

#### Scenario: Right-click on token opens HUD

- **WHEN** the player right-clicks on a token sprite on the globe
- **THEN** the Token HUD is bound to that token and reanchored to the token's projected position on the sphere
- **AND** the camera does not begin orbiting from this gesture

#### Scenario: Right-click off any token still orbits

- **WHEN** the player right-clicks on a screen position not over any token sprite
- **THEN** no token interaction occurs
- **AND** the camera orbit begins as it does today

### Requirement: Double-click on a token opens its sheet

The module SHALL support double-click semantics for token meshes: two left-clicks on the same token within Foundry's standard double-click time window (~250 ms) SHALL open the token's actor sheet.

This SHALL be implemented by explicit detection in the input forwarder (per-token click timestamps); on the second qualifying click the module SHALL call `token.actor.sheet.render(true)`.

#### Scenario: Two quick clicks on a token open the sheet

- **WHEN** the player left-clicks twice on the same token sprite within roughly 250 ms
- **THEN** the token's actor sheet opens (`token.actor.sheet.render(true)`)

### Requirement: Globe click on a tile fires its Monk's Active Tiles click / double-click trigger

When the player left-clicks the globe and the click does not hit a token, the module SHALL inverse-Mercator-project the sphere hit to a 2D scene coordinate, find the tile(s) whose footprint rectangle contains that point, and for each such tile whose Monk's Active Tiles configuration is active and includes the matching trigger method, call `tile.document.trigger({ method, pt, tokens, userId })` to run that tile's actions. A single left-down fires `click`-configured tiles; a detected double-click (a second left-down close in time and scene-space to the first) additionally fires `dblclick`-configured tiles.

Tiles SHALL be located by scene-coordinate hit-testing (not by raycasting a rendered tile mesh) so that imageless MATT trigger regions — which render nothing on the globe — still fire. The module SHALL only fire tiles whose configured trigger list includes the method being dispatched (replicating MATT's trigger-type gate, since `document.trigger` itself does not filter by method). The behavior SHALL no-op cleanly when MATT is absent, when no tile covers the point, or when no covering tile has a matching trigger.

#### Scenario: Clicking a click-trigger tile fires its actions

- **WHEN** the player left-clicks the globe over a tile whose MATT config includes a `click` trigger
- **THEN** the module calls that tile's `document.trigger` with `method: "click"` and the click's scene coordinate, and MATT runs the tile's action list

#### Scenario: Double-clicking a double-click-trigger tile fires its actions

- **WHEN** the player double-clicks the globe over a tile whose MATT config includes a `dblclick` trigger
- **THEN** the module detects the double-click and calls that tile's `document.trigger` with `method: "dblclick"`, and MATT runs the tile's action list

#### Scenario: Imageless trigger regions still fire

- **WHEN** the clicked tile is an imageless MATT trigger region (renders nothing on the globe) configured for the dispatched method
- **THEN** it is still located by scene-coordinate hit-test and triggered

#### Scenario: Non-matching tiles are not fired

- **WHEN** the player clicks over a tile whose MATT triggers do not include the dispatched method (e.g. an `enter`-only region), or a tile with no MATT config
- **THEN** no trigger is fired for that tile

#### Scenario: No tile under the click

- **WHEN** the player left-clicks the globe where no tile footprint covers the projected scene point
- **THEN** no tile trigger is fired (existing empty-click behavior is unchanged)

### Requirement: Globe right-click on a tile fires its Monk's Active Tiles right-click trigger

When the player right-clicks the globe (a right pointer-down followed by a right pointer-up with negligible cursor movement) and the gesture is not consumed by a token, the module SHALL inverse-Mercator-project the sphere hit to a 2D scene coordinate, find the tile(s) whose footprint contains that point, and for each whose Monk's Active Tiles configuration is active and includes the right-click trigger method, call `tile.document.trigger({ method, pt, tokens, userId })`. A detected double-right-click (a second such right-click close in time and scene-space) SHALL additionally fire tiles configured for the double-right-click trigger method.

A right gesture with movement beyond the click threshold SHALL be treated as a camera-orbit drag and SHALL NOT fire any tile trigger. Tiles SHALL be located by scene-coordinate hit-testing so imageless trigger regions fire. The behavior SHALL no-op cleanly when MATT is absent, when no tile covers the point, or when no covering tile has a matching trigger.

#### Scenario: Right-clicking a right-click-trigger tile fires its actions

- **WHEN** the player right-clicks (without dragging) the globe over a tile whose MATT config includes a right-click trigger
- **THEN** the module calls that tile's `document.trigger` with the right-click method and the click's scene coordinate, and MATT runs the tile's action list

#### Scenario: Right-drag still orbits the camera

- **WHEN** the player right-drags on the globe (movement beyond the click threshold)
- **THEN** the camera orbits as before and no tile trigger is fired

#### Scenario: Double-right-click fires the double-right-click trigger

- **WHEN** the player right-clicks twice in quick succession over a tile configured for a double-right-click trigger
- **THEN** the module detects the double-right-click and fires that tile's double-right-click trigger

#### Scenario: Right-click on a token still opens the HUD

- **WHEN** the player right-clicks on a token (not empty sphere)
- **THEN** the Token HUD opens as before and no tile trigger is fired for that gesture

#### Scenario: Imageless right-click trigger regions still fire

- **WHEN** the right-clicked tile is an imageless MATT trigger region configured for right-click
- **THEN** it is still located by scene-coordinate hit-test and triggered

