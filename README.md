# Planetside

A Foundry VTT module (v12.343) that renders a scene's standard 2D battlemap as a 3D globe. The 2D scene continues to run normally and remains the source of truth — walls, lighting, vision, and module integrations like Monk's Active Tiles all keep working against the flat coordinate system. The globe is purely a display and input transformation layer over it.

## Status

v0 / minimum-viable spike. Loads the active scene's background image directly and projects it onto a sphere. Dynamic content (tokens, walls, lighting, vision, modules) is NOT yet captured onto the globe — that's the next milestone. Input forwarding still synthesizes PIXI events under the hood, so the 2D scene continues to receive clicks, but the sphere texture itself does not reflect them.

## Install (local development)

```
npm install
```

This installs Three.js and copies `node_modules/three/build/three.module.js` into `scripts/vendor/three.module.js` (see `setup.js`). Foundry loads modules directly off disk; symlink or copy the project directory into your Foundry `Data/modules/` folder.

## Enabling on a scene

**Recommended: scene configuration tab.**

Right-click the scene in the sidebar → **Configure**. In the scene config modal, click the **Planetside** tab and toggle **Enable Planetside**. Saving the form activates the globe view immediately on the current scene; for non-current scenes, activation takes effect the next time the scene is loaded.

**Programmatic alternative** (for macros or automation):

```js
await game.modules.get("planetside").api.enableScene();
await game.modules.get("planetside").api.disableScene();
```

Both the UI tab and the API write the same per-scene flag (`flags.planetside.enabled`). The current canvas re-evaluates activation in response to flag changes, so flipping the flag through either path takes effect immediately on the live scene without a reload.

### Title overlay (optional)

The Planetside tab also includes a **Title overlay** section: a title and optional subtitle that render in a chosen corner of the canvas while Planetside is active. Each has independent font family (curated dropdown) and pixel size, and both share a corner (top-left, top-right, bottom-left, bottom-right). Leave either field empty to hide it; leave both empty to hide the overlay entirely. Changes apply immediately on save — no reload required.

### Token layer

Tokens on a Planetside-enabled scene appear as billboarded sprites on the globe at the sphere position corresponding to their flat-map coordinates, with DOM nameplates positioned below each sprite. Updates to tokens (create, move, delete, hide) propagate to the globe view automatically via Foundry hooks; the underlying token document is the source of truth, and all Foundry-side features (vision, status effects, module integrations) continue to operate against the real token.

**Tokens on the globe respond to pointer events:**
- **Left-click** a token sprite to select it (and left-click empty globe to deselect).
- **Double-click** a token to open its actor sheet.
- **Right-click** a token to open the Token HUD. Right-click anywhere else on the globe still orbits the camera.

These are forwarded **semantically**: a click is raycast against the token meshes, and on a hit the module calls Foundry's real handlers directly — `token.control()` for selection, `canvas.tokens.releaseAll()` for deselect, `token.actor.sheet.render()` for double-click, and `canvas.hud.token.bind()` for the right-click HUD. This runs genuine Foundry behavior and fires the usual hooks (`controlToken`, etc.).

Why not synthesize raw pointer events into Foundry's canvas? We tried; Foundry v12's `MouseInteractionManager` only recognizes a click after its internal `HOVER` state is set via a `pointerover`, and its compiled private hover handler silently refuses to enter `HOVER` for synthesized events — so a synthesized click is never recognized, and a module cannot patch that handler. Calling the real high-level handlers is the reliable path. The trade-off: modules that hook the *raw PIXI pointer event* or `MouseInteractionManager`'s `clickLeft` callback (rather than overriding `Token._onClickLeft` or listening on `controlToken`/`updateToken`) won't fire from globe clicks; most token integrations use the latter and are unaffected.

Drag-to-move tokens on the globe and drag-from-sidebar to create new tokens on the globe are not yet implemented. Use the flat-map view for those actions; the globe view reflects changes immediately.

## How it works (briefly)

