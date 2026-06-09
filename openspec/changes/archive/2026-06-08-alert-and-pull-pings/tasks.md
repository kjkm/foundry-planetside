## 1. Spike: confirm the Foundry pull API (do first)

- [x] 1.1 OBVIATED — design D2 reversed to a module socket; no Foundry pull internals to confirm. (Only public APIs used: `canvas.ping(origin)` for the marker and `game.socket` for the pull.)
- [x] 1.2 OBVIATED — only an explicit GM pull triggers a focus (no pan interception), so the "scope to pulls only" question no longer applies.

## 2. Alert ping marker (visual)

- [x] 2.1 `overlays.js` `spawnPing(sceneX, sceneY, options)`: read `options.style`; when `"alert"`, add a variant class (e.g. `planetside-ping--alert`) to the marker element (default/unknown style → existing user-colored ring)
- [x] 2.2 `styles/planetside.css`: add the `.planetside-ping--alert` variant — urgent appearance (red, larger/sharper pulse) overriding `--ping-color`
- [x] 2.3 Tune the alert visual by eye (O2)

## 3. Scene→target mapping reuse

- [x] 3.1 `planetside.js`: extract the scene-coordinate → camera-target math from `_defaultViewTarget()` into a reusable `sceneToCameraTarget(sceneX, sceneY, scale?)` returning `{ azimuth, elevation, radius }`; `_defaultViewTarget()` calls it with `scene.initial` (no behavior change to the opening)

## 4. GM pull — fire (input)

- [x] 4.1 `input.js` `_fireGesturePing(g)`: modifier precedence — `g.shiftKey && game.user.isGM` → `onGmPull(x,y)` callback; else `g.altKey` → alert; else normal ping. Non-GM Shift (no Alt) → normal ping. (`onGmPull` passed in from the controller.)
- [x] 4.2 Shift/pull wins over Alt when both are held (Shift branch checked first)

## 5. GM pull — respond (camera, via module socket)

- [x] 5.1 `planetside.js`: `firePull(x,y)` — networked `canvas.ping` (marker for all) + `game.socket.emit("module.planetside", {t:"pull", sceneId, x, y})` + `pullTo(x,y)` for our own globe
- [x] 5.2 `planetside.js`: on activate register a `game.socket` listener that calls `pullTo` for same-scene pulls; on deactivate remove it. `pullTo` calls `orbit.focus(sceneToCameraTarget(x,y), {animate:true})`
- [x] 5.3 Verify the pull focuses a receiving client AND the initiating GM; scoped to the scene; an in-progress pull focus yields to manual orbit

## 6. Docs

- [x] 6.1 README: document Alt+long-press (alert ping, distinct marker) and GM Shift+long-press (pull — rotates everyone's globe to the location); note non-GM Shift falls back to a normal ping
- [x] 6.2 `openspec validate alert-and-pull-pings --strict`

## 7. Smoke testing in Foundry

- [x] 7.1 Alt+long-press → alert ping; the globe marker is visibly distinct (red/urgent) from a normal ping
- [x] 7.2 GM Shift+long-press → every Planetside client's globe (and the GM's) eases to the pinged location; a normal ping marker also appears there
- [x] 7.3 Non-GM Shift+long-press → normal ping (no pull); plain and Alt long-press unaffected
- [x] 7.4 A pull that lands while a player is actively orbiting yields to their drag; a pull while idle eases in
- [x] 7.5 Deactivate removes the pull socket listener (no stray globe focus after Planetside is off); a pull from a GM on a different scene does not move your globe
