## Context

The projection is fully encapsulated as one bidirectional `lat ↔ v` curve. `mercator.js` holds the inverse-facing methods (`latLonToUv`, `uvToLatLon`) plus projection-independent helpers (`lon ↔ u` linear, `lat/lon ↔ 3D` spherical, `isLatitudeOnBody`). `scene.js._rewriteUvsForMercator` **duplicates** the forward half inline for the mesh UVs (`v = 0.5 + 0.5·(yMerc/yMax)` — note the `+`, a texture-flip vs `mercator.js`'s `−`). Everything else — input forwarding, ping/placeable/HUD positioning, camera targets — derives from those two methods, so swapping the curve propagates correctly *iff* forward and inverse remain exact inverses and the two copies agree.

`maxLatitudeDeg = 85` (Mercator's crop) feeds both the inverse math and the body geometry crop (`_buildSphere`: `thetaStart/thetaLength`) and the polar caps (the caps fill `±maxLat → ±90°`).

## Goals / Non-Goals

**Goals:**
- Per-scene selectable projection curve (equirectangular default / Mercator / equal-area), each closed-form both directions.
- Configurable latitude span, decoupled from the projection choice.
- One source of truth for the curve (kill the scene.js duplication).
- Consumers unchanged; correctness preserved (clicks/pings land where the texture shows).

**Non-Goals:**
- Partial-longitude coverage / aspect preservation (chose full-wrap; non-2:1 stretches).
- E-W seam behavior, non-cylindrical projections.
- A continuous warp slider (named set first; slider is a clean fast-follow).

## Decisions

### D1: Projection = a selectable, closed-form `lat ↔ v` curve

Generalize `Mercator` into a `Projection` (rename `mercator.js` → `projection.js`, class `Projection`; keep the method surface — `latLonToUv`, `uvToLatLon`, `latLonToSpherePoint`, `spherePointToLatLon`, `isLatitudeOnBody` — so call sites change only at construction + the `this.mercator` → `this.projection` rename). It carries a `curve` and `maxLat` (span). Normalize `s = lat / maxLat ∈ [−1,1]`:

```
                     v (forward, for UVs)              lat (inverse)
  Equirectangular:   v = 0.5 + 0.5·s                   s = 2v−1;  lat = s·maxLat
  Equal-area:        v = 0.5 + 0.5·(sin lat / sin maxLat)   lat = asin((2v−1)·sin maxLat)
  Mercator:          v = 0.5 + 0.5·(yMerc / yMax)      lat = 2·atan(e^((2v−1)·yMax)) − π/2
                     (yMerc = ln tan(π/4+lat/2), yMax at maxLat)
```

All three are closed-form both ways — no numerical inversion, so the inverse path (per-frame, hot) stays cheap and exact.

Alternative considered: a continuous γ-exponent blend as the *only* control. Deferred — the named curves are predictable and each maps to a real cartographic meaning ("my map is drawn in X"); a γ slider can layer on later.

### D2: One forward map, one flip

`scene.js` stops computing UVs inline and calls `projection.latToV(lat)` (a small forward method, the exact inverse of the per-vertex `vToLat`). The texture-flip (`+` vs `−`) is applied in exactly one place so render UVs and the click/ping inverse can never drift. This is the single correctness-critical edit.

### D3: Latitude span decoupled from curve; caps conditional

`maxLat` becomes a per-scene knob. The body geometry crop derives from it (`thetaStart = π/2 − maxLat`, `thetaLength = 2·maxLat`). Caps are drawn **only when `maxLat < 90°`** (a gap exists). At `maxLat = 90°` (allowed for equirect/equal-area) the body reaches the poles and caps are skipped entirely. Mercator forces `maxLat < 90°` (its `yMax` diverges at 90°), so Mercator always has caps — clamp its span below 90°.

### D4: Defaults

Default projection = **equirectangular**, default span = **±90°** (full sphere, no caps) — the correct, least-surprising mapping for a flat map. Existing scenes re-render this way (visual change, intended). Per-scene flags: `flags.planetside.projection` (`"equirectangular" | "mercator" | "equalArea"`) and `flags.planetside.latitudeSpan` (degrees). Unset → the defaults. Mercator's default span (if chosen) clamps to ~85°.

### D5: Apply on change via rebuild

Projection/span are read at activate and on the `updateScene` flag-change path the module already watches. Changing either rebuilds the globe geometry + caps (effectively re-activate) — the UV rewrite, crop, and caps all depend on them. One-time cost; no per-frame impact. The inverse path needs no rebuild (reads current params each frame).

## Risks / Trade-offs

- **[Forward/inverse drift → clicks & pings miss the texture]** → the whole design hinges on D2: one curve, closed-form inverse, one flip site. Verify by pinging/clicking a known feature under each projection and confirming the marker lands on it.
- **[Renaming `mercator.js`/`this.mercator` touches ~5 files]** → mechanical pure-rename; method surface unchanged keeps it low-risk. Could be staged as its own commit.
- **[Equirect default changes how existing globes look]** → intended (fixes the shrinkage); Mercator is one dropdown away. Called out as a breaking visual default.
- **[Equal-area / equirect at exactly ±90°: pole vertices]** → the body sphere reaches the poles; the top/bottom vertex rings collapse to the pole points (standard globe-texture behavior). Confirm no UV/NaN artifact at the seam-pole corner.

## Open Questions

- **O1:** Continuous γ "warp" slider on top of the named set — include now or fast-follow? (Lean: fast-follow.)
- **O2:** Mercator's clamped default span — 85° (today) or expose only as a user choice? (Lean: keep 85° default when Mercator is selected.)