- Foundry renders the active scene to its normal PIXI canvas. Planetside captures that canvas into a `PIXI.RenderTexture` each frame the scene is dirty.
- A Three.js scene displays a sphere mesh in the visible canvas region. The captured texture is wrapped onto the sphere using Mercator UV mapping, cropped at ±85° latitude.
- The polar caps above and below the cropped Mercator rectangle are filled with the average color of the rectangle's perimeter.
- A constrained orbit camera circles the sphere with world Y locked as up and the sphere center as the look-at target. Elevation is clamped strictly short of ±90°.
- Pointer events on the Three.js canvas first raycast the token meshes. A hit forwards the interaction semantically by calling Foundry's real token handlers (`control`, `releaseAll`, the actor sheet, the Token HUD). A miss is raycast against the sphere, inverse-Mercator-projected back to 2D scene coordinates, and dispatched as a synthesized PIXI federated event on the offscreen PIXI stage. (While the globe is active the module detaches Foundry's PIXI `EventSystem` from the hidden flat canvas so the real cursor doesn't fight the projected input, and restores it on deactivate.)
- A small set of Foundry DOM overlays (token HUD, chat bubbles, tooltips) are reanchored each frame to the screen position where their 2D scene coordinate projects on the sphere.

## Controls

- **Left-click a token**: select it (double-click opens its sheet; right-click opens its HUD).
- **Left-click empty globe**: deselect.
- **Right-click drag (off any token)**: orbit camera (azimuth + elevation).
- **Scroll wheel**: zoom in/out (radius).
- **Left-click on empty sphere**: forwarded to the 2D scene at the corresponding coordinate (sphere raycast → inverse Mercator → synthesized PIXI event). Note that flat-scene interactions which depend on Foundry's hover→click state machine (rulers, wall placement, etc.) are subject to the same `MouseInteractionManager` limitation described under "Token layer" and may not respond from the globe.

## v1 limitations

Some are intentional, some are known-but-deferred.

### East-west seam

The Mercator rectangle's left and right edges represent the same meridian on the sphere. The visible texture wraps continuously, but Foundry's wall, lighting, and vision solvers compute on a non-wrapping rectangle and **do not** treat the seam as connected. A wall placed near the right edge will not occlude vision into the left edge; a torch placed near the seam will not cast light past it.

**Author guidance:** position the seam over terrain where gameplay doesn't happen (ocean, wasteland, sky).

### Distance and area

Spell templates, rulers, AoEs, and light radii are computed on the flat 2D scene and merely *look* curved on the sphere. Visual distance on the globe does not correspond to scene grid distance in any meaningful way away from the equator. Document this for your players.

### DOM overlays supported in v1

The following core Foundry overlays are reanchored to the projected sphere position of their target:
- Token HUD (button ring around a selected token)
- Chat bubbles
- Tooltips (when an anchor coordinate is attached)

Other DOM overlays — both Foundry's and from other modules — may appear in their original 2D position, disconnected from where their target visually lands on the sphere. No general-purpose third-party module compatibility is committed to in v1.

### Performance

Capture currently uses a CPU-side pixel readback from PIXI to Three.js (GPU → CPU → GPU each dirty frame). It works; on lower-end hardware or very large maps it may be slow. A shared-WebGL-context optimization is a known follow-up but is not in v1.

## Repository layout

```
planetside/
├── module.json              # Foundry manifest
├── package.json             # Three.js dependency + setup script
├── setup.js                 # Copies three.module.js into scripts/vendor/
├── scripts/
│   ├── main.js              # entry: hooks
│   ├── planetside.js        # controller: activate / deactivate / per-frame tick
│   ├── mercator.js          # forward / inverse Mercator math
│   ├── capture.js           # PIXI canvas → render texture → Three.js DataTexture
│   ├── scene.js             # Three.js scene, sphere mesh, body + caps geometry
│   ├── caps.js              # perimeter sampling for polar cap color
│   ├── camera.js            # constrained orbit camera + mouse / wheel controls
│   ├── input.js             # raycast → inverse Mercator → synthesized PIXI event
│   ├── overlays.js          # DOM overlay reanchoring
│   └── vendor/              # populated by `npm install` (gitignored)
├── styles/
│   └── planetside.css       # canvas positioning + hide #board when active
└── openspec/                # specs, design, tasks for v0.1 (see openspec/changes/)
```
