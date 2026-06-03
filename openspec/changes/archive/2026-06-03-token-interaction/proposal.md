## Why

The `token-layer` change rendered Foundry tokens as visual sprites on the globe, but clicking on them does not reliably interact with the underlying Foundry token — pointer events flow through the existing sphere-raycast + inverse-Mercator pipeline, whose precision can miss the underlying token coord by a few pixels and means the click lands on empty scene space.

For the practical use case driving Planetside — settlements, cities, and points of interest rendered on a planet — the GM and players need to click those tokens to open actor sheets, trigger module-attached macros (Monk's Active Tiles scene transitions, etc.), and access the token HUD. This change makes click, double-click, and right-click on globe token sprites route reliably to the underlying Foundry token, by raycasting the token meshes directly and dispatching synthesized PIXI events at the token's exact known 2D coordinate.

This is v0.1 of token interaction. Drag-to-move, drop-from-sidebar, hover effects, selection rings on the globe, and other visual feedback are explicitly deferred. Standard Foundry behavior triggered by clicks (selection, sheet opening, module hooks) provides sufficient feedback for the v0.1 use case.

## What Changes

- Extend `InputForwarder` with a token-mesh raycast pass that runs before the existing sphere raycast.
- On left-button pointerdown / pointerup on a token mesh: synthesize the existing `pointerdown` / `pointerup` / `click` PIXI events at the underlying token's exact `(x, y)` scene coordinate (the token's center, read from the token document). No Mercator inverse for tokens.
- Detect double-click via two single-clicks within Foundry's standard double-click time window (~250 ms); synthesize the second click as a `pointertap` followed by Foundry's normal sheet-opening behavior. If standard PIXI event sequencing already produces double-clicks naturally from two clicks, no extra synthesis needed.
- On right-button pointerdown on a token mesh: synthesize a right-click PIXI event at the token's coord (opens Token HUD / context menu). On right-button pointerdown not on a token mesh: continue to suppress event forwarding so the camera orbit consumes the input (existing behavior unchanged).
- On miss (pointer event does not hit a token mesh): fall through to the existing sphere raycast + inverse Mercator path (preserves deselect-on-empty-click, ruler, etc.).

## Capabilities

### New Capabilities
<!-- No new capabilities introduced; this is a behavioral extension of an existing capability. -->

### Modified Capabilities
- `globe-input`: The pointer forwarding flow SHALL raycast token meshes before the sphere; on hit, dispatch events at the token's known scene coordinate. Right-click on a token mesh SHALL route to the token HUD instead of camera orbit. Double-click on a token mesh SHALL route to Foundry's standard double-click behavior.

## Impact

- Affects `scripts/input.js` (extend `InputForwarder`) and requires a reference to the `TokenLayer`'s entry map so the raycaster has the list of meshes plus the token associated with each.
- Affects `scripts/planetside.js` (pass the token layer reference into `InputForwarder` constructor).
- No new modules introduced. No changes to the token render layer, scene, camera, atmosphere, lens flare, or starfield.
- No new module-compatibility concerns: events flow through the same PIXI federated event system, so any module that listens for token clicks (Monk's Active Tiles, Token Magic FX click handlers, etc.) continues to work without modification.
- Selection rings and other visual feedback on the globe remain out of scope; users see the consequences of clicks via Foundry's standard side effects (sheet opens, module reactions, etc.).
