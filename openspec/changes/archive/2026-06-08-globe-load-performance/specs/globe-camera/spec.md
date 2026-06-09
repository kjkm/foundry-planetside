## MODIFIED Requirements

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
