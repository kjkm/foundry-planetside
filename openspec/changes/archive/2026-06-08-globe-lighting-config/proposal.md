## Why

The globe's lighting and atmosphere are hardcoded constants — sun direction/color/intensity, ambient (dark-side) level, and the two atmosphere shells' color/intensity. GMs reasonably want to set a scene's mood: time of day (sun position sweeping the day/night terminator across the map), a brighter or darker night side, a different atmosphere hue/strength, a warmer or cooler sun. Every one of these is a **live parameter on an existing object** (light properties, sprite/flare transforms, shader uniforms), so exposing them is cheap — no geometry rebuild, no async load, no CPU pass, unlike the projection/terrain work.

## What Changes

- **Per-scene lighting/atmosphere controls**, applied live and instantly (just set properties + `markDirty`):
  - **Sun:** color, intensity, and position as **azimuth + elevation** (azimuth reads as time of day — it sweeps the lit/dark terminator around the globe).
  - **Dark side:** ambient light intensity.
  - **Atmosphere:** halo color and intensity.
- **One sun-direction updater.** `SUN_DIRECTION` becomes an instance value with a single `setSunDirection()` that keeps the directional light, the sun sprite, the lens-flare sun position, and both atmosphere shells' `uSunDirection` in sync (today they're set independently at build time).
- **`Scene.applyLighting(flags)`** sets ambient/sun/atmosphere from the flags; the controller calls it on activate and on flag change — **no rebuild path**.
- **Config tab controls** (color inputs + sliders). **Defaults reproduce the current look** exactly, so untouched scenes are unchanged.
- **Static settings only** (an animated day/night cycle would re-introduce per-frame rendering — explicit non-goal).

## Capabilities

### Modified Capabilities

- `space-lighting`: the sun's color, intensity, and direction, and the ambient (dark-side) intensity, become per-scene configurable (defaults preserve the current values); the sun's visual indicators (sprite, lens flare) track the configured direction.
- `atmosphere`: the halo color and overall intensity become per-scene configurable (defaults preserve the current look).
- `scene-config-ui`: the Planetside tab gains sun (color / intensity / azimuth / elevation), ambient, and atmosphere (color / intensity) controls bound to `flags.planetside.*`.

## Impact

- **Code:** `scripts/scene.js` (`SUN_DIRECTION` → instance field + `setSunDirection()` fan-out; `applyLighting(flags)`; ambient/sun-light/sun-sprite/atmosphere setters; current consts become the defaults), a `readLightingFlags(scene)` helper (new `scripts/lighting.js` or alongside the others), `scripts/planetside.js` (call `applyLighting` on activate and on flag change — no rebuild), the scene-config tab + `main.js` template data (incl. color inputs), `README.md`.
- **Performance:** negligible — live property/uniform writes + one render. Fits the dirty-gated loop.
- **Scope guard:** a curated set only. Not exposed (left as constants, possibly "advanced" later): the two atmosphere shells separately, lens-flare element tuning, sun-sprite scale, star brightness, terminator softness (`uDayLo/uDayHi`).
- **Out of scope:** animated day/night cycle; per-token dynamic lighting; changing the 2D scene's lighting (this is the globe view only).
