## MODIFIED Requirements

### Requirement: Globe long-press fires a ping directly via canvas.ping()

When the player presses and holds the left button on the empty sphere (over no token mesh) for a hold threshold without moving past a small tolerance, the module SHALL treat it as a long-press and fire a ping by calling `canvas.ping(origin, options)` directly with the inverse-Mercator-projected scene coordinate of the hit — rather than relying on `MouseInteractionManager` to detect the long-press from synthesized events. Because `canvas.ping()` draws the ping locally (via `ControlsLayer#drawPing`, which the module already wraps to render a globe marker) and broadcasts it to other clients, the ping SHALL appear on the globe and on other clients exactly as a flat-map ping would.

The long-press SHALL map modifier keys to ping type:
- No modifier → a normal ping (default style).
- **Alt** held → an alert ping (`canvas.ping(origin, { style: "alert" })`).
- **Shift** held by a GM → a **pull**: the module SHALL show a ping marker at the location for all clients (a normal networked `canvas.ping`) and broadcast a scene-scoped view-pull (module socket) so every client's globe camera focuses on the location. Shift/pull SHALL take precedence over Alt/alert when both are held.
- Shift held by a non-GM → a normal ping (pull is GM-only; the gesture degrades gracefully).

This direct path SHALL NOT be subject to a post-ping cooldown: consecutive long-presses SHALL each fire a ping without a dead window between them.

#### Scenario: Long-press on empty globe fires a ping immediately

- **WHEN** the player presses and holds the left button on a near-side point of the empty sphere, without moving, past the hold threshold
- **THEN** the module calls `canvas.ping()` at that point's scene coordinate, a ping marker appears on the globe, and the ping is broadcast to other clients

#### Scenario: Consecutive pings have no cooldown

- **WHEN** the player fires a ping and then long-presses again after the first ping completes
- **THEN** the second long-press fires another ping immediately, with no multi-second dead window

#### Scenario: Alt long-press fires an alert ping

- **WHEN** the player long-presses with the Alt modifier held
- **THEN** the module fires an alert ping (`canvas.ping` with the alert style)

#### Scenario: GM Shift long-press fires a pull

- **WHEN** a GM long-presses with the Shift modifier held
- **THEN** the module shows a ping marker at the location for all clients and broadcasts a scene-scoped pull so each client's globe focuses there (taking precedence over Alt if also held)

#### Scenario: Non-GM Shift long-press falls back to a normal ping

- **WHEN** a non-GM long-presses with the Shift modifier held (and not Alt)
- **THEN** the module fires a normal ping (no pull)

#### Scenario: A short click does not fire a ping

- **WHEN** the player left-clicks the empty sphere and releases before the hold threshold
- **THEN** no ping is fired, and the existing empty-click behavior (deselect / tile click) runs

#### Scenario: Long-press over a token selects rather than pings

- **WHEN** the player long-presses on a screen position where a token mesh is hit
- **THEN** the token is controlled as a normal click would (no ping is fired for that gesture)
