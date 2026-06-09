## Context

Lighting/atmosphere are module constants in `scene.js` feeding runtime objects:
- `AMBIENT_INTENSITY` → `this.ambient.intensity`; `SUN_INTENSITY` → `this.sunLight.intensity`; sun color is `0xffffff` on both light and sprite.
- `SUN_DIRECTION` (a normalized vector) is referenced in *four* places: `sunLight.position`, `sunSprite.position`, `lensFlare.setSunWorldPosition`, and both atmosphere shells' `uSunDirection` uniform.
- `ATMOSPHERE_OUTER`/`ATMOSPHERE_INNER` set each shell's `uColor` / `uIntensity` (+ falloff/day-night params).

All of these are settable at runtime (light props, sprite transform, shader uniforms) — no geometry involved, so this is purely "set values + render", and the dirty-gated loop just needs a `markDirty()` after.

## Goals / Non-Goals

**Goals:**
- Per-scene control of sun (color/intensity/position), ambient (dark side), atmosphere (color/intensity).
- Applied live with no rebuild; defaults reproduce the current look exactly.
- One consistent sun-direction update (no drift between light / sprite / flare / atmosphere).

**Non-Goals:**
- Animated day/night (would force continuous rendering).
- Exposing every parameter (two shells separately, flare elements, star brightness, terminator softness) — curated set only.
- Affecting the 2D scene's lighting.

## Decisions

### D1: One `setSunDirection(dir)` fan-out

`SUN_DIRECTION` becomes an instance field. A single `setSunDirection(dir)` updates `sunLight.position` (`dir × 10`), `sunSprite.position` (`dir × SUN_DISTANCE`), `lensFlare.setSunWorldPosition(dir × SUN_DISTANCE)`, and both atmosphere shells' `uSunDirection.value`. This is the one place that must stay in sync; everything else reads from it. The flags carry **azimuth + elevation** (degrees); `dir = (cos el·sin az, sin el, cos el·cos az)`. Defaults (az ≈ 45°, el ≈ 12°) reproduce the current `SUN_DIRECTION (1, 0.3, 1)`.

Rationale: azimuth reads as "time of day" — rotating it sweeps the lambertian terminator (the body is sun-lit) and the atmosphere day/night boundary together, which is the evocative payoff. Exposing az+el (rather than a raw vector) is the natural user control.

### D2: `applyLighting(flags)` — live, no rebuild

`Scene.applyLighting({ sunColor, sunIntensity, sunAzimuth, sunElevation, ambientIntensity, atmosphereColor, atmosphereIntensity })`:
- `ambient.intensity = ambientIntensity`
- `sunLight.intensity = sunIntensity`; `sunLight.color.set(sunColor)`; `sunSprite.material.color.set(sunColor)` (the visible disk matches)
- `setSunDirection(fromAzEl(sunAzimuth, sunElevation))`
- atmosphere: `outer.uColor.value.set(atmosphereColor)`; `outer.uIntensity.value = ATMOSPHERE_OUTER.intensity × atmosphereIntensity`; `inner.uIntensity.value = ATMOSPHERE_INNER.intensity × atmosphereIntensity`

The controller calls `applyLighting` on activate (after the scene is built) and on the `updateScene` flag-change path; then `markDirty()`. No geometry rebuild, no async.

### D3: Atmosphere color tints the outer halo; intensity scales both shells

The two shells have different roles — outer is the soft blue rim halo, inner is the bright white limb. The single **atmosphere color** sets the **outer** shell's `uColor` (the visible halo hue; default the current `#c8e0ff`), leaving the inner limb white so the look stays coherent. **Atmosphere intensity** is a multiplier on **both** shells' base intensities (default `1.0` = current). This gives "color and/or intensity" without an eight-slider panel and preserves the default appearance.

### D4: Defaults from the current constants

Flag defaults equal today's constants (`ambient 0.08`, `sun intensity 1.0`, sun color white, az/el from `SUN_DIRECTION`, atmosphere color `#c8e0ff`, atmosphere intensity ×1). A scene that never touches these renders identically to now. `readLightingFlags(scene)` falls back to these.

### D5: Config UI

`<input type="color">` for sun color + atmosphere color (hex → flag), number/range inputs for the intensities and azimuth (0–360) / elevation (−90–90). Same `flags.planetside.<key>` form-submit + live-apply pattern as the projection/terrain/title controls.

## Risks / Trade-offs

- **[Sun-direction drift across the four consumers]** → the whole point of the single `setSunDirection` fan-out; never set them independently again. Verify the sprite/flare/terminator all move together.
- **[Atmosphere color only tints the outer shell]** → deliberate (keeps the white limb); documented. If someone wants a fully recolored atmosphere, that's an "advanced"/both-shells follow-up.
- **[`useLegacyLights = true`]** → intensities are in the legacy 0–1-ish range; the sliders' ranges/defaults respect that (sun ~0–3, ambient ~0–1). Pick ranges by eye.
- **[Scope creep]** → curated set; resist adding every uniform. Advanced panel later if wanted.

## Open Questions

- **O1:** Sun position as az+el (chosen) vs a single "time of day" hour slider that also varies elevation seasonally — lean az+el (precise, simple); a time-of-day hour mapping is a thin UI layer we can add later.
- **O2:** Whether to also expose the inner atmosphere color / the terminator softness — deferred unless wanted.
