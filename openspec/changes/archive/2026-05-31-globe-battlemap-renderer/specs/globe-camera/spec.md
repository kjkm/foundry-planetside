## ADDED Requirements

### Requirement: Constrained orbit camera around sphere

The module SHALL provide a Three.js camera that orbits the sphere center with three controllable degrees of freedom: azimuth, elevation, and radius (zoom). The camera SHALL always look at the sphere's center and SHALL always treat the world Y axis as up. Elevation SHALL be clamped strictly short of ±90° to avoid the up-vector degeneracy at the world poles.

#### Scenario: Camera always faces sphere center

- **WHEN** the camera is at any orbit position
- **THEN** the camera's forward vector points at the sphere's origin

#### Scenario: Camera up vector is world Y

- **WHEN** the camera is at any orbit position
- **THEN** the camera's up vector is aligned with world Y (north pole stays visually up)

#### Scenario: User can orbit and zoom

- **WHEN** the user provides azimuth, elevation, or zoom input
- **THEN** the camera's azimuth, elevation, or radius updates accordingly, subject to the elevation clamp

#### Scenario: Elevation cannot reach the world poles

- **WHEN** the user attempts to push elevation to or beyond ±90°
- **THEN** elevation is clamped strictly short of ±90°
