## Context

The existing `InputForwarder` (`scripts/input.js`) listens for pointer events on the Three.js canvas, raycasts the body sphere, inverse-Mercator-projects the hit to a 2D scene coordinate, and dispatches synthesized `PIXI.FederatedPointerEvent`s on `canvas.app.renderer.events.rootBoundary`. Right-click is reserved for the camera orbit and not forwarded.

This pipeline reaches tokens by accident: if a click on the globe happens at a screen position where a token sprite is visually rendered, the inverse-Mercator-projected scene coordinate will be in the vicinity of the token's center. PIXI's `boundary.hitTest` will then find the token and dispatch the event. But it is unreliable for two reasons:

1. **Mercator inverse precision.** The inverse projection can land a few pixels off the actual token center, especially near the body sphere's limb where the surface is steep relative to the camera ray. Foundry's token-click hit area is sized to the token's footprint; small misses produce clicks on empty scene rather than on the token.
2. **No direct correspondence to the visual sprite.** The user clicks the visible token sprite. The current flow computes the scene coordinate from the sphere intersection geometry, which is mathematically related to the sprite position but not derived from it. Visual feedback ("I clicked the city's icon") does not directly drive the dispatch coord.

We replace this with a direct token mesh raycast as the first pass. When a token mesh is hit, we *know* the underlying Foundry token, and we use *its* known scene coordinate for the synthesized event. Precision-perfect. The sphere raycast becomes the fallback for clicks not on any token.

Right-click handling follows the same routing rule: right-click on a token mesh forwards a right-click PIXI event (Token HUD opens); right-click anywhere else continues to be consumed by the existing camera orbit.

Double-click handling on the flat map is implemented by PIXI's federated event system tracking two `click` events within a short window. Synthesizing `click` events at the token coord should reproduce this. If empirical testing shows Foundry does not natively double-click-detect from our synthesized events, we add an explicit double-click detection (track timestamps per pointer-id; on second click within 250 ms, dispatch `doubleclick` directly).

## Implementation outcome (revised) — semantic forwarding

The plan above (raycast the token, then synthesize PIXI `FederatedPointerEvent`s at the token's scene coordinate and let Foundry's event pipeline handle them) was implemented and **the raycast/coordinate half works perfectly** — but the synthesized-event half does not, for a reason that is intrinsic to Foundry v12 and not fixable from a module.

**What we proved via console diagnostics:**

1. The token mesh raycast is precise; the looked-up Foundry token is correct.
2. Synthesized events must be dispatched in **global/screen** coordinates, not scene coordinates — `event.global` and `boundary.hitTest` operate on the renderer's screen space, so the token's scene coordinate must be run through `canvas.stage.toGlobal()` first. After this fix, `boundary.hitTest` correctly returns the `Token` and the token's emitter receives `pointerover`/`pointerdown`/`pointerup`.
3. Foundry's real PIXI `EventSystem` stays bound to the (hidden) flat canvas and maps the *actual* cursor position into the same `rootBoundary`, fighting our synthesized hover. Detaching it (`events.setTargetElement(null)` on activate, restore on deactivate) removes that interference.
4. **Even with all of the above correct, the token never selects.** `MouseInteractionManager` (MIM) is a state machine: it only promotes `pointerdown` to a click from the `HOVER` state, and `HOVER` is established solely by `pointerover` (its `handleEvent` has no `pointermove` case). MIM's compiled, private `#handlePointerOver` silently declines to set `state = HOVER` for our synthesized events — `state` stays `NONE`, so every `pointerdown` is swallowed. `can("hoverIn")` returns `true`, the layer is active, `eventMode` is `static`, and `token.control()` called directly works — so the block is specifically inside MIM's private hover handler, which a module cannot observe or patch (PIXI captured a bound reference to the original method at registration, so reassigning `mim.handleEvent` does not intercept it).

**Decision:** forward token interaction **semantically** instead of via raw events. On a raycast hit we call Foundry's real high-level handlers directly:

- Left-click → `token.control({ releaseOthers: !shiftKey })`
- Left-click on empty globe → `canvas.tokens.releaseAll()` (unless shift)
- Double-click (explicit 250 ms timer on the same token) → `token.actor.sheet.render(true)`
- Right-click → `token.control()` + `canvas.hud.token.bind(token)` (toggle), with `stopImmediatePropagation()` to preempt the orbit camera's same-element listener

