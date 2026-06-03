## 1. Module scaffolding

- [x] 1.1 Foundry module skeleton (`module.json` targeting v12.343, entry script, manifest fields)
- [x] 1.2 Three.js vendored into `scripts/vendor/` via `setup.js` (`npm install` triggers vendor copy)
- [x] 1.3 Module init / canvasReady / canvasTearDown hooks registered; per-scene flag-driven activation API

## 2. Static map projection

- [x] 2.1 Load `canvas.scene.background.src` via `THREE.TextureLoader`, bind to sphere body material
- [x] 2.2 Sphere body geometry as a Mercator-cropped partial sphere (±85° latitude)
- [x] 2.3 Rewrite body vertex UVs so latitude maps to V via Mercator formula
- [x] 2.4 Texture wrap U continuous (`RepeatWrapping`), V clamped
- [x] 2.5 Mount Three.js canvas in `#board`'s parent and hide `#board` via CSS while module active
- [x] 2.6 Restore visible PIXI canvas on deactivation; dispose Three.js resources

## 3. Polar caps

- [x] 3.1 Build north and south cap spheres covering the cropped polar regions
- [x] 3.2 On image load, sample the perimeter of the loaded image and average into a single RGB color
- [x] 3.3 Apply the averaged color to a shared cap material

## 4. Camera

- [x] 4.1 Constrained orbit controller parameterized by (azimuth, elevation, radius)
- [x] 4.2 Lock camera up vector to world Y and target sphere center each frame
- [x] 4.3 Clamp elevation strictly short of ±90°
- [x] 4.4 Right-drag for orbit, scroll wheel for zoom

## 5. Cinematic space presentation

- [x] 5.1 Ambient + directional sun lights; switch sphere materials to `MeshLambertMaterial`
- [x] 5.2 `useLegacyLights = true` on the renderer
- [x] 5.3 Sun sprite at `SUN_DIRECTION * SUN_DISTANCE` with procedural radial-gradient flare texture
- [x] 5.4 Outer atmosphere shell: `BackSide` sphere with custom Fresnel + sun-modulated shader (blue halo)
- [x] 5.5 Inner atmosphere shell: same shader with tighter radius / higher intensity / white color (limb glow)
- [x] 5.6 Procedural 5000-point starfield on a large sphere with brightness skew and color tint variation, including a rare dim red-orange dwarf population
- [x] 5.7 Lens flare: separate orthographic overlay scene with sprite row positioned along screen-space sun→opposite line
- [x] 5.8 Lens flare occlusion: hide all elements when camera→sun line passes through planet sphere
- [x] 5.9 Lens flare edge fade: smooth opacity falloff as sun approaches screen boundary

## 6. Input forwarding (wired, value pending dynamic capture)

- [x] 6.1 Intercept pointer events on the Three.js canvas
- [x] 6.2 Raycast pointer against the sphere body; compute UV at the hit
- [x] 6.3 Inverse Mercator from UV to scene coordinates, with sceneRect offset added
- [x] 6.4 Dispatch synthesized `PIXI.FederatedPointerEvent` on the rootBoundary's hit target
- [x] 6.5 Off-sphere clicks not forwarded; right-click reserved for camera

## 7. DOM overlay reanchoring (wired, value pending dynamic capture)

- [x] 7.1 Forward-projection helper: 2D scene coord → Mercator UV → sphere point → camera-project → screen
- [x] 7.2 Token HUD reanchoring
- [x] 7.3 Chat bubble reanchoring (keyed by `data-tokenId`)
- [x] 7.4 Tooltip reanchoring (keyed by `data-anchorX` / `data-anchorY`)
- [x] 7.5 Hide overlays whose anchor is on the occluded hemisphere

## 8. Docs

- [x] 8.1 README updated to describe the v0 / static-image scope and the deferred dynamic-capture milestone

## 9. Deferred to a future change — dynamic capture and post-capture work

- [ ] 9.1 Capture the live PIXI canvas onto the sphere texture each dirty frame
- [ ] 9.2 Smoke-test in a real Foundry 12.343 instance with tokens, walls, dynamic lighting, vision, and a Monk's Active Tile
- [ ] 9.3 Validate that synthesized PIXI events fire token selection, ruler, wall placement, and Monk's Active Tile triggers from sphere clicks
- [ ] 9.4 Right-click context menu reanchoring
- [ ] 9.5 Drag-preview ghost reanchoring (or 3D drag indicator alternative)
- [ ] 9.6 Document the east-west seam limitation once it actually matters (requires dynamic capture)
- [ ] 9.7 Decide officially-supported module list for DOM overlay reanchoring beyond Foundry core
