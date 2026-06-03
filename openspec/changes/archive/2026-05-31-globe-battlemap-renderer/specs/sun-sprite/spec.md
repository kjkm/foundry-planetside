## ADDED Requirements

### Requirement: Sun sprite drawn in the sky at the sun's world direction

The module SHALL place a `THREE.Sprite` at world position `SUN_DIRECTION * SUN_DISTANCE`, with a procedurally generated radial-gradient texture (drawn to an offscreen canvas and used as a `THREE.CanvasTexture`) as its material map. The sprite material SHALL use additive blending, no depth write, and shall remain visible through other transparent elements.

The texture's radial gradient SHALL have a clearly dominant bright "disc" region from texture radius 0 outward, transitioning to a smaller halo region, and fully transparent past the halo.

#### Scenario: Sun visible in the direction of the directional light

- **WHEN** the camera looks toward the sun's world direction
- **THEN** a bright sprite appears at the sun's projected screen position

#### Scenario: Sun is occluded by the planet when behind it

- **WHEN** the camera orbits to a position where the planet is between camera and sun
- **THEN** the sphere depth-occludes the sun sprite
