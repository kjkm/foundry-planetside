## 1. Projection module

- [x] 1.1 Generalize `scripts/mercator.js` → `scripts/projection.js` (class `Projection`, same method surface: `latLonToUv`, `uvToLatLon`, `latLonToSpherePoint`, `spherePointToLatLon`, `isLatitudeOnBody`); constructor takes `{ curve, latitudeSpanDeg }`
- [x] 1.2 Implement the three closed-form curves (forward `latToV` + inverse `vToLat`): equirectangular, equal-area (`sin`), Mercator (existing); add a forward `latToV(lat)` method for mesh UVs (exact inverse of `vToLat`)
- [x] 1.3 `isLatitudeOnBody` / span: `maxLat` from `latitudeSpanDeg`; clamp Mercator's span short of ±90°; allow ±90° for equirect/equal-area
- [x] 1.4 Update all references `this.mercator` → `this.projection` (mechanical rename across input.js, overlays.js, placeables.js, scene.js, planetside.js)

## 2. Scene geometry, UVs, caps

- [x] 2.1 `scene.js`: replace the inline forward map in `_rewriteUvsForMercator` with `projection.latToV(lat)` — single source of truth; apply the texture-flip in exactly one place
- [x] 2.2 `scene.js` `_buildSphere`: derive the body crop (`thetaStart`/`thetaLength`) from the projection span
- [x] 2.3 `scene.js`: render polar caps **only when** the span < ±90° (or Mercator); skip caps when the body covers the full sphere
- [x] 2.4 Confirm no UV/NaN artifact when the body reaches the poles at ±90° (equirect/equal-area)

## 3. Controller wiring + rebuild

- [x] 3.1 `planetside.js`: read `flags.planetside.projection` / `latitudeSpan` (defaults: equirectangular, 90), construct the `Projection` from them
- [x] 3.2 Rebuild the globe (geometry + UVs + caps) when those flags change on the live scene (reuse the existing `updateScene` re-evaluation path; effectively re-activate)

## 4. Scene-config controls

- [x] 4.1 Add a **Projection** dropdown (Equirectangular / Mercator / Equal-area, `name="flags.planetside.projection"`) and a **Latitude span** number field (`name="flags.planetside.latitudeSpan"`, ~30–90) to the Planetside tab
- [x] 4.2 Reflect current flag values on open; apply documented defaults when unset (Equirectangular, 90)
- [x] 4.3 Saving applies live (rebuild without reload), consistent with the other Planetside flags

## 5. Docs

- [x] 5.1 README: document the projection options (equirectangular default; Mercator/equal-area), the latitude-span knob, the conditional caps, and that full-wrap is retained (non-2:1 maps stretch horizontally)
- [x] 5.2 `openspec validate selectable-projection --strict`

## 6. Smoke testing in Foundry

- [x] 6.1 Equirectangular (default): a flat map shows uniform per-latitude mapping (no Mercator polar shrinkage); at ±90° the map reaches the poles with no caps
- [x] 6.2 Switch to Mercator → the previous look returns (polar compression), caps present; switch to equal-area → poles area-true
- [x] 6.3 Change latitude span → coverage band changes; caps appear/disappear accordingly
- [x] 6.4 **Round-trip correctness under each projection:** long-press to ping a known map feature and left-click a token — the marker/selection lands exactly on the feature (forward/inverse consistent)
- [x] 6.5 Changing projection/span in the scene-config tab rebuilds the live globe without a reload
