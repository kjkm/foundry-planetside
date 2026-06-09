## Why

On scene load the globe stutters: black → freeze → flat texture → freeze → the establishing shot cuts in partway through. The cause is **full-resolution CPU image processing on the load path**: `heightfield._ingest` does a full-res `getImageData` + a Sobel normal-map pass over *every pixel*, and `scene._onImageLoaded` does a full-res `getImageData` for cap colors — all synchronous, on the main thread, scaling with the source image resolution **squared**, and run 2–3× as the body rebuilds on each async load. The CPU mesh deform (~33k vertices) is comparatively trivial. Meanwhile the establishing shot is a wall-clock (`performance.now`) tween started in `activate()` *before* the loads, so while the main thread is frozen it keeps advancing and then snaps to mid-animation when frames resume.

We want the globe to **reveal flat-textured immediately and swap terrain in when it's ready**, with the heavy work made cheap and off the critical path, and the opening playing smoothly instead of jumping.

## What Changes

- **Downsample the CPU derivation.** The heightmap is drawn to a capped working-resolution canvas before readback; the Sobel normal map and the per-vertex bake-sampling operate on that working buffer (not the full source). The cap-color readback uses a small canvas too. The **color texture stays full-resolution** (GPU upload — crisp and ~free). Cost stops scaling with high-res source images (e.g. 4K→~1K ≈ 16× less CPU work) with no visible loss (geometry detail is capped by tessellation; a ~1–2K normal map is ample).
- **Flat reveal, terrain swaps in.** Reveal the flat-textured globe as soon as the color texture loads; build terrain asynchronously and swap it in (via the existing `rebuildBody`) when its now-cheap build completes. The terrain build never blocks the initial reveal or interaction.
- **Coalesce the rebuilds.** Build the flat body once and bake terrain once (when the heightmap is ready), instead of 2–3 full rebuilds across the bg/heightmap loads.
- **Gate the establishing shot.** Start the opening when the globe is first revealed (not in `activate()` before assets load), so it plays as a smooth eased move and can't advance/jump during a load freeze.

## Capabilities

### Modified Capabilities

- `globe-terrain`: the CPU derivation (height readback, normal-map Sobel, vertex bake) runs at a capped working resolution independent of source-image size; terrain is built asynchronously and swaps in without blocking the initial flat-textured reveal.
- `globe-camera`: the establishing shot begins when the globe is first revealed and is not corrupted (jumped) by load-time main-thread work.

## Impact

- **Code:** `scripts/heightfield.js` (downsample to a working canvas in `_ingest`; Sobel/bake on the working buffer), `scripts/scene.js` (downsample the bg cap-color readback; reveal-then-swap; single bake), `scripts/planetside.js` (sequence: reveal flat on color-texture ready → start intro → swap terrain when ready; coalesce rebuilds), `README.md`.
- **Behavior:** during load, content (tokens/pings) sits at flat elevation and lifts onto the terrain when it swaps in — a brief, expected pop. The 2D scene is unaffected.
- **Performance:** load-time CPU work drops by the downscale ratio squared and runs once; no full-resolution `getImageData`/Sobel on the source; color crispness unchanged.
- **Out of scope (optional follow-up):** moving the Sobel/bake into a **Web Worker** for a perfectly seamless swap (zero hitch even mid-animation). The swap architecture here is identical whether the math runs on-main (downsampled) or in a worker, so a worker can be dropped in later without redesign. Also out of scope: changing the projection/terrain math or the 2D scene.
