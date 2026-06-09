## Context

The previous change (globe-render-performance) gave the globe its own long-press handler: `input.js` classifies an empty-sphere left press as click / drag / long-press and, on a long-press, calls `canvas.ping({ x, y }, options)` directly (bypassing `MouseInteractionManager`). It already records `altKey` and `shiftKey` on the gesture and passes `style: "alert"` when Alt is held. So:

- **Alert trigger:** already fires. The probe confirms `drawPing` receives `{ style: "alert", user }`. What's missing is purely the *marker visual* — `overlays.js spawnPing` ignores `options.style` and always draws the same user-colored ring.
- **Pull:** not wired at all. `shiftKey` is captured but unused, and nothing rotates the camera in response to a pull.

Reusable pieces already in place: `OrbitCamera.focus(target, { animate, duration })`; the scene→target mapping inside `Planetside._defaultViewTarget()` (`uvToLatLon` → `azimuth=lon, elevation=lat`, `scale`→radius); the `drawPing` wrap that already hands `options` to `spawnPing`.

## Goals / Non-Goals

**Goals:**
- An alert ping is immediately, visually distinguishable from a normal ping on the globe.
- A GM Shift+long-press rotates every Planetside client's globe camera to the pinged location, eased, via `focus()`.
- Maximum reuse: no new camera math, no new ping-detection path, no duplicated networking.

**Non-Goals:**
- Changing flat-map ping/pull behavior or Foundry's pull permissions/networking.
- Ping sounds, ping text labels, or new ping styles beyond normal/alert.
- Pinging on top of a token (still selects — unchanged).

## Decisions

### D1: Alert marker = style read from the existing wrap → CSS variant

`spawnPing(sceneX, sceneY, options)` reads `options.style`. When it is `"alert"`, the marker gets a variant class (e.g. `planetside-ping--alert`) that overrides the user color with an urgent look (red, slightly larger / sharper pulse). The default (`"pulse"` or unset) keeps today's user-colored ring. No new detection — the wrap already receives `options`, and the style key is confirmed. This is a `overlay-reanchoring` modification (the marker requirement becomes style-aware).

### D2: GM pull = our own scene-scoped module socket → `focus()` on every client

**(Reversed during implementation — see note.)** The GM's Shift+long-press is handled entirely by us: the controller fires a normal networked `canvas.ping(origin)` (so the globe marker shows at the location on every client via our existing `drawPing` wrap), broadcasts a scene-scoped pull on a module socket, and focuses its own globe immediately:

```
  GM Shift+long-press
        │  input.js → onGmPull(x,y) → controller.firePull(x,y)
        ▼
  firePull:  canvas.ping({x,y})                      // marker, networked to all
             socket.emit('module.planetside',        // pull, to all clients
                {t:'pull', sceneId, x, y})
             this.pullTo(x,y)                         // focus OUR globe now
        ▼
  each client (on activate): socket.on('module.planetside', d =>
        if d.t==='pull' && d.sceneId===canvas.scene.id) this.pullTo(d.x,d.y))
        ▼
  pullTo: orbit.focus(sceneToCameraTarget(x,y), {animate:true})
```

`socket.emit` does not loop back to the sender, so the GM focuses locally via `pullTo`; everyone else focuses on receipt. The pull is scoped by `sceneId` so a client viewing a *different* scene's globe is unaffected. Reuses `focus()` and `sceneToCameraTarget()` verbatim; no Foundry pull internals touched.

**Why this over reusing Foundry's native pull (the original D2):** the native approach needed a spike to confirm the version-specific pull API and the exact pan call to intercept (`canvas.animatePan`?), which couldn't be verified without a live console — and its one real advantage (also panning the 2D view of clients *without* Planetside) is moot, since `flags.planetside.enabled` is per-scene: every client on a globe scene already runs Planetside. The socket is fewer moving parts, version-independent, and fully under our control.

### D3: Modifier mapping and precedence

In `_fireGesturePing(g)`:
- `g.shiftKey && game.user.isGM` → pull (fire `canvas.ping(origin, { pull: true })`). Shift/pull wins if Alt is also held.
- else `g.altKey` → alert (`{ style: "alert" }`, already implemented).
- else → normal ping.
- Non-GM `g.shiftKey` (no Alt) → normal ping (pull is GM-only; degrade gracefully).

The pull also still produces a ping marker (Foundry draws the ping as part of the pull), so the globe shows where everyone is being pulled.

### D4: Factor the scene→target mapping

Extract the body of `_defaultViewTarget()` into a reusable `sceneToCameraTarget(sceneX, sceneY, scale?)` (returns `{ azimuth, elevation, radius }`). `_defaultViewTarget()` calls it with `scene.initial`; the pull interceptor calls it with the pan target. No behavior change to the opening.

## Risks / Trade-offs

- **[The socket pull reaches clients on other scenes]** → scoped by `sceneId` in the payload; `pullTo` also no-ops when the controller isn't active. A client viewing a different globe is unaffected.
- **[Foundry pull API differs across v12/v13]** → confirm the initiation call and the pan-receipt hook in the spike before wiring; the interceptor must be reversible (install on activate, restore on deactivate) like the `drawPing` wrap and the render-suspension.
- **[Alert style key wrong]** → already de-risked; `"alert"` is observed at `drawPing`. The marker variant no-ops gracefully (falls back to the default ring) if a style is unrecognized.
- **[A pull arrives mid-orbit]** → `focus()` already yields to manual orbit (an in-progress focus is cancelled when the user drags), so a player actively orbiting won't be fought; a pull that lands while idle eases in. Acceptable.

## Migration Plan

Pure feature addition; no data/flags/APIs changed. Feature-branch merge; rollback = revert. Deactivation must restore the wrapped `animatePan` (and the `drawPing` wrap already restores).

## Open Questions

- **O1:** ~~Native pull API spike~~ — obviated by the D2 reversal to a module socket (no Foundry pull internals).
- **O2:** Alert marker visual — final color/size/animation (pick by eye; red urgent pulse is the starting point).
- **O3:** ~~Pull-interception scope~~ — obviated by the socket approach (only an explicit GM pull triggers a focus; ordinary pans don't).
- **O4:** Should the GM pull use a distinct marker (Foundry's chevron/arrow) rather than a normal pulse at the location? Deferred — a normal marker at the pull point reads fine; revisit if desired.
