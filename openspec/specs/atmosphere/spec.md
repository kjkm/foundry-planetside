# atmosphere Specification

## Purpose
TBD - created by archiving change globe-battlemap-renderer. Update Purpose after archive.
## Requirements
### Requirement: Two atmosphere shells render a sun-aware Fresnel halo around the planet

The module SHALL add two BackSide-rendered sphere meshes around the planet body, each with a custom `ShaderMaterial` and additive blending. The shaders SHALL compute fragment brightness as the product of:
- A rim factor `pow(max(0, -dot(N, V)), power)` — peak at the planet's limb, fading to zero at the shell's silhouette
- A sun-modulated factor `smoothstep(dayLo, dayHi, dot(N, sunDirection))` — fading out as the fragment passes from the lit side to the unlit side

The two shells SHALL have independent radius, color, intensity, falloff power, and day/night transition ranges so they layer into a wider outer halo plus a tighter inner limb glow.

#### Scenario: Visible blue halo around the planet on the day side

- **WHEN** the camera views the lit side of the planet
- **THEN** a soft halo, extending beyond the planet's silhouette into space, is visible around the planet's lit limb

#### Scenario: No atmospheric glow on the deep night side

- **WHEN** the camera views the part of the planet's limb on the side away from the sun, past the terminator
- **THEN** no visible atmospheric glow extends past the planet's silhouette on that side

#### Scenario: Inner limb glow saturates to white on the lit side

- **WHEN** the camera views the lit limb of the planet
- **THEN** the inner shell's contribution reads as a bright white glow tight against the planet's edge, while the outer shell's contribution provides a softer blue halo extending further into space

