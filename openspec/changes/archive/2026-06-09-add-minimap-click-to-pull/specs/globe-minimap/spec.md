## ADDED Requirements

### Requirement: Clicking the minimap recenters the local camera

While the minimap is visible, clicking a point on the minimap panel SHALL ease the **local** viewer's camera so its view-center moves to the map position under the click. The clicked panel point SHALL be mapped to a latitude/longitude using the same projection mapping the reticle uses (the inverse of the reticle's position), and the camera SHALL rotate to that orientation while preserving the viewer's current zoom. The motion SHALL be animated (eased), consistent with the globe's existing camera-focus motion.

This interaction SHALL be available to all users and SHALL be purely local: it SHALL NOT broadcast to other clients, fire a ping, or move any other user's camera. (Party-wide refocus remains the GM pull on the globe.)

#### Scenario: Clicking the minimap moves the local view there

- **WHEN** a user clicks a point on the minimap panel
- **THEN** the local camera eases so its view-center is the map position under that point
- **AND** the crosshair reticle ends centered on the clicked point

#### Scenario: Zoom is preserved

- **WHEN** a user clicks the minimap while zoomed in or out
- **THEN** the camera rotates to the clicked position without changing the current zoom level

#### Scenario: The click is local only

- **WHEN** a user clicks the minimap
- **THEN** no ping is shown, no message is broadcast, and no other user's camera moves

#### Scenario: Available to all users

- **WHEN** a non-GM player clicks the minimap
- **THEN** that player's own camera eases to the clicked position
