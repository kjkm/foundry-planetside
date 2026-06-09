## 1. Lighting flags + defaults

- [x] 1.1 `readLightingFlags(scene)` helper (new `scripts/lighting.js` or alongside the others) + `LIGHTING_DEFAULTS` = the current constants (`ambient 0.08`, `sunIntensity 1.0`, sun color `#ffffff`, `sunAzimuth ≈ 45`, `sunElevation ≈ 12` from `SUN_DIRECTION (1,0.3,1)`, `atmosphereColor #c8e0ff`, `atmosphereIntensity 1.0`)
- [x] 1.2 az/el → direction helper (`dir = (cos el·sin az, sin el, cos el·cos az)`); confirm defaults reproduce the current `SUN_DIRECTION`

## 2. Scene: live setters

- [x] 2.1 `scene.js`: `SUN_DIRECTION` → instance field; `setSunDirection(dir)` updates `sunLight.position`, `sunSprite.position`, `lensFlare.setSunWorldPosition`, and both atmosphere shells' `uSunDirection` (single sync point)
- [x] 2.2 `applyLighting(flags)`: set `ambient.intensity`, `sunLight.intensity`, `sunLight.color` + `sunSprite.material.color` (sun color), `setSunDirection(fromAzEl)`, atmosphere outer `uColor`, both shells' `uIntensity = base × atmosphereIntensity`; then it's ready to render
- [x] 2.3 Keep the build-time constants as the defaults the setters fall back to (so a flagless scene is identical)

## 3. Controller wiring

- [x] 3.1 `planetside.js`: call `scene3d.applyLighting(readLightingFlags(canvas.scene))` on activate (after the scene is built) and `markDirty()`
- [x] 3.2 On the `updateScene` flag-change path: `applyLighting` + `markDirty` — NO rebuild (distinct from the projection/terrain rebuild path)

## 4. Scene-config controls

- [x] 4.1 Add Sun (color `input[type=color]`, intensity, azimuth, elevation), Ambient (intensity), Atmosphere (color, intensity) controls to the Planetside tab, `name="flags.planetside.*"`, with sensible ranges (sun ~0–3, ambient ~0–1, az 0–360, el −90–90)
- [x] 4.2 Reflect current flag values on open; defaults when unset; `main.js` template data includes the lighting flags
- [x] 4.3 Saving applies live (no reload/rebuild)

## 5. Docs

- [x] 5.1 README: document the lighting/atmosphere controls (sun color/intensity/position-as-time-of-day, dark-side, atmosphere color/intensity), live apply, defaults preserve the look
- [x] 5.2 `openspec validate globe-lighting-config --strict`

## 6. Smoke testing in Foundry

- [ ] 6.1 Each control changes the globe live on save (no reload): ambient brightens/darkens the night side; sun intensity/color; atmosphere color/intensity
- [ ] 6.2 Sun azimuth/elevation moves the sun, sprite, flare, AND the day/night terminator together (no drift); azimuth sweeps the terminator across the map
- [ ] 6.3 Flagless scene renders identically to before (defaults preserve the look)
- [ ] 6.4 No per-frame cost (settings are static; the globe still idles when nothing moves)