These are genuine Foundry operations and fire the usual hooks (`controlToken`, etc.); the Token HUD is reanchored to the token's sphere position by the existing `OverlayReanchor`. This honors "use Foundry's real behavior, don't recreate it" at the handler level. The trade-off: modules that intercept the *raw PIXI pointer event* or MIM's `clickLeft` callback chain (rather than overriding `Token._onClickLeft` or listening on `controlToken`/`updateToken`) will not fire from globe clicks. Most token-facing integrations key off the latter and are unaffected.

The sphere/empty-space pass-through (inverse-Mercator → synthesized PIXI event) is retained as-is for the flat-scene v0 behavior, but note it is subject to the same MIM limitation for any interaction that depends on the hover→click state machine.

Sections below marked with synthesized-event mechanics (the "Dispatch synthesized PIXI events…", "Double-click implicit path", and the handler-structure pseudocode) are **superseded** by this outcome for the token case.

## Goals / Non-Goals

**Goals:**
- Left-click on a token sprite on the globe: selects the token (and triggers all module hooks listening for token clicks) reliably, with no Mercator inverse precision concerns.
- Double-click on a token sprite: opens the actor sheet (or whatever Foundry's standard double-click behavior dispatches to).
- Right-click on a token sprite: opens the Token HUD / context menu.
- Right-click on empty sphere or off-token: continues to drive the camera orbit (existing behavior unchanged).
- Left-click on empty sphere: continues to fall through to the existing sphere raycast + inverse Mercator path (preserves deselect, ruler, measurement template, etc.).
- All synthesized events flow through the same PIXI federated event system, so modules listening for token clicks (Monk's Active Tiles, Token Action HUD, etc.) continue to work.

**Non-Goals:**
- Drag-to-move tokens on the globe.
- Drop-from-sidebar onto the globe to create new tokens.
- Selection ring or any other visual state feedback rendered on the globe.
- Hover tooltips, target reticles, status effect icons, HP bars.
- Click-through-the-back-of-the-planet: clicks must hit a visible token mesh (i.e., one on the visible hemisphere) to register as a token interaction.
- Multi-select via shift/ctrl modifiers: not blocked by this design, but not specifically engineered or tested for in v0.1.

## Decisions

### Token raycast happens before sphere raycast

Each relevant pointer event (pointerdown, pointermove, pointerup for the standard flow plus the right-click and double-click special cases) starts by raycasting the `TokenLayer`'s registered meshes via a `THREE.Raycaster` constructed from the pointer NDC. If any mesh is hit, the corresponding Foundry token is looked up via the `entries` map keyed by the mesh's UUID (or by walking the mesh-to-token mapping `TokenLayer` already maintains).

Alternatives considered: raycast everything together (token meshes plus sphere) in one pass and use Three.js's intersection-sort to pick the closest. Rejected — adds complexity for no win; tokens are at `radius=1.001` and the body is at `radius=1.0`, so any token mesh hit is by definition closer than the sphere hit and would always sort first; the conditional logic is simpler than the merged pass.

### Dispatch synthesized PIXI events at the token's exact known scene coordinate

When a token mesh is hit, we read the token's center from `(doc.x + doc.width × gridSize / 2, doc.y + doc.height × gridSize / 2)` and dispatch the synthesized event at that exact coordinate. This eliminates Mercator inverse as a source of imprecision for token clicks; PIXI's `hitTest` always lands on the token because we hand it the token's known center.

### Right-click routing

The right-click pointerdown event is handled specially: it raycasts token meshes; if hit, synthesize a PIXI right-click at the token coord and consume the event (suppress orbit camera for this gesture). If no token is hit, fall through to the existing behavior, which is "do not forward to PIXI, let the orbit camera consume the right-drag." The orbit camera's existing `pointerdown` handler will continue to fire and start the orbit, because we are not preventing it; we are only choosing whether to *also* forward a right-click PIXI event.

To prevent the orbit camera from receiving the right-click DOWN when we intercept it for a token, we call `e.stopPropagation()` and `e.preventDefault()` after the synthesized dispatch. The camera's listener is attached to the same DOM element as the input forwarder, so a stopped event will not reach the camera.

Order-of-installation matters: the InputForwarder's listeners are added before the OrbitCamera's listeners in `Planetside.activate()`. With `addEventListener`'s default capture=false ordering, listeners on the same element fire in registration order. The InputForwarder fires first and may stop propagation. If, in implementation, the camera's listeners turn out to be installed first, we will need to swap the install order in `Planetside.activate()` (small change, documented as a potential gotcha).

### Double-click

Empirical question. Foundry's flat-map double-click behavior derives from PIXI's federated event system tracking successive clicks. Two paths to make this work on the globe:

1. **Implicit**: Synthesize `click` events for each user click on the token. If PIXI's double-click detection fires from our synthesized clicks, no further work is needed.
2. **Explicit**: Track timestamps per pointer ID in `InputForwarder`. If two `click`s on the same token occur within 250 ms (the standard double-click window), dispatch an additional `doubleclick` PIXI event at the token coord.

We start with path 1 and verify via smoke test. If it does not work, fall back to path 2.

### TokenLayer exposes its mesh entries to the InputForwarder

`InputForwarder` is constructed with a reference to the `TokenLayer`. It uses the layer's `entries` map (already publicly accessible at `controller.tokenLayer.entries`) to enumerate `entry.sprite` meshes for raycast targets and to look up the corresponding `entry.token` when a mesh is hit.

Alternative considered: token layer pushes meshes into a "raycast targets" array maintained on InputForwarder. Rejected — adds plumbing without simplifying. Direct read of the entries map is fine.

### Pointer-event handler structure

```
   _onPointer(domEvent):
     if (orbit.isDragging()) return                  // existing
     
     ndcX, ndcY = compute from domEvent              // existing
     
     hit = raycast token meshes from (ndcX, ndcY)    // new
     
     if hit:
       token = lookup token from hit.object
       sceneX, sceneY = token's center coord         // direct, not Mercator inverse
       
       if domEvent.button === 2 (right):
         dispatch right-click PIXI event(sceneX, sceneY)
         stopPropagation, preventDefault             // suppress orbit
       else:
         dispatch PIXI event(domEvent, sceneX, sceneY)   // existing synthesis
     else:
       if domEvent.button === 2: return              // let orbit consume
       
       fall through to existing sphere raycast       // existing
```

## Risks / Trade-offs

- **Right-click order-of-listener issue.** If the orbit camera's pointerdown handler runs before the InputForwarder's, the orbit starts even when the user intended to right-click a token. Mitigated by careful install order in `Planetside.activate()` and `e.stopPropagation()` in the InputForwarder's handler. Smoke test will catch if it doesn't behave as designed.
- **Foundry's native double-click may not fire from synthesized events.** If path 1 doesn't work, we fall back to explicit detection in `InputForwarder`. Either way, double-click should land.
- **Modifier-key combinations (shift-click, ctrl-click) flow through unmodified.** The synthesized event carries the modifier state from the DOM event, so multi-select and similar gestures should work, but we are not specifically engineering or testing them.
- **Drag-to-move is not in scope.** A user expecting to drag a token on the globe will find that the token does not follow; this is intentional and documented in the proposal.
- **Token meshes use `DoubleSide` rendering.** This means a raycast can hit the back of a token mesh as well as the front. If the token's far-side render is "behind" the visible hemisphere check we already do, the user might raycast through the planet and hit a token on the far side. This needs handling: after a token raycast hit, check `isFacingCamera(hit.object.position)` and reject the hit if not facing. (Already a per-frame visibility check; reusing the same logic.)

## Open Questions

- Whether the synthesized `click` events natively produce double-click behavior in Foundry's PIXI event system. To be verified in smoke test; fallback path documented.
- Whether single-click on a token should select the token *and* dispatch any module hooks, or only one of those — Foundry's normal behavior is "both", and our synthesized events should produce that. No design intervention needed unless a smoke test reveals a problem.
- Whether the InputForwarder's existing pointerleave handling needs adjustment for the token-raycast case. Probably not — pointerleave just ends any active drag-state on the rootBoundary, and the new token path doesn't introduce drag state.
