## 1. Capture utility

- [x] 1.1 Add a per-token display-capture helper (in `tokens.js`, or a small shared module reusing the `capture.js` pattern) that takes a Foundry `Token` and returns pixels + bounds: render the `Token` display object via `renderer.generateTexture` (or pooled `RenderTexture` + `renderer.render`) and `renderer.extract`
- [x] 1.2 Hide `token.nameplate` for the duration of the capture and restore it afterward, so the name is not baked into the texture
- [x] 1.3 Capture at footprint-pixels × a small supersample factor, capped to a max dimension; record the captured bounds and the (bounds-center − token-center) offset
- [x] 1.4 Return/expose the result as a `THREE.CanvasTexture` (or `DataTexture`) with correct color space and `flipY`

## 2. Tangent-frame orientation

- [x] 2.1 Add a helper on `scene.js` that, given `(lat, lon)`, returns the surface tangent basis (radial normal, north/meridian up, east right) as something the mesh can be oriented from (e.g. a quaternion or basis vectors)
- [x] 2.2 Guard the near-pole degenerate case (body is cropped at ±85°, but handle defensively)

## 3. Rewrite the token mesh pipeline

- [x] 3.1 In `TokenLayer.addToken`, build the plane mesh as today but stop loading the image URL; instead mark the entry dirty for an initial capture
- [x] 3.2 Replace `_applyTexture` (URL load + shared refcount cache) with `_captureTexture(entry)` that runs the capture helper, swaps the mesh `material.map` to the new texture, disposes the previous texture, and stores the bounds/offset on the entry
- [x] 3.3 Size the plane to the captured bounds in globe units (reuse the existing cell→globe scale math) instead of the token footprint
- [x] 3.4 In `_updateEntry`, orient the mesh from the tangent frame (task 2) with NO `rotateZ`; apply the center offset (task 1.3) along the tangent axes so the token center stays on its sphere point
- [x] 3.5 Remove the now-unused `TextureLoader`, placeholder-letter texture, and shared `textureCache`/`_releaseTexture` (or repurpose placeholder only for tokens with no renderable display)
- [x] 3.6 Update `_removeEntry` and `destroy` to dispose each entry's owned texture and pooled render target

## 4. Re-capture on refresh (dirty/coalesce)

- [x] 4.1 Add a per-entry `dirty` flag; set it on `createToken`/`updateToken` and on a new `refreshToken` subscription
- [x] 4.2 Ensure the `refreshToken` hook is wired to the layer (via `main.js`/controller as needed) and routes to the matching entry
- [x] 4.3 In `TokenLayer.update()` (per-frame tick), capture at most one dirty token per frame per token (coalesce); defer extra dirty tokens to subsequent frames
- [x] 4.4 Run the capture on the frame tick (not synchronously inside the hook) so Foundry has finished its own refresh/layout first

## 5. Smoke testing in Foundry

- [x] 5.1 Verify a token's image still renders correctly (lie-flat, correct size, correct rotation baked from `doc.rotation`) — image renders filled, correctly scaled, single clean composite. NOTE: image is drawn as a plain Sprite of `mesh.texture` (the PrimarySpriteMesh only renders an outline outside its primary-group framebuffer); decorations rendered per-object (`border`/`bars`/`effects`/`target`), NOT the whole Token container (which holds occlusion children that punch a transparent hole).
- [x] 5.2 Control a token; verify the selection border appears on the globe in Foundry's border color, and disappears on release — confirmed
- [x] 5.3 Toggle status effects; verify the icons (and overlay effect) appear/disappear on the globe matching the flat map — confirmed
- [ ] 5.4 Verify the DOM nameplate still shows and the baked name does NOT appear in the texture
- [ ] 5.5 Move a token (drag on flat map / animate); verify the globe mesh tracks and re-captures without per-frame thrash (coalesced)
- [ ] 5.6 Orbit so a decorated token is near the limb and on the far hemisphere; verify foreshortening looks acceptable and far-side occlusion still works
- [ ] 5.7 Create/delete tokens and deactivate Planetside; verify no texture/RT leaks (textures disposed, no orphan meshes)
- [ ] 5.8 Multi-token stress: several tokens with effects moving at once; note whether a per-frame capture budget is needed

## 6. Docs

- [x] 6.1 Update README's "Token layer" section: tokens now mirror the full Foundry token display (border, status icons, bars) via display capture; note deferred items (hover border, billboarded bars, shared-context capture)
