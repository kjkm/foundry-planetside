## ADDED Requirements

### Requirement: Pings render on the minimap

While the minimap is visible, any ping that fires on the scene (a normal ping, an alert ping, or the GM pull's ping) SHALL also appear as a transient marker on the minimap at the map position corresponding to the ping's scene coordinates. The marker's position SHALL be derived from the ping's scene coordinates in the same scene-UV basis the reticle uses (`u = (x − sceneX)/sceneWidth`, `v = (y − sceneY)/sceneHeight`). The marker SHALL be shown regardless of where the camera is looking — including pings whose location is on the hidden (far) hemisphere of the globe. The marker SHALL be removed when the ping expires (the same duration as the globe ping), and SHALL NOT capture pointer input.

#### Scenario: A ping appears on the minimap

- **WHEN** a ping fires at a scene location while the minimap is visible
- **THEN** a transient marker appears on the minimap at the `(u, v)` position for that scene location

#### Scenario: Far-side pings are visible on the minimap

- **WHEN** a ping fires at a location currently on the hidden hemisphere of the globe (not visible in the 3D view)
- **THEN** the minimap still shows a marker for it

#### Scenario: Marker style matches the ping

- **WHEN** an alert ping fires
- **THEN** its minimap marker uses the alert style; a normal ping's marker uses the pinging user's color

#### Scenario: Marker expires with the ping

- **WHEN** the ping's duration elapses
- **THEN** the minimap marker is removed

#### Scenario: Markers do not block minimap interaction

- **WHEN** a ping marker is present on the minimap and the user clicks the minimap at that spot
- **THEN** the click still recenters the local camera (the marker does not intercept it)
