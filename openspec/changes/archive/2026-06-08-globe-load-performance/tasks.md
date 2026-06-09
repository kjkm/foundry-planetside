## 1. Downsample the CPU derivation

- [x] 1.1 `heightfield.js _ingest`: draw the loaded image onto a working canvas capped to `TERRAIN_WORK_MAX` (long edge, aspect-preserved) before `getImageData`; build the luminance buffer + Sobel normal map from the working buffer (not the source). `elevationAt` is UV-based, unaffected
- [x] 1.2 Pick `TERRAIN_WORK_MAX` (~1536; ≥ tessellation, crisp normals) — tunable constant
- [x] 1.3 `scene.js` cap-color readback: draw the bg to a small canvas before `getImageData` (cap colors are low-frequency); the body `map` texture stays the full-resolution `TextureLoader` texture (untouched)

## 2. Flat reveal, async terrain swap, single bake

- [x] 2.1 On color-texture load: ensure the flat-textured body shows promptly (texture auto-updates; `markDirty` so a frame renders) — do not trigger a full terrain `rebuildBody` from the color load
- [x] 2.2 Build terrain once when the heightmap is ready (`heightfield.onReady` → `rebuildBody`, now cheap) and swap it in; ensure only one terrain bake regardless of bg/heightmap load order
- [x] 2.3 Refresh cap colors without a redundant terrain rebuild (apply on the single terrain build when a heightmap exists; lightweight cap-color update when there's no heightmap)
- [x] 2.4 Verify: flat globe is visible/interactive while terrain is still building; terrain swaps in without blocking

## 3. Gate the establishing shot

- [x] 3.1 `planetside.js activate`: snap to the wide establishing pose immediately, but DEFER the animated `focus(target, …)` until the globe is first revealed (color texture ready / first real frame) — don't start it inline in `activate()`
- [x] 3.2 Verify the opening plays as one continuous eased move (no wall-clock jump through the load); the terrain swap (downsampled blip) lands during/after without corrupting it
- [x] 3.3 If the swap blip is noticeable mid-opening, fall back to swapping at camera-settle (decision O2) — keep it a one-line switch

## 4. Docs

- [x] 4.1 README: note the load behavior (flat reveal → terrain swaps in), the capped working resolution for derivation (color stays full-res), and the worker as a possible future optimization
- [x] 4.2 `openspec validate globe-load-performance --strict`

## 5. Smoke testing in Foundry

- [ ] 5.1 High-res map + heightmap: load shows flat-textured globe quickly (no long black), then terrain swaps in — no multi-second freezes
- [ ] 5.2 The establishing shot plays smoothly from reveal (no cut to mid-animation)
- [ ] 5.3 Terrain quality unchanged to the eye (displacement + relief shading) despite the downsampled derivation; color map still crisp at full res
- [ ] 5.4 Round-trip still correct on terrain (ping/click a peak lands on it); tokens/pings lift onto terrain on swap (expected pop)
- [ ] 5.5 No-heightmap scene: flat globe loads cleanly; cap colors correct; no regression
- [ ] 5.6 Config change (new heightmap / scale) re-bakes live without a freeze
