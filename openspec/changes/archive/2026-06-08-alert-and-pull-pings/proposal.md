## Why

Two ping gestures from Foundry's flat map are not yet meaningful on the globe:

1. **Alt+long-press (alert ping)** fires today — `_fireGesturePing` already passes `style: "alert"` to `canvas.ping()`, and the probe confirms `drawPing` receives `{style: "alert", user}` — but the globe ping *marker* is style-agnostic, so an alert ping looks identical to a normal ping. The alert's whole point is to be visually distinct ("look here, urgently").
2. **Shift+long-press (GM pull)** was explicitly deferred and isn't built. This is the headline collaborative feature: a GM pulls every player's view to a location. On the globe that means rotating each client's camera to the pinged point — exactly what the `focus()` primitive was built to back.

This change makes both real, reusing what's already there: the `drawPing` wrap (which already has the style), the camera `focus()` primitive, and the scene→camera-target mapping already used for the default-view opening.

## What Changes

- **Alert ping marker (visual).** The globe ping marker SHALL reflect the ping style: an `alert` ping renders visually distinct from a normal `pulse` ping (e.g. an urgent red, larger/sharper pulse) rather than the user-colored default. Read `options.style` in the existing `drawPing` wrap → `spawnPing` and apply a style variant; no new detection path.
- **GM pull (camera sync).** Shift+long-press by a GM SHALL fire Foundry's pull ping (which broadcasts a "pull" to all clients). On every client with Planetside active, the globe camera SHALL ease to the pinged location via the existing `focus()` primitive — so the GM directs everyone's globe view. A non-GM Shift+long-press SHALL fall back to a normal ping. When both Alt and Shift are held, the pull (Shift, GM) takes precedence.
- **Reuse, not reinvent.** The scene-coordinate → camera-target mapping currently inline in `Planetside._defaultViewTarget()` is factored into a small shared helper and reused for the pull; the pull is mirrored by intercepting Foundry's own pull-pan while active (so Foundry does the networking and we just react).

## Capabilities

### New Capabilities
<!-- none — extends existing ping/input/camera capabilities -->

### Modified Capabilities

- `globe-input`: The long-press → ping requirement gains the modifier mapping — Alt → alert ping, Shift (GM) → pull ping, plain → normal ping; non-GM Shift → normal ping; Shift/pull takes precedence over Alt/alert.
- `overlay-reanchoring`: The globe ping-marker requirement gains style-awareness — the marker reflects the ping's `style` (alert renders visually distinct from the normal pulse).
- `globe-camera`: Add a requirement that the globe camera focuses on a pull ping's location (reusing `focus()`), for every client whose view Foundry pulls.

## Impact

- **Code:** `scripts/input.js` (Shift/GM → pull, modifier precedence; Alt path already fires alert), `scripts/overlays.js` (`spawnPing` reads `options.style`, applies a variant class), `styles/planetside.css` (alert marker variant), `scripts/planetside.js` (factor the scene→camera-target mapping out of `_defaultViewTarget`; install/uninstall the pull-pan interception that calls `orbit.focus()`). Update `README.md`.
- **Reused:** `OrbitCamera.focus()` (unchanged), the `drawPing` wrap (already passes `options`), the Mercator inverse mapping.
- **Assumptions to confirm first (spike):** the exact way Foundry signals/initiates a GM pull (e.g. `canvas.ping(origin, { pull: true })`) and how the pull arrives on receiving clients (the pan call to intercept, likely `canvas.animatePan`), on both v12 and v13. The alert `style` key is already confirmed (`"alert"`, observed at `drawPing`).
- **Out of scope:** changing Foundry's flat-map ping/pull behavior; pinging on top of a token (still selects); ping sounds.
