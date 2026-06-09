## Why

The globe hardcodes a **Mercator** mapping from the flat map to the sphere. But a TTRPG/fantasy map is a flat image, not a Mercator-projected one — so treating it as Mercator erroneously **compresses polar content** (pole shrinkage) on the globe. The right default for a flat image is **equirectangular** (latitude linear in image height); other maps may want Mercator (a genuinely projected source) or equal-area. The projection is already encapsulated as a single bidirectional `lat ↔ v` curve, so making it selectable — plus a latitude-span knob — is well-contained.

Scope is **full-wrap** (the map always wraps 360° around the globe; the "whole world" concept and the E-W seam are unchanged). Non-2:1 maps stretch horizontally, accepted.

## What Changes

- **Selectable projection curve** (`lat ↔ v`), per scene: **Equirectangular (new default)**, **Mercator**, **Equal-area**. Each is closed-form in *both* directions so render UVs and the click/ping/HUD inverse stay exact inverses.
- **Configurable latitude span** — the latitude the image's top/bottom edges reach (generalizes today's hardcoded 85°). Equirect/equal-area may reach ±90° (map covers the whole sphere); Mercator stays bounded.
- **Single source of truth** — the duplicated inline forward map in `scene.js._rewriteUvsForMercator` is removed; the mesh UVs call the projection (the one trap: the texture-flip sign, handled once).
- **Conditional polar caps** — caps render only when the projection+span leave a gap (Mercator, or span < full). At full-sphere coverage the map reaches the poles and no caps are drawn.
- **Scene-config controls** — a projection dropdown and a latitude-span control in the existing Planetside tab, persisted to per-scene flags; changes rebuild the globe (re-activate).
- **BREAKING (visual default):** existing scenes re-render with equirectangular instead of Mercator (less polar shrinkage). Mercator remains one dropdown click away.

## Capabilities

### New Capabilities
<!-- none — extends existing rendering/caps/config capabilities -->

### Modified Capabilities

- `globe-renderer`: the body UV mapping becomes a **selectable projection** (equirectangular default / Mercator / equal-area) with a **configurable latitude span**, replacing the hardcoded Mercator mapping; full-wrap U and the E-W seam are unchanged.
- `polar-caps`: caps become **conditional on coverage** — rendered only when the projection+span leave the poles uncovered; absent when the map covers the full sphere.
- `scene-config-ui`: the Planetside tab gains **projection** and **latitude-span** controls bound to `flags.planetside.*`.

## Impact

- **Code:** `scripts/mercator.js` → a generalized projection module (selectable curve + span; closed-form forward/inverse for each), likely renamed `projection.js` / `Projection` with the same method surface; `scripts/scene.js` (call the projection for mesh UVs, derive the body crop from span, draw caps conditionally, rebuild on change); `scripts/planetside.js` (read projection flags, construct the projection, rebuild on flag change); the scene-config tab + flag defaults; `README.md`.
- **Unchanged behaviorally:** `input.js`, `overlays.js`, `placeables.js`, camera — they already derive from the projection's `uvToLatLon` / `latLonToUv`, so they follow the new curve automatically.
- **Default change:** equirectangular becomes the default projection (visual change to existing globes; intended improvement).
- **Performance:** none per-frame — the UV rewrite is one-time at build; inverse functions stay closed-form.
- **Out of scope:** aspect-preserving partial coverage (chose full-wrap), E-W seam changes, non-cylindrical projections, a continuous warp slider (possible fast-follow on top of the named set).
