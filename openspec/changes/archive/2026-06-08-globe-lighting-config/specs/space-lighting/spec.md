## MODIFIED Requirements

### Requirement: Sphere body and caps are lit by directional sun light plus ambient light

The sphere body and polar caps SHALL use a lit material (`MeshLambertMaterial`) and SHALL be illuminated by:
- A `THREE.DirectionalLight` representing the sun, positioned along a configurable world direction.
- A low-intensity `THREE.AmbientLight` so the night side is not pitch black.

The renderer SHALL be configured with `useLegacyLights = true` so directional intensity 1.0 produces fully lit pixels (rather than the physical-units default).

The sun's **color**, **intensity**, and **direction**, and the **ambient (dark-side) intensity**, SHALL be configurable per scene (via `flags.planetside.*`), defaulting to the current built-in values so an untouched scene is unchanged. Changes SHALL apply **live, without rebuilding geometry**. The sun direction SHALL be specified as **azimuth + elevation**; the sun's visual indicators (the sun sprite and the lens flare) SHALL track the configured direction, and the visible sun disk SHALL take the configured sun color. A single update path SHALL keep the directional light, the sun sprite, the lens flare, and the atmosphere's sun direction in sync.

#### Scenario: Day side of the sphere is brightly lit

- **WHEN** the camera views the side of the sphere facing the sun
- **THEN** the body texture is rendered at near-full brightness

#### Scenario: Night side of the sphere is dim

- **WHEN** the camera views the side of the sphere facing away from the sun
- **THEN** the body texture is rendered substantially dimmer, with only the ambient term contributing

#### Scenario: Terminator visible at day/night boundary

- **WHEN** the camera views the line on the sphere between the lit and unlit sides
- **THEN** a smooth lambertian terminator is visible between the bright and dim regions

#### Scenario: Sun and ambient are configurable and apply live

- **WHEN** the sun color/intensity/direction or the ambient intensity is changed for a scene
- **THEN** the lighting updates immediately without a geometry rebuild, and the sun sprite/flare and the day/night terminator reflect the new values

#### Scenario: Defaults preserve the current look

- **WHEN** a scene has no lighting flags set
- **THEN** the sun direction, color, intensity, and ambient level match the previous built-in constants (the scene renders identically to before)
