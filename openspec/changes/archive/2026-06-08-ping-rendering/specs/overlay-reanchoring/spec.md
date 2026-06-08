## ADDED Requirements

### Requirement: Pings render on the globe at their pinged location

While Planetside is active, the module SHALL render Foundry canvas pings on the globe. It SHALL detect pings by intercepting the per-client ping render path (`canvas.controls.drawPing(position, options)`), calling through to the original so the flat-canvas ping is unaffected, and SHALL display a transient marker on the globe at the sphere position corresponding to the ping's scene coordinate. The marker SHALL be colored by the pinging user, SHALL be repositioned each frame so it tracks the globe as the camera moves, SHALL be hidden when its location is on the far hemisphere, and SHALL be removed automatically when the ping's duration elapses. Detection SHALL be installed when Planetside activates and removed when it deactivates.

#### Scenario: A ping appears on the globe

- **WHEN** any user pings a location (and Planetside is active for the viewer)
- **THEN** a marker appears on the globe at the projected sphere position of that scene location, in the pinging user's color

#### Scenario: The ping marker tracks the camera and expires

- **WHEN** the camera orbits while a ping is active
- **THEN** the marker stays anchored to its sphere location, and it is removed once the ping's duration elapses

#### Scenario: A ping on the far side is hidden

- **WHEN** the pinged location is on the hemisphere facing away from the camera
- **THEN** the marker is not shown (consistent with token nameplate occlusion)

#### Scenario: The flat-canvas ping is preserved

- **WHEN** a ping is drawn
- **THEN** the original `drawPing` still runs (the 2D scene's ping is unaffected), in addition to the globe marker
