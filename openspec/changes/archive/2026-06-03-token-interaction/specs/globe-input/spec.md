## ADDED Requirements

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
