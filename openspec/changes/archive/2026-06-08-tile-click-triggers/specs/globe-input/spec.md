## ADDED Requirements

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

- **WHEN** the clicked tile is an imageless MATT trigger region (renders nothing on the globe) configured for `click`
- **THEN** it is still located by scene-coordinate hit-test and triggered

#### Scenario: Non-click tiles are not fired on click

- **WHEN** the player clicks over a tile whose MATT triggers do not include `click` (e.g. an `enter`-only region), or a tile with no MATT config
- **THEN** no trigger is fired for that tile

#### Scenario: No tile under the click

- **WHEN** the player left-clicks the globe where no tile footprint covers the projected scene point
- **THEN** no tile trigger is fired (existing empty-click behavior is unchanged)
