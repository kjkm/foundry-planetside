# overlay-reanchoring Specification

## Purpose
TBD - created by archiving change globe-battlemap-renderer. Update Purpose after archive.
## Requirements
### Requirement: Reanchor Foundry-core DOM overlays to projected sphere position each frame

While the module is active, on each frame the module SHALL forward-project the 2D scene anchor coordinate of each supported Foundry-core DOM overlay through the active Mercator UV mapping and Three.js camera projection to produce a screen position, and SHALL update the overlay's DOM `left` and `top` accordingly. Overlays whose anchor projects to a sphere point on the occluded hemisphere SHALL be hidden until the anchor becomes visible again.

Supported overlays in v0: the token HUD, chat bubbles whose `data-tokenId` resolves to a Foundry token, and tooltip elements with `data-anchorX` / `data-anchorY` attributes.

Note: In v0, the visible globe is a static texture, so the player will not see most tokens move into their reanchored positions; reanchoring is only observable for overlays that follow Foundry actions visible in DevTools, or via the still-rendered DOM elements themselves.

#### Scenario: Token HUD follows controlled token's sphere projection

- **WHEN** a token is controlled and its projected position on the sphere is on the visible hemisphere
- **THEN** the `#hud` element is positioned at the screen-space location where the token's 2D scene coordinate projects on the sphere

#### Scenario: Overlay anchored on occluded hemisphere is hidden

- **WHEN** the anchor's 2D scene coordinate corresponds to a sphere point on the far side of the planet (occluded from the camera)
- **THEN** the overlay element's `display` is set to `none`

#### Scenario: Chrome is not reanchored

- **WHEN** the module is active
- **THEN** the Foundry sidebar, hotbar, and scene control toolbar remain in their original CSS-positioned locations and are not moved

