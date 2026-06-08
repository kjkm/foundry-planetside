## ADDED Requirements

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
