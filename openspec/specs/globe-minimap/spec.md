# globe-minimap Specification

## Purpose

Render a flat rectangular minimap overlay over the Planetside globe so users can see the whole map at once and where the orbit camera is currently looking. The minimap shows a map image (or the scene background as a fallback) with a crosshair reticle that tracks the camera's view-center, is anchored to a configurable corner clear of Foundry's core UI, and hot-reloads on flag changes for all users.

## Requirements

### Requirement: Flat minimap overlay rendered while Planetside is active and enabled

While Planetside is active on a scene whose `flags.planetside.minimapEnabled` is truthy, the module SHALL render a flat rectangular minimap as a DOM element positioned over the globe canvas region. The minimap SHALL display a map image and SHALL NOT capture pointer input (it does not steal clicks/drags from the globe). When `minimapEnabled` is falsy or unset, no minimap element SHALL be present.

#### Scenario: Minimap appears when enabled

- **WHEN** Planetside is active on a scene whose `flags.planetside.minimapEnabled` is true
- **THEN** a flat minimap element is visible over the globe canvas region

#### Scenario: No minimap when disabled

- **WHEN** Planetside is active on a scene whose `flags.planetside.minimapEnabled` is false or unset
- **THEN** no minimap element is present

#### Scenario: Minimap removed on deactivation

- **WHEN** Planetside is deactivated on a scene that had a visible minimap
- **THEN** the minimap DOM elements are removed from the page

### Requirement: Minimap image source with scene-background fallback

The minimap SHALL display the image at `flags.planetside.minimapImage`. When that flag is empty or unset, the minimap SHALL fall back to the scene's background image (`canvas.scene.background.src`). The image SHALL be stretched/compressed to fill the minimap rectangle (it does not preserve its own aspect ratio).

#### Scenario: Custom minimap image is shown

- **WHEN** `flags.planetside.minimapImage` is set to an image path and the minimap is enabled
- **THEN** the minimap displays that image stretched to fill the rectangle

#### Scenario: Falls back to the scene background

- **WHEN** `flags.planetside.minimapImage` is empty and the minimap is enabled
- **THEN** the minimap displays the scene's background image

### Requirement: Minimap rectangle matches the scene aspect ratio

The minimap rectangle's width-to-height ratio SHALL match the scene's `canvas.dimensions.sceneWidth : sceneHeight`, so that a normalized map coordinate `(u, v)` maps linearly to a position within the rectangle.

#### Scenario: Rectangle carries the scene aspect

- **WHEN** the minimap is rendered for a scene whose map is twice as wide as it is tall
- **THEN** the minimap rectangle's width-to-height ratio is 2:1

### Requirement: Crosshair reticle tracks the camera view-center

While the minimap is visible, the module SHALL render a crosshair reticle consisting of three elements positioned from the orbit camera's current orientation: a small box marking the view-center, a horizontal line spanning the full width of the minimap, and a vertical line spanning the full height. The reticle position SHALL be derived as `u = (azimuth + π) / 2π` (horizontal) and `v = projection.latToV(elevation)` (vertical), where `azimuth`/`elevation` are the orbit camera's current values. The reticle SHALL update as the camera moves, without a reload.

#### Scenario: Reticle is centered on the view-center

- **WHEN** the camera looks at the map's center (azimuth and elevation at the projection's center)
- **THEN** the box, the vertical line, and the horizontal line all cross at the center of the minimap

#### Scenario: Reticle follows camera rotation

- **WHEN** the user orbits the globe so the camera azimuth changes
- **THEN** the vertical line and box move horizontally across the minimap to the corresponding `u` position

#### Scenario: Reticle follows camera tilt

- **WHEN** the user orbits the globe so the camera elevation changes
- **THEN** the horizontal line and box move vertically to the `v` position given by the globe's projection

#### Scenario: Longitude tracking is exact

- **WHEN** the camera is pointed at a known longitude
- **THEN** the reticle's horizontal position equals `(longitude + π) / 2π` of the minimap width, regardless of the active projection

