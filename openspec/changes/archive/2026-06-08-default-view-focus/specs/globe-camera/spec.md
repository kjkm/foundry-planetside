## ADDED Requirements

### Requirement: Camera can focus on a scene location

The orbit camera SHALL provide a source-agnostic focus operation that moves it to a target orientation derived from a scene location and zoom. Given a scene coordinate `(x, y)` and a Foundry view `scale`, the module SHALL compute the target as `azimuth = lon`, `elevation = lat` (where `{lat, lon}` is the inverse-Mercator of the scene coordinate, clamped to the camera's elevation limit), and a `radius` derived from `scale`. The focus operation SHALL support both an instant move and an **eased animated** move (shortest-path azimuth interpolation), and an in-progress animated focus SHALL be cancelled if the user begins manually orbiting (manual control always wins).

#### Scenario: Focus centers the target scene location

- **WHEN** the camera is focused on a scene coordinate
- **THEN** the camera orients so the corresponding sphere point is centered in view (`azimuth = lon`, `elevation = lat`)

#### Scenario: Animated focus eases to the target

- **WHEN** the camera is focused with animation enabled
- **THEN** the camera azimuth/elevation/radius interpolate smoothly (eased) to the target over the focus duration, taking the shortest angular path in azimuth

#### Scenario: Manual orbit interrupts an animated focus

- **WHEN** an animated focus is in progress and the user starts dragging to orbit
- **THEN** the focus animation is cancelled and the camera follows the user's input

### Requirement: Globe opens at the scene's default view

When Planetside activates on a scene, the camera SHALL focus (eased) on the scene's default view position (`scene.initial`) rather than a fixed orientation: the initial `(x, y)` maps to the camera azimuth/elevation and `scale` to the radius. When the scene's default view position is unset (`x`/`y` null) or absent, the camera SHALL fall back to the scene center at a default radius.

#### Scenario: Activation aims the globe at the configured default view

- **WHEN** Planetside activates on a scene whose `scene.initial` has a set `(x, y)` and `scale`
- **THEN** the globe eases open with that scene location centered and a radius derived from the scale

#### Scenario: Unset default view falls back to scene center

- **WHEN** Planetside activates on a scene whose `scene.initial.x` / `scene.initial.y` are null (no default view set)
- **THEN** the globe opens centered on the scene center at the default radius
