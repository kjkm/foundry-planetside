## Context

`input.js` already raycasts tokens first; on a miss it raycasts the sphere, inverse-Mercator-projects the hit to a 2D scene coordinate (`sceneX/sceneY`), and forwards a synthesized PIXI event for the flat-scene path. Tile-click triggers slot into that existing miss-token branch: we already have the scene coordinate of the click; we just need to find the tile under it and fire its MATT actions.

Exploration established the mechanism (no PIXI/MIM plumbing needed):
- MATT exposes `tile.document.trigger(args)` where `args = { tokens, userId, method, pt, options }`.
- Calling it runs the tile's action list regardless of `method`, so **we** must gate on the tile's configured trigger types (`flags["monks-active-tiles"].trigger`) to only fire on a real `click`.
- MATT trigger tiles are frequently **imageless regions** (render nothing on the globe), so we must locate tiles by scene-coordinate hit-testing, not by raycasting a rendered tile mesh.

## Goals / Non-Goals

**Goals:**
- A globe left-click over a tile configured for a MATT `click` trigger fires that tile's MATT actions, including for imageless trigger regions.
- No-op cleanly when MATT is absent, the tile has no click trigger, or no tile is under the click.

**Non-Goals:**
- Token-enter / hover / other MATT trigger types (enter already fires from flat-map movement).
- Tile selection, drag, resize, or editing on the globe.
- Honoring MATT's full restriction/permission model beyond passing sensible args (we replicate the click-type gate; deeper per-user restriction is MATT's own concern inside `trigger`).
- Non-MATT tile click behavior (e.g. core tile selection).
- Rendering changes (done in `tile-display-capture`).

## Decisions

### Locate tiles by scene-coordinate hit-test, not mesh raycast

In the existing miss-token branch, after computing the click's `sceneX/sceneY`, iterate `canvas.tiles.placeables` and select those whose footprint rectangle `(doc.x, doc.y, doc.width, doc.height)` contains the point. This works for imageless trigger regions (no mesh required).

- **Alternative — raycast rendered tile meshes**: rejected; imageless trigger tiles have no mesh to hit, and those are exactly the MATT case.
- **Rotation:** v1 uses the axis-aligned footprint rect (ignores tile rotation). Rotated trigger tiles are an accepted edge-case gap; note it.

### Gate on the tile's configured `click` trigger

For each tile under the point, read `flags["monks-active-tiles"]`; only fire if present, `active !== false`, and its `trigger` list includes `"click"`. This replicates MATT's own type gate (since `document.trigger` itself does not filter by method) and prevents firing `enter`-only regions on click.

### Fire via `tile.document.trigger`

Call `tile.document.trigger({ method: "click", pt: { x: sceneX, y: sceneY }, tokens: <controlled token documents>, userId: game.user.id })`. No event synthesis, no MIM. Wrap in try/catch so a MATT error doesn't break input handling.

### Gesture and overlap

Fire on the **left pointer-down** over the tile (consistent with how token selection is handled), using the click's scene point as `pt`. If multiple click-configured tiles overlap the point, fire **all** of them (MATT regions rarely overlap; firing all is simplest and avoids guessing z-order).

- **Alternative — topmost only (by `sort`)**: closer to flat-map single-target click, but adds ordering logic for a rare case; revisit if double-firing is observed.

### Relationship to existing empty-click deselect

The miss-token left-click currently calls `canvas.tokens.releaseAll()` (deselect). Tile-trigger firing is additive and does not change that; a click that triggers a tile may also deselect tokens, which matches flat-map behavior closely enough for v1.

### MATT-optional

All of this keys off `flags["monks-active-tiles"]` and `document.trigger`; if MATT is not installed or no tile qualifies, nothing happens. No hard dependency.

## Risks / Trade-offs

- **[`document.trigger` arg shape / `MonksActiveTiles.allowRun` gating across MATT versions]** → Confirmed for the installed MATT (12.02); wrap in try/catch and treat trigger as best-effort. If a future MATT changes the signature, this is the one call to update.
- **[Rotated trigger tiles]** → Axis-aligned hit-test may mis-fire near corners; accepted v1 gap.
- **[Overlapping tiles fire multiple triggers]** → Accepted; revisit with topmost-only if it causes issues.
- **[Players vs GM]** → We pass `userId: game.user.id` and controlled tokens; MATT applies its own restriction inside `trigger`. If player triggering misbehaves, that's inside MATT, not our forwarding.

## Open Questions

- Fire on pointer-down vs pointer-up (a fuller "click"). Lean down for snappiness; switch to up if it feels wrong.
- Whether to also forward `dblclick`/`rightclick` methods — cheap to add; defer unless wanted.
- Whether to suppress the empty-click `releaseAll` when a tile trigger fires — minor UX; leave as-is for now.
