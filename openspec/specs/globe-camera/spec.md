# globe-camera Specification

## Purpose
TBD - created by archiving change globe-battlemap-renderer. Update Purpose after archive.
## Requirements
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

### Requirement: Camera can focus on a scene location

The orbit camera SHALL provide a source-agnostic focus operation that moves it to a target orientation derived from a scene location and zoom. Given a scene coordinate `(x, y)` and a Foundry view `scale`, the module SHALL compute the target as `azimuth = lon`, `elevation = lat` (where `{lat, lon}` is the inverse-Mercator of the scene coordinate, clamped to the camera's elevation limit), and a `radius` derived from `scale`. The focus operation SHALL support both an instant move and an eased animated move (shortest-path azimuth interpolation, ease-out), and an in-progress animated focus SHALL be cancelled if the user begins manually orbiting (manual control always wins).

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

When Planetside activates on a scene, the camera SHALL focus on the scene's default view position (`scene.initial`) rather than a fixed orientation: the initial `(x, y)` maps to the camera azimuth/elevation and `scale` to the radius. When the scene's default view position is unset (`x`/`y` null) or absent, the camera SHALL fall back to the scene center at a default radius. The opening SHALL be an eased establishing move (a wide, side-on lateral spin that zooms in and tilts up to the destination latitude as it settles).

The animated opening SHALL begin when the globe is first revealed (its color texture is available / the first real frame can render), not during the pre-reveal asset-loading window. The opening SHALL NOT be corrupted by load-time main-thread work — it SHALL play as a continuous eased move from its start rather than advancing on wall-clock time while frames are stalled and snapping to mid-animation. Until the opening begins, the camera SHALL hold the wide establishing pose (a framed view, not a black void).

#### Scenario: Activation aims the globe at the configured default view

- **WHEN** Planetside activates on a scene whose `scene.initial` has a set `(x, y)` and `scale`
- **THEN** the globe eases open with that scene location centered and a radius derived from the scale

#### Scenario: Unset default view falls back to scene center

- **WHEN** Planetside activates on a scene whose `scene.initial.x` / `scene.initial.y` are null (no default view set)
- **THEN** the globe opens centered on the scene center at the default radius

#### Scenario: Opening plays smoothly from reveal, not jumping through load

- **WHEN** the scene's assets take time to load (large textures / heightmap)
- **THEN** the camera holds the wide establishing pose during loading and the eased opening begins once the globe is revealed, playing continuously rather than snapping to a point partway through

### Requirement: Globe camera focuses on a pull ping's location

While Planetside is active, when a GM issues a pull (Shift+long-press), the module SHALL ease the globe camera to the pulled location instead of leaving it where it is. The GM SHALL broadcast the pull on a scene-scoped module socket; each client with Planetside active for that scene SHALL convert the pulled scene coordinate to a camera target via the same scene→target mapping used for the default-view opening (`azimuth = lon`, `elevation = lat`) and call the camera `focus()` operation with animation. This SHALL apply on every such client, including the initiating GM (who focuses locally, since socket emits do not loop back to the sender). A client viewing a different scene SHALL be unaffected (the pull carries the originating scene id). An in-progress pull focus SHALL yield to manual orbit (consistent with `focus()` being cancelled when the user begins dragging). The socket listener SHALL be installed when Planetside activates and removed when it deactivates.

#### Scenario: A GM pull rotates each client's globe to the location

- **WHEN** a GM fires a pull ping and a client has Planetside active
- **THEN** that client's globe camera eases (via `focus()`) so the pulled location is centered in view

#### Scenario: The initiating GM's globe also follows the pull

- **WHEN** a GM fires a pull ping while their own Planetside globe is active
- **THEN** the GM's globe camera also eases to the pulled location

#### Scenario: Manual orbit interrupts a pull focus

- **WHEN** a pull focus is in progress and the user starts dragging to orbit
- **THEN** the focus is cancelled and the camera follows the user's input

