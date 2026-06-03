## ADDED Requirements

### Requirement: Sphere body and caps are lit by directional sun light plus ambient light

The sphere body and polar caps SHALL use a lit material (`MeshLambertMaterial`) and SHALL be illuminated by:
- A `THREE.DirectionalLight` representing the sun, positioned in a fixed world direction (`SUN_DIRECTION`).
- A low-intensity `THREE.AmbientLight` so the night side is not pitch black.

The renderer SHALL be configured with `useLegacyLights = true` so directional intensity 1.0 produces fully lit pixels (rather than the physical-units default).

#### Scenario: Day side of the sphere is brightly lit

- **WHEN** the camera views the side of the sphere facing the sun
- **THEN** the body texture is rendered at near-full brightness

#### Scenario: Night side of the sphere is dim

- **WHEN** the camera views the side of the sphere facing away from the sun
- **THEN** the body texture is rendered substantially dimmer, with only the ambient term contributing

#### Scenario: Terminator visible at day/night boundary

- **WHEN** the camera views the line on the sphere between the lit and unlit sides
- **THEN** a smooth lambertian terminator is visible between the bright and dim regions
