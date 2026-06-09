# Planetside

A Foundry VTT module (v12 and v13) that renders a scene's standard 2D battlemap as a 3D globe. Both Foundry versions ship PIXI 7, so the canvas/capture pipeline is identical across them; v13 support is mainly the ApplicationV2 Scene Config tab. The 2D scene continues to run normally and remains the source of truth — walls, lighting, vision, and module integrations like Monk's Active Tiles all keep working against the flat coordinate system. The globe is purely a display and input transformation layer over it.

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

Tokens on a Planetside-enabled scene appear on the globe at the sphere position corresponding to their flat-map coordinates, lying flat against the surface, with DOM nameplates positioned below each. Each token is rendered by **mirroring its live Foundry `Token` display object** into a texture (`renderer.generateTexture`) rather than re-drawing the token image alone — so the globe shows the token image **plus** the selection/control border, status-effect icons, resource bars, target reticle, and any decorations other modules draw, composited exactly as on the flat map. The token's rotation is baked into the capture; the mesh is laid flat using the surface tangent frame so borders and the status-icon column keep a consistent orientation around the globe. Foundry's own nameplate is excluded from the capture so the billboarded DOM nameplate stays the single, legible name source.

Re-capture is driven by the `refreshToken` hook (Foundry's "this token's display changed" signal) and coalesced to at most one capture per token per frame, with a small per-frame budget. Updates to tokens (create, move, delete, hide, control, status effects) propagate to the globe automatically; the underlying token document remains the source of truth, and all Foundry-side features continue to operate against the real token.

Deferred: the hover border (the globe's semantic input never sets the flat `token.hover` state), bars/targets redrawn as billboarded DOM for legibility (they currently bake flat with everything else), and shared-WebGL-context zero-copy capture (v1 uses a GPU readback per capture — cheap because captures are change-driven).

**Tokens on the globe respond to pointer events:**
- **Left-click** a token sprite to select it (and left-click empty globe to deselect).
- **Double-click** a token to open its actor sheet.
- **Right-click** a token to open the Token HUD. Right-click anywhere else on the globe still orbits the camera.

These are forwarded **semantically**: a click is raycast against the token meshes, and on a hit the module calls Foundry's real handlers directly — `token.control()` for selection, `canvas.tokens.releaseAll()` for deselect, `token.actor.sheet.render()` for double-click, and `canvas.hud.token.bind()` for the right-click HUD. This runs genuine Foundry behavior and fires the usual hooks (`controlToken`, etc.).

Why not synthesize raw pointer events into Foundry's canvas? We tried; Foundry v12's `MouseInteractionManager` only recognizes a click after its internal `HOVER` state is set via a `pointerover`, and its compiled private hover handler silently refuses to enter `HOVER` for synthesized events — so a synthesized click is never recognized, and a module cannot patch that handler. Calling the real high-level handlers is the reliable path. The trade-off: modules that hook the *raw PIXI pointer event* or `MouseInteractionManager`'s `clickLeft` callback (rather than overriding `Token._onClickLeft` or listening on `controlToken`/`updateToken`) won't fire from globe clicks; most token integrations use the latter and are unaffected.

Drag-to-move tokens on the globe and drag-from-sidebar to create new tokens on the globe are not yet implemented. Use the flat-map view for those actions; the globe view reflects changes immediately.

### Tile layer

Tiles render on the globe through the same display-capture pipeline as tokens (a shared `PlaceableLayer` base): each tile's image is captured and mapped onto a flat mesh laid on the sphere at the tile's Mercator-projected position, updating on tile create/move/delete/refresh. Tiles render image-only (no selection frame) and sit just beneath tokens.

**Clicking a tile on the globe fires its Monk's Active Tiles trigger** — left-click → `click`, double-left-click → `dblclick`, right-click → `rightclick`, double-right-click → `dblrightclick`. A click that misses tokens is inverse-Mercator-projected to a scene coordinate, and any tile whose footprint covers that point and is configured for the matching trigger has its actions run via `tile.document.trigger`. Right-button gestures are split by movement: a right-**click** fires the trigger, a right-**drag** orbits the camera as usual. Tiles are located by scene coordinate (not by a rendered mesh), so **imageless MATT trigger regions still fire**. Only tiles configured for that trigger respond (an `enter`-only region won't); it no-ops cleanly when MATT isn't installed.

Known limitations: token-enter/hover triggers are not forwarded (enter already fires from flat-map movement); right-click on a token opens the Token HUD rather than firing a tile trigger; the footprint hit-test is axis-aligned (tile rotation ignored); overlapping trigger-tiles all fire. Rendering limitations: large tiles are flat quads and won't follow the sphere's curvature; video/animated tiles show a still; overhead/roof tiles are drawn like background tiles without occlusion; tiles are not selectable/editable on the globe.

## How it works (briefly)

- The globe body is the scene's background image, loaded directly onto the sphere; tokens and tiles are captured per-object from Foundry's live display only when they change. While Planetside is active, Foundry's own per-frame 2D canvas render is suspended (the `#board` is hidden and contributes nothing visible) — its ticker keeps running, so animation logic, timers, and hooks like `refreshToken` still fire and propagate to the globe.
- The globe renders **on demand**: it re-draws only on frames where something changed (camera moved, a placeable was re-captured, or a resize). When nothing is moving it does no WebGL work, so an idle globe costs about what an idle flat map does. Ping pulses animate on the compositor and keep going while the globe sits idle.
- A Three.js scene displays a sphere mesh in the visible canvas region. The map image is wrapped onto the sphere using a **selectable projection** — equirectangular by default (the right fit for a flat map), or Mercator / equal-area — chosen per scene in the Planetside config tab. The projection's `lat ↔ V` curve is the single source both the mesh UVs and the input/ping/HUD inverse derive from, so clicks and pings land where the texture shows them.
- A configurable **latitude span** sets how far toward the poles the map reaches. At ±90° (equirectangular/equal-area) the map covers the whole sphere; at a smaller span — or with Mercator — the uncovered **polar caps** are filled with the average color of the map's perimeter.
- A constrained orbit camera circles the sphere with world Y locked as up and the sphere center as the look-at target. Elevation is clamped strictly short of ±90°.
- Pointer events on the Three.js canvas first raycast the token meshes. A hit forwards the interaction semantically by calling Foundry's real token handlers (`control`, `releaseAll`, the actor sheet, the Token HUD). A miss is raycast against the sphere, inverse-Mercator-projected back to 2D scene coordinates, and dispatched as a synthesized PIXI federated event on the offscreen PIXI stage.
- A small set of Foundry DOM overlays (token HUD, chat bubbles, tooltips) are reanchored each frame to the screen position where their 2D scene coordinate projects on the sphere.
- Canvas **pings** appear on the globe: the per-client ping render (`ControlsLayer#drawPing`) is intercepted (the flat-canvas ping still runs) and a transient marker, colored by the pinging user, is drawn at the ping's projected sphere position — auto-expiring and hidden when the location is on the far hemisphere. (Mirroring a GM "pull" ping by rotating the camera to it is a planned follow-up, reusing the camera `focus()` primitive.)

## Controls

When the globe opens, it plays a brief establishing shot — starting wide and side-on, slowly spinning around the vertical axis (like the globe turning) and zooming in, then tilting up at the end to settle on the scene's configured default view (`scene.initial`): the default-view point becomes the camera's center and the default zoom maps to the orbit radius. Scenes with no default view set settle centered on the scene. The settle runs through a general camera `focus()` primitive (eased move to a scene location) that also backs the GM pull (below).

- **Left-click a token**: select it (double-click opens its sheet; right-click opens its HUD).
- **Left-click empty globe**: deselect.
- **Right-click drag (off any token)**: orbit camera (azimuth + elevation).
- **Scroll wheel**: zoom in/out (radius).
- **Long-press empty globe**: drop a ping at that location (instant, fired directly via `canvas.ping`; no cooldown).
  - **Alt + long-press**: an **alert** ping — a distinct urgent (red) marker on the globe.
  - **Shift + long-press (GM only)**: a **pull** — every player's globe (and the GM's) eases to the pinged location via the `focus()` primitive. A non-GM Shift+long-press is just a normal ping.
