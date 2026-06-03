# lens-flare Specification

## Purpose
TBD - created by archiving change globe-battlemap-renderer. Update Purpose after archive.
## Requirements
### Requirement: Lens flare row drawn along screen-space line through the sun

The module SHALL render a row of colored `THREE.Sprite` elements in screen space, positioned along the line from the sun's screen-space NDC through the screen center to the opposite side. Each element SHALL have a configurable distance parameter (0 = at sun, 1 = at screen center, > 1 = past the center). Rendering SHALL be performed via a separate `THREE.Scene` and `THREE.OrthographicCamera`, drawn after the main scene with `renderer.autoClear = false`. The sprite materials SHALL use additive blending, transparency, and no depth test.

#### Scenario: Flare elements appear along sun-to-opposite-side line

- **WHEN** the sun is at a visible position on the screen
- **THEN** flare elements appear at positions along the line from the sun through the screen center, with each element's distance parameter determining its position on that line

#### Scenario: Flare row moves opposite to the sun as the camera orbits

- **WHEN** the camera orbits so the sun's screen position shifts to a new location
- **THEN** the flare elements past the screen center shift to the opposite side from the sun, maintaining the screen-space line through the center

### Requirement: Lens flare is hidden when the planet occludes the sun

The module SHALL hide all lens flare elements when the line from the camera through the sun passes through the planet sphere (i.e., the planet is between the camera and the sun).

#### Scenario: Planet between camera and sun hides the flare

- **WHEN** the camera is positioned such that the planet is between it and the sun
- **THEN** no lens flare elements are visible

#### Scenario: Flare reappears when sun emerges

- **WHEN** the camera orbits past the occlusion so the planet no longer blocks the line to the sun
- **THEN** the lens flare elements become visible again

### Requirement: Lens flare fades near the screen edge

The module SHALL fade the lens flare's opacity smoothly to zero as the sun's NDC position approaches the screen boundary, and SHALL hide it entirely when the sun is offscreen.

#### Scenario: Edge fade as sun approaches frame boundary

- **WHEN** the camera orbits so the sun's projected NDC moves toward the edge of the screen
- **THEN** the flare elements progressively fade in opacity rather than disappearing abruptly

