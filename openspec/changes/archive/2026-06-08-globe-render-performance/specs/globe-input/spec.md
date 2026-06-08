## ADDED Requirements

### Requirement: Globe long-press fires a ping directly via canvas.ping()

When the player presses and holds the left button on the empty sphere (over no token mesh) for a hold threshold without moving past a small tolerance, the module SHALL treat it as a long-press and fire a ping by calling `canvas.ping(origin, options)` directly with the inverse-Mercator-projected scene coordinate of the hit — rather than relying on `MouseInteractionManager` to detect the long-press from synthesized events. Because `canvas.ping()` draws the ping locally (via `ControlsLayer#drawPing`, which the module already wraps to render a globe marker) and broadcasts it to other clients, the ping SHALL appear on the globe and on other clients exactly as a flat-map ping would. The call SHALL carry the alert style when the Alt modifier is held, and the default style otherwise.

This direct path SHALL NOT be subject to a post-ping cooldown: consecutive long-presses SHALL each fire a ping without a dead window between them.

#### Scenario: Long-press on empty globe fires a ping immediately

- **WHEN** the player presses and holds the left button on a near-side point of the empty sphere, without moving, past the hold threshold
- **THEN** the module calls `canvas.ping()` at that point's scene coordinate, a ping marker appears on the globe, and the ping is broadcast to other clients

#### Scenario: Consecutive pings have no cooldown

- **WHEN** the player fires a ping and then long-presses again after the first ping completes
- **THEN** the second long-press fires another ping immediately, with no multi-second dead window

#### Scenario: Alt long-press uses the alert style

- **WHEN** the player long-presses with the Alt modifier held
- **THEN** the module calls `canvas.ping()` with the alert style

#### Scenario: A short click does not fire a ping

- **WHEN** the player left-clicks the empty sphere and releases before the hold threshold
- **THEN** no ping is fired, and the existing empty-click behavior (deselect / tile click) runs

#### Scenario: Long-press over a token selects rather than pings

- **WHEN** the player long-presses on a screen position where a token mesh is hit
- **THEN** the token is controlled as a normal click would (no ping is fired for that gesture)

## MODIFIED Requirements

### Requirement: Forward pointer events from sphere to 2D scene

The module SHALL intercept left-button pointer events on the visible Three.js canvas (pointer down, move, up), raycast against the sphere body mesh, compute UV coordinates at the hit, apply the inverse Mercator projection and add the scene rectangle offset to produce 2D canvas coordinates, and dispatch a synthesized `PIXI.FederatedPointerEvent` on `canvas.app.renderer.events.rootBoundary` at those coordinates.

To keep `MouseInteractionManager` out of the ping path (a held-down left press reaching MIM re-introduces MIM's own long-press detection and its post-ping cooldown), the module SHALL classify an empty-sphere left press before forwarding it: the synthesized pointer-down SHALL be deferred and dispatched only when the gesture resolves to a **click** (forwarded as a down+up pair on release) or a **drag** (forwarded starting at first movement past tolerance, then live). A gesture that resolves to a **long-press** (held without movement past the threshold) SHALL fire a ping instead and SHALL NOT forward any synthesized event for that gesture. The right-button (camera orbit / tile right-click) and token paths are unchanged.

Note: In v0, the visible globe is a static texture, so the player cannot see visual consequences of forwarded events. The forwarding infrastructure still runs and dispatches events; verifying it requires inspecting Foundry's 2D scene state directly (e.g., observing token selection in DevTools).

#### Scenario: Left click on the sphere produces a synthesized PIXI event at the correct scene coordinate

- **WHEN** the player left-clicks (a short press, released before the long-press threshold) on a point of the sphere
- **THEN** a `PIXI.FederatedPointerEvent` is emitted on the rootBoundary's hit target at the 2D scene coordinate corresponding to the clicked sphere point under the inverse Mercator projection

#### Scenario: Right-click is reserved for camera orbit and is not forwarded

- **WHEN** the player right-clicks or right-drags on the sphere
- **THEN** no event is forwarded to the 2D scene

#### Scenario: Off-sphere pointer events are not forwarded

- **WHEN** the player clicks at a screen position whose raycast does not hit the sphere body
- **THEN** no event is dispatched to the 2D scene

#### Scenario: A held left press is not forwarded to the 2D scene

- **WHEN** the player holds the left button still on the empty sphere past the long-press threshold
- **THEN** no synthesized pointer event is forwarded for that gesture (it becomes a ping instead), so `MouseInteractionManager` never sees a held press and imposes no cooldown