- **Left-click on empty sphere**: forwarded to the 2D scene at the corresponding coordinate (sphere raycast → inverse Mercator → synthesized PIXI event). Note that flat-scene interactions which depend on Foundry's hover→click state machine (rulers, wall placement, etc.) are subject to the same `MouseInteractionManager` limitation described under "Token layer" and may not respond from the globe.

## v1 limitations

Some are intentional, some are known-but-deferred.

### East-west seam

The map rectangle's left and right edges represent the same meridian on the sphere (the map always wraps fully around). The visible texture wraps continuously, but Foundry's wall, lighting, and vision solvers compute on a non-wrapping rectangle and **do not** treat the seam as connected. A wall placed near the right edge will not occlude vision into the left edge; a torch placed near the seam will not cast light past it.

**Author guidance:** position the seam over terrain where gameplay doesn't happen (ocean, wasteland, sky).

### Distance and area

Spell templates, rulers, AoEs, and light radii are computed on the flat 2D scene and merely *look* curved on the sphere. Visual distance on the globe does not correspond to scene grid distance in any meaningful way away from the equator. Document this for your players.

### DOM overlays supported in v1

The following core Foundry overlays are reanchored to the projected sphere position of their target:
- Token HUD (button ring around a selected token)
- Chat bubbles
- Tooltips (when an anchor coordinate is attached)
- Pings (transient marker at the pinged location, in the pinging user's color; hidden on the far hemisphere)

Other DOM overlays — both Foundry's and from other modules — may appear in their original 2D position, disconnected from where their target visually lands on the sphere. No general-purpose third-party module compatibility is committed to in v1.

### Performance

The globe renders on demand (only when the view changed) and suspends Foundry's redundant 2D render while active, so an idle globe is roughly at parity with an idle flat map. Placeable capture still uses a CPU-side pixel readback from PIXI to Three.js (GPU → CPU → GPU), but only when a placeable actually changes — it is change-driven, not per-frame. On lower-end hardware or very large maps a capture-heavy moment (many tokens moving at once) may still be slow; a shared-WebGL-context zero-copy capture is a known follow-up but is not in v1.

## Repository layout

```
planetside/
├── module.json              # Foundry manifest
├── package.json             # Three.js dependency + setup script
├── setup.js                 # Copies three.module.js into scripts/vendor/
├── scripts/
│   ├── main.js              # entry: hooks
│   ├── planetside.js        # controller: activate / deactivate / per-frame tick
│   ├── projection.js        # selectable projection (equirect/mercator/equal-area) + inverse math
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