### Requirement: Minimap corner placement is configurable

The minimap SHALL be anchored to one of the four corners of the canvas region, selected by `flags.planetside.minimapCorner` (one of `tl`, `tr`, `bl`, `br`), defaulting to bottom-right (`br`) when the flag is unset. Changing the corner SHALL move the live minimap without a reload. Each corner SHALL apply an inset that keeps the panel clear of Foundry's core interface elements occupying that corner (scene navigation, the left tool controls, the players list, the hotbar).

#### Scenario: Minimap anchors to the configured corner

- **WHEN** `flags.planetside.minimapCorner` is `tl` and the minimap is enabled
- **THEN** the minimap panel is anchored in the top-left of the canvas region

#### Scenario: Defaults to bottom-right when unset

- **WHEN** the minimap is enabled on a scene where `flags.planetside.minimapCorner` has never been set
- **THEN** the minimap panel is anchored in the bottom-right of the canvas region

#### Scenario: Changing the corner moves the live minimap

- **WHEN** the GM changes `flags.planetside.minimapCorner` and saves, while the minimap is visible
- **THEN** the minimap panel moves to the new corner without a scene reload

#### Scenario: Panel clears core UI in each corner

- **WHEN** the minimap is anchored in any of the four corners
- **THEN** the panel is inset enough that it does not overlap the Foundry UI element occupying that corner (scene navigation, left tool controls, players list, or hotbar)

### Requirement: Minimap state hot-reloads on flag change

While the module is active on the current scene, on `updateScene` events whose changes touch any `flags.planetside.*` key, the module SHALL re-apply the minimap state (enabled, image source) from the scene's current flags without a full activate/deactivate cycle. Changes to the `enabled` flag continue to use the existing activate/deactivate path.

#### Scenario: Toggling the minimap updates the live view

- **WHEN** the GM enables the minimap in scene config and saves, while Planetside is active on the current scene
- **THEN** the minimap appears without a scene reload

#### Scenario: Changing the minimap image updates the live view

- **WHEN** the GM changes `flags.planetside.minimapImage` and saves, while the minimap is visible
- **THEN** the minimap updates to the new image without a scene reload

### Requirement: Minimap is visible to all users

The minimap overlay SHALL be rendered for all users on a scene where it is enabled, not restricted to the GM.

#### Scenario: Player sees the minimap

- **WHEN** a non-GM player is on a scene with Planetside active and `flags.planetside.minimapEnabled` true
- **THEN** the minimap with its tracking reticle is visible to that player

### Requirement: Clicking the minimap recenters the local camera

While the minimap is visible, clicking a point on the minimap panel SHALL ease the **local** viewer's camera so its view-center moves to the map position under the click. The clicked panel point SHALL be mapped to a latitude/longitude using the same projection mapping the reticle uses (the inverse of the reticle's position), and the camera SHALL rotate to that orientation while preserving the viewer's current zoom. The motion SHALL be animated (eased), consistent with the globe's existing camera-focus motion.

This interaction SHALL be available to all users and SHALL be purely local: it SHALL NOT broadcast to other clients, fire a ping, or move any other user's camera. (Party-wide refocus remains the GM pull on the globe.)

#### Scenario: Clicking the minimap moves the local view there

- **WHEN** a user clicks a point on the minimap panel
- **THEN** the local camera eases so its view-center is the map position under that point
- **AND** the crosshair reticle ends centered on the clicked point

#### Scenario: Zoom is preserved

- **WHEN** a user clicks the minimap while zoomed in or out
- **THEN** the camera rotates to the clicked position without changing the current zoom level

#### Scenario: The click is local only

- **WHEN** a user clicks the minimap
- **THEN** no ping is shown, no message is broadcast, and no other user's camera moves

#### Scenario: Available to all users

- **WHEN** a non-GM player clicks the minimap
- **THEN** that player's own camera eases to the clicked position
