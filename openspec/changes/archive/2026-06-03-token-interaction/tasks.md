## 1. Wire TokenLayer reference into InputForwarder

- [x] 1.1 In `scripts/planetside.js`, pass `this.tokenLayer` into the `InputForwarder` constructor when activating
- [x] 1.2 In `scripts/input.js`, accept `tokenLayer` in the constructor; store the reference
- [x] 1.3 Confirm listener install order in `Planetside.activate()` puts `InputForwarder.install()` BEFORE `OrbitCamera.install()` so that `stopPropagation` in the forwarder will preempt the camera

## 2. Token mesh raycast

- [x] 2.1 Add `raycastObjects(ndcX, ndcY, objects)` helper to `scripts/scene.js` so input.js doesn't need to import THREE
- [x] 2.2 Add a `_raycastTokenSprites(ndcX, ndcY)` method to `InputForwarder` that builds the list of visible token meshes, raycasts them via `scene3d.raycastObjects`, and returns `{ entry, hit }` for the first facing-camera hit (or null)
- [x] 2.3 Verify the existing `OrbitCamera.isDragging()` guard runs first so we don't interfere with in-progress orbits

> **Implementation pivot (see design.md "Implementation outcome (revised)"):** synthesizing raw PIXI events does not work — Foundry v12's `MouseInteractionManager` silently refuses to enter `HOVER` for synthesized events, so clicks are never recognized. Tasks 3–5 below were re-implemented to forward **semantically** (call Foundry's real handlers off the raycast hit). The raycast/hit-detection work (sections 1–2) stands unchanged.

## 3. Left-click forwarding (semantic)

- [x] 3.1 In `_onPointer` for non-right-button events, run `_raycastTokenSprites` first
- [x] 3.2 On hit: call `token.control({ releaseOthers: !shiftKey })` (real Foundry selection; fires `controlToken`) via `_handleTokenPointer`
- [x] 3.3 On miss: left-click empty globe calls `canvas.tokens.releaseAll()` (deselect); sphere pass-through retained for flat-scene coords

## 4. Right-click forwarding (semantic)

- [x] 4.1 New pointerdown handling for `domEvent.button === 2`: raycast tokens; on hit open the Token HUD (`control()` if needed + `canvas.hud.token.bind`), `stopImmediatePropagation` + `preventDefault`; on miss return (let orbit consume)
- [x] 4.2 Use `stopImmediatePropagation()` (not just `stopPropagation`) so the orbit camera's sibling listener on the same element is preempted; HUD reanchored by `OverlayReanchor`

## 5. Double-click (semantic)

- [x] 5.1 Explicit double-click detection: track `_lastClickByTokenId` timestamps; on a second left-click on the same token within 250 ms, call `token.actor.sheet.render(true)`

## 6. Smoke testing in Foundry

- [x] 6.1 Left-click a token on the globe; verify it selects (selection state observable via `canvas.tokens.controlled`). NOTE: the flat-map selection border is NOT rendered on the globe — the per-token mesh shows the token texture only, not Foundry's selection `Graphics`. Rendering selection/target rings on the globe is a non-goal of this change (possible follow-up).
- [x] 6.2 Left-click empty sphere; verify any currently selected token is deselected (via `canvas.tokens.releaseAll()`)
- [x] 6.3 Right-click a token; verify the Token HUD appears at the token's projected position on the globe (reanchor the inner `#token-hud` element; `#hud` lifted above the globe canvas and its canvas-tracking transform neutralized while Planetside is active)
- [x] 6.4 Right-click empty sphere; verify the camera orbits
- [x] 6.5 Double-click a token; verify the actor sheet opens
- [ ] 6.6 If a module like Monk's Active Tiles is installed, configure a token to trigger a scene transition on click; verify it fires from the globe click — NOT YET TESTED. Note the semantic-forwarding caveat: integrations keying off `controlToken`/`updateToken` or overriding `Token._onClickLeft` will fire; those intercepting the raw PIXI pointer event / MIM `clickLeft` callback will not.
- [x] 6.7 Modifier-key clicks: shift+click multi-select confirmed working

## 7. Docs

- [x] 7.1 Update README to note that tokens on the globe respond to click, double-click, and right-click; mention deferred drag-to-move and drop-from-sidebar as future work
