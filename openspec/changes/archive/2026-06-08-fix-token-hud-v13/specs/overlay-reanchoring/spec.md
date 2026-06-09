## MODIFIED Requirements

### Requirement: Reanchor Foundry-core DOM overlays to projected sphere position each frame

While the module is active, on each frame the module SHALL forward-project the 2D scene anchor coordinate of each supported Foundry-core DOM overlay through the active Mercator UV mapping and Three.js camera projection to produce a screen position, and SHALL update the overlay's DOM `left` and `top` accordingly. Overlays whose anchor projects to a sphere point on the occluded hemisphere SHALL be hidden until the anchor becomes visible again.

Supported overlays in v0: the token HUD, chat bubbles whose `data-tokenId` resolves to a Foundry token, and tooltip elements with `data-anchorX` / `data-anchorY` attributes.

For the Token HUD, the module SHALL reanchor the HUD's **root** element and SHALL resolve it robustly across Foundry versions: `canvas.hud.token.element` may be a jQuery-wrapped object (v12, where the DOM node is `element[0]`) or the root `HTMLElement` itself (v13 ApplicationV2, a `<form id="token-hud">`). The module SHALL NOT index into the root element to obtain it (a `<form>` indexed by `[0]` yields its first form field, not the HUD), and SHALL fall back to the `#token-hud` id when needed.

Note: In v0, the visible globe is a static texture, so the player will not see most tokens move into their reanchored positions; reanchoring is only observable for overlays that follow Foundry actions visible in DevTools, or via the still-rendered DOM elements themselves.

#### Scenario: Token HUD follows controlled token's sphere projection

- **WHEN** a token is controlled and its projected position on the sphere is on the visible hemisphere
- **THEN** the `#token-hud` element is positioned at the screen-space location where the token's 2D scene coordinate projects on the sphere

#### Scenario: Token HUD root resolves under v13 ApplicationV2

- **WHEN** the Token HUD is bound and `canvas.hud.token.element` is the root `HTMLElement` (v13)
- **THEN** the module reanchors that root `#token-hud` element itself, not a descendant field, so the HUD appears over the token rather than at its un-overridden flat-canvas position

#### Scenario: Overlay anchored on occluded hemisphere is hidden

- **WHEN** the anchor's 2D scene coordinate corresponds to a sphere point on the far side of the planet (occluded from the camera)
- **THEN** the overlay element's `display` is set to `none`

#### Scenario: Chrome is not reanchored

- **WHEN** the module is active
- **THEN** the Foundry sidebar, hotbar, and scene control toolbar remain in their original CSS-positioned locations and are not moved
