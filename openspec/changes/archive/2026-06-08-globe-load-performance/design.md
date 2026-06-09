## Context

Load path today (`planetside.activate` → `scene._buildSphere`):
- `_buildSphere` kicks off the color `TextureLoader` (callback `_onImageLoaded`) and synchronously builds the body (flat, high-tess if a heightmap is configured).
- `activate()` starts the establishing shot immediately — `orbit.focus(target, { animate, duration: 4400 })` — a `performance.now()` tween.
- The `Heightfield` constructor kicks off the heightmap `TextureLoader`; its callback `_ingest` does a **full-res** `getImageData` + luminance buffer + `_buildNormalMap` (Sobel over every pixel), then `onReady` → `rebuildBody`.
- `_onImageLoaded` does a **full-res** `getImageData` for cap colors, then `rebuildBody`.

So each async image load runs heavy synchronous CPU work and triggers a full rebuild; the wall-clock intro advances through the freezes and snaps when frames resume. Cost scales with image resolution²; the ~33k-vertex bake is minor by comparison.

The swap mechanism already exists (`rebuildBody` disposes the flat body and builds the terrain body). This change makes the build cheap, runs it once, and fixes the sequencing — it is not new architecture.

## Goals / Non-Goals

**Goals:**
- Load cost independent of source-image resolution (color stays full-res for crispness).
- Flat-textured globe revealed promptly; terrain swaps in when ready; build never blocks reveal/interaction.
- Establishing shot plays smoothly from reveal — no jump.
- One flat build + one terrain bake (no redundant rebuilds).

**Non-Goals:**
- Web Worker / off-main-thread derivation (optional follow-up; same swap architecture).
- Changing terrain/projection math, content-on-terrain behavior, or the 2D scene.
- Progressive LOD streaming of the color texture.

## Decisions

### D1: Downsample the CPU derivation; keep the color texture full-res

In `heightfield._ingest`, draw the loaded image onto a working canvas capped to `TERRAIN_WORK_MAX` (e.g. 1024–2048 px on the long edge, preserving aspect) **before** `getImageData`. The luminance buffer, the Sobel normal map, and `elevationAt` bilinear sampling all operate on that working buffer. `elevationAt` is UV-based, so a smaller buffer changes nothing for the bake except cost. Likewise, `scene._onImageLoaded` draws the bg to a small canvas for the cap-color readback. The body's **`map` (color) texture is the full-resolution `TextureLoader` texture, untouched** — GPU upload, no CPU cost.

Rationale: geometry detail is bounded by tessellation (256×128), and a ~1–2K normal map already carries more relief detail than the eye needs on a globe; the squared cost reduction is the whole win. Working-res cap is tunable.

### D2: Flat reveal, async terrain swap, single bake

- `_buildSphere` builds the flat body (keep). The body shows its color as soon as the `TextureLoader` populates the texture (THREE auto-updates the GPU texture; we `markDirty` on the color-load callback so a frame renders).
- Terrain builds when the heightmap is ready (`heightfield.onReady`) and swaps in via `rebuildBody` (now cheap). This is the only terrain bake.
- **Coalesce:** the bg color-load callback no longer triggers a full `rebuildBody` for the *terrain* — it only needs to (a) reveal the color (texture auto-updates) and (b) refresh cap colors. Cap colors can be applied without a full terrain rebuild, or folded into the single terrain rebuild when the heightmap arrives. Net: one flat build + one terrain bake, regardless of load order. (If a heightmap is set but the color loads first, caps still get their colors on the terrain rebuild; if no heightmap, a lightweight cap-color refresh only.)

### D3: Gate the establishing shot on reveal

Do not start the animated intro in `activate()`. Snap to the wide establishing pose immediately (so there's a framed view, not a black void), and start the **animated** `focus(target, …)` when the globe is first revealed (color texture ready / first real frame). This removes the wall-clock-vs-freeze jump: the tween only begins once frames are actually flowing. The terrain swap then lands during or after the intro; with D1 the swap is a blip, not a freeze.

### D4: When does terrain swap relative to the intro?

Default: **swap as soon as terrain is ready** (downsampled build is a tens-of-ms blip). If that blip is noticeable mid-zoom, defer the swap to the camera-settle (intro completes on the flat globe, terrain pops in on arrival). Pick by feel; both are cheap to switch between. (A worker would make this moot — out of scope.)

## Risks / Trade-offs

- **[Working-res too low → soft relief]** → cap chosen ≥ tessellation and high enough for crisp normals (~1–2K); tunable constant. Color is unaffected, so the map stays crisp regardless.
- **[Swap blip lands mid-intro]** → downsampling shrinks it to a blip; D4 fallback (swap at settle) removes it entirely without a worker.
- **[Content pop on swap]** → tokens/pings lift from flat to terrain elevation when terrain swaps in. Brief, during load; accepted (could ease later).
- **[Reveal shows color before caps are colored]** → on a capped globe the caps briefly show the flat average until the (single) terrain/cap build lands; negligible and brief.

## Open Questions

- **O1:** `TERRAIN_WORK_MAX` value — pick by eye (start ~1536; relief crispness vs load cost).
- **O2:** Swap timing (D4) — live vs at-settle. Lean: live (downsampled blip is small); revisit if noticeable.
- **O3:** Worker follow-up — defer unless the on-main blip is still objectionable after D1.
