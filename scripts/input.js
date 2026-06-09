const DOUBLE_CLICK_MS = 250;
// A right gesture that moves less than this (client px) between down and up is a
// right-CLICK (fire tile trigger); more is a right-DRAG (camera orbit).
const RIGHT_CLICK_MAX_MOVE = 5;
// Left long-press → ping. Hold this long (client ms) without moving past the
// tolerance to fire a ping. We detect this ourselves and call canvas.ping()
// directly rather than routing through MouseInteractionManager — instant, and no
// post-ping cooldown (MIM's synthesized-event state never gets stuck). Tunable.
const PING_HOLD_MS = 350;
const PING_MOVE_TOLERANCE = 6; // client px; more movement → drag, not a long-press
const PING_ALERT_STYLE = "alert"; // Foundry ping style for Alt+long-press
// MATT trigger-method strings for the right button. Confirm against the installed
// MATT (its config dropdown) — `document.trigger` runs whatever the tile is gated
// for, so a mismatch simply never fires rather than misbehaving.
const TILE_RIGHTCLICK_METHOD = "rightclick";
const TILE_DBL_RIGHTCLICK_METHOD = "dblrightclick";
const DEBUG = false;
const log = (...args) => { if (DEBUG) console.log("[planetside-input]", ...args); };

export class InputForwarder {
  constructor({ scene3d, projection, orbitCamera, tokenLayer, onGmPull }) {
    this.scene3d = scene3d;
    this.projection = projection;
    this.orbit = orbitCamera;
    this.tokenLayer = tokenLayer;
    this.onGmPull = onGmPull; // (sceneX, sceneY) => fire a GM pull (controller-owned)
    this.dom = scene3d.canvas;
    this._activePointerId = null;
    this._lastClickByTokenId = new Map();
    this._rightDown = null; // { x, y } client coords of the last right pointer-down
    this._leftGesture = null; // in-flight empty-sphere left press (click/drag/long-press)
  }

  install() {
    this.dom.addEventListener("pointerdown", this._onPointer);
    this.dom.addEventListener("pointermove", this._onPointer);
    this.dom.addEventListener("pointerup", this._onPointer);
    this.dom.addEventListener("pointerleave", this._onPointer);
    this.dom.addEventListener("wheel", this._onWheelPassThrough, { passive: false });
    this.dom.addEventListener("contextmenu", this._onContextMenu);
  }

  uninstall() {
    this.dom.removeEventListener("pointerdown", this._onPointer);
    this.dom.removeEventListener("pointermove", this._onPointer);
    this.dom.removeEventListener("pointerup", this._onPointer);
    this.dom.removeEventListener("pointerleave", this._onPointer);
    this.dom.removeEventListener("wheel", this._onWheelPassThrough);
    this.dom.removeEventListener("contextmenu", this._onContextMenu);
    this._cancelLeftGesture();
  }

  _onContextMenu = (e) => { e.preventDefault(); };

  _onWheelPassThrough = (_e) => {};

  _onPointer = (e) => {
    if (e.type === "pointerdown" || e.type === "pointerup") {
      log(`event ${e.type} button=${e.button} client=(${e.clientX},${e.clientY}) orbitDragging=${this.orbit.isDragging()}`);
    }

    // Right button: record the down for click-vs-drag discrimination, and handle
    // the up HERE — before the orbit-drag guard below, because on right-up the
    // orbit is still mid-drag (it clears its drag in its own later-running up
    // handler). A right-click fires tile triggers; a right-drag orbits as before.
    if (e.type === "pointerdown" && e.button === 2) {
      this._rightDown = { x: e.clientX, y: e.clientY };
    } else if (e.type === "pointerup" && e.button === 2) {
      this._handleRightClickUp(e);
      return;
    }

    // Leaving the canvas mid-hold abandons any in-flight left gesture (so a
    // pending long-press timer can't fire after the cursor is gone). Done early,
    // before the off-sphere early-returns below.
    if (e.type === "pointerleave") this._cancelLeftGesture();

    if (this.orbit.isDragging()) return;

    const rect = this.dom.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

    const tokenHit = this._raycastTokenSprites(ndcX, ndcY);

    if (e.type === "pointerdown" || e.type === "pointerup") {
      log(`ndc=(${ndcX.toFixed(3)},${ndcY.toFixed(3)}) tokenHit=${tokenHit ? tokenHit.entry.token.name : "none"}`);
    }

    if (tokenHit) {
      this._handleTokenPointer(e, tokenHit.entry);
      return;
    }

    // No token under the cursor — empty globe surface.
    if (e.button === 2) return; // right-drag falls through to the orbit camera

    const hit = this.scene3d.raycastSphere(ndcX, ndcY);
    if (!hit) {
      if (e.type === "pointerdown" || e.type === "pointerup") log(`no sphere hit — drop ${e.type}`);
      return;
    }

    const { lat, lon } = this.projection.spherePointToLatLon(hit.point);
    if (!this.projection.isLatitudeOnBody(lat)) {
      if (e.type === "pointerdown" || e.type === "pointerup") log(`hit beyond cropped lat (${(lat*180/Math.PI).toFixed(1)}°) — drop`);
      return;
    }

    const { u, v } = this.projection.latLonToUv(lat, lon);
    const dims = canvas.dimensions;
    const sceneX = u * dims.sceneWidth + dims.sceneX;
    const sceneY = v * dims.sceneHeight + dims.sceneY;

    if (e.type === "pointerdown" || e.type === "pointerup") {
      log(`sphere ${e.type} → at scene (${sceneX.toFixed(0)},${sceneY.toFixed(0)})`);
    }

    // Classify the empty-sphere LEFT press (click / drag / long-press→ping). A
    // held-still press becomes a direct canvas.ping(); a short click runs the
    // deselect + tile triggers + synthesized forward on release; a drag forwards
    // from first movement. Nothing is forwarded to MIM until we know which it is,
    // so a hold never reaches MIM (no detection lag, no post-ping cooldown).
    if (this._handleLeftGesture(e, sceneX, sceneY)) return;

    // Not consumed by the gesture machine (e.g. a hover move with no active left
    // press) — forward as before so 2D hover state still tracks.
    this._dispatchPixiEvent(e, sceneX, sceneY);
  };

  // Left-press gesture state machine over the empty sphere. Returns true if it
  // consumed the event. See the block comment at the call site for the rationale.
  _handleLeftGesture(e, sceneX, sceneY) {
    // Begin a gesture on left-down: record it and start the long-press timer.
    // Defer ALL side effects (deselect, tile triggers, forwarding) until we know
    // the gesture's kind.
    if (e.type === "pointerdown" && e.button === 0) {
      this._cancelLeftGesture();
      const g = {
        downX: e.clientX, downY: e.clientY,
        sceneX, sceneY,
        altKey: e.altKey, shiftKey: e.shiftKey,
        pinged: false, forwarding: false, timer: null
      };
      g.timer = setTimeout(() => this._fireGesturePing(g), PING_HOLD_MS);
      this._leftGesture = g;
      return true;
    }

    const g = this._leftGesture;
    if (!g) return false; // no active left gesture (e.g. a hover move) — not ours

    if (e.type === "pointermove") {
      if (g.pinged) return true; // already pinged — swallow the rest of this gesture
      if (!g.forwarding) {
        const moved = Math.hypot(e.clientX - g.downX, e.clientY - g.downY);
        if (moved > PING_MOVE_TOLERANCE) {
          // Movement before the timer → it's a drag, not a long-press. Cancel the
          // ping, then forward the deferred down (at the original press point)
          // followed by this move; subsequent moves forward live.
          this._clearGestureTimer(g);
          g.forwarding = true;
          this._dispatchPixiEvent(e, g.sceneX, g.sceneY, "pointerdown");
          this._dispatchPixiEvent(e, sceneX, sceneY);
        }
        return true;
      }
      this._dispatchPixiEvent(e, sceneX, sceneY); // live drag move
      return true;
    }

    if (e.type === "pointerup" && e.button === 0) {
      this._clearGestureTimer(g);
      this._leftGesture = null;
      if (g.pinged) return true;        // long-press already fired the ping → suppress
      if (g.forwarding) {               // close out a drag
        this._dispatchPixiEvent(e, sceneX, sceneY);
        return true;
      }
      // Short click (released before the threshold, no significant movement):
      // run the empty-click behavior — deselect, tile click/dblclick, forward.
      if (!g.shiftKey) {
        const controlled = canvas.tokens?.controlled ?? [];
        if (controlled.length) {
          log(`empty-space left-click → releaseAll (${controlled.length} controlled)`);
          canvas.tokens.releaseAll();
        }
      }
      const isDouble = this._isSphereDoubleClick(g.sceneX, g.sceneY);
      this._fireTileTriggers(g.sceneX, g.sceneY, "click");
      if (isDouble) this._fireTileTriggers(g.sceneX, g.sceneY, "dblclick");
      this._dispatchPixiEvent(e, g.sceneX, g.sceneY, "pointerdown");
      this._dispatchPixiEvent(e, g.sceneX, g.sceneY);
      return true;
    }

    return false;
  }

  // Long-press elapsed while held still → fire a ping directly. canvas.ping()
  // draws locally (our drawPing wrap renders the globe marker) and broadcasts to
  // other clients; it has no self-throttle, so back-to-back pings are immediate.
  _fireGesturePing(g) {
    g.timer = null;
    g.pinged = true;
    try {
      const origin = { x: g.sceneX, y: g.sceneY };
      // Modifier → ping type, with Shift/pull taking precedence over Alt/alert:
      //  - Shift held by a GM → pull (controller shows a marker for everyone,
      //    broadcasts it, and focuses every client's globe on the location).
      //  - Alt → alert ping (visually distinct marker).
      //  - plain, or Shift held by a non-GM → normal ping.
      if (g.shiftKey && game.user?.isGM) {
        log(`long-press → GM pull at scene (${origin.x.toFixed(0)},${origin.y.toFixed(0)})`);
        this.onGmPull?.(origin.x, origin.y);
      } else if (g.altKey) {
        log(`long-press → alert ping at scene (${origin.x.toFixed(0)},${origin.y.toFixed(0)})`);
        canvas.ping(origin, { style: PING_ALERT_STYLE });
      } else {
        log(`long-press → ping at scene (${origin.x.toFixed(0)},${origin.y.toFixed(0)})`);
        canvas.ping(origin);
      }
    } catch (err) {
      console.warn("[planetside-input] ping failed", err);
    }
  }

  _clearGestureTimer(g) {
    if (g?.timer) { clearTimeout(g.timer); g.timer = null; }
  }

  _cancelLeftGesture() {
    if (this._leftGesture) {
      this._clearGestureTimer(this._leftGesture);
      this._leftGesture = null;
    }
  }

  // Tiles whose footprint rectangle contains the scene point. Axis-aligned
  // (tile rotation ignored for v1).
  _tilesAtScenePoint(sceneX, sceneY) {
    const tiles = canvas.tiles?.placeables ?? [];
    return tiles.filter((tile) => {
      const doc = tile.document ?? tile;
      const x = doc.x ?? 0;
      const y = doc.y ?? 0;
      const w = doc.width ?? 0;
      const h = doc.height ?? 0;
      return sceneX >= x && sceneX <= x + w && sceneY >= y && sceneY <= y + h;
    });
  }

  // True when the tile has an active Monk's Active Tiles config whose trigger
  // list includes `method`. We gate here because document.trigger() runs a
  // tile's actions regardless of method.
  _tileHasTrigger(tile, method) {
    const flags = (tile.document ?? tile).flags?.["monks-active-tiles"];
    if (!flags || flags.active === false) return false;
    const t = flags.trigger;
    const types = Array.isArray(t) ? t : (t ? [t] : []);
    return types.includes(method);
  }

  _fireTileTriggers(sceneX, sceneY, method) {
    for (const tile of this._tilesAtScenePoint(sceneX, sceneY)) {
      if (this._tileHasTrigger(tile, method)) this._fireTileTrigger(tile, sceneX, sceneY, method);
    }
  }

  // Fire the tile's MATT actions directly via its document API — no PIXI/MIM
  // event synthesis needed. Best-effort: a MATT error must not break input.
  _fireTileTrigger(tile, sceneX, sceneY, method) {
    const doc = tile.document ?? tile;
    if (typeof doc.trigger !== "function") return;
    const tokens = canvas.tokens?.controlled?.map((t) => t.document) ?? [];
    log(`tile ${method} trigger → ${tile.id}`);
    try {
      doc.trigger({
        method,
        pt: { x: sceneX, y: sceneY },
        tokens,
        userId: game.user.id
      });
    } catch (err) {
      console.warn("[planetside-input] tile trigger failed", tile?.id, err);
    }
  }

  // Detect a double-click on the globe surface: a second left-down close in time
  // and scene-space to the previous one (threshold ~ one grid cell).
  _isSphereDoubleClick(sceneX, sceneY) {
    const now = performance.now();
    const last = this._lastSphereClick;
    this._lastSphereClick = { t: now, x: sceneX, y: sceneY };
    if (!last) return false;
    const dist = Math.hypot(sceneX - last.x, sceneY - last.y);
    const threshold = canvas.dimensions?.size ?? 50;
    return (now - last.t) < DOUBLE_CLICK_MS && dist < threshold;
  }

  _isSphereDoubleRightClick(sceneX, sceneY) {
    const now = performance.now();
    const last = this._lastSphereRightClick;
    this._lastSphereRightClick = { t: now, x: sceneX, y: sceneY };
    if (!last) return false;
    const dist = Math.hypot(sceneX - last.x, sceneY - last.y);
    const threshold = canvas.dimensions?.size ?? 50;
    return (now - last.t) < DOUBLE_CLICK_MS && dist < threshold;
  }

  // Right pointer-up: fire MATT right-click / double-right-click tile triggers,
  // but only for a CLICK (negligible movement since right-down) — a right-DRAG is
  // a camera orbit and fires nothing. Tokens take priority (their right-click HUD
  // already opened on pointer-down), so a right-click over a token does not also
  // fire a tile trigger.
  _handleRightClickUp(e) {
    const down = this._rightDown;
    this._rightDown = null;
    if (!down) return;

    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (moved > RIGHT_CLICK_MAX_MOVE) return; // it was a drag → orbit, no trigger

    const rect = this.dom.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    if (this._raycastTokenSprites(ndcX, ndcY)) return; // token right-click took priority

    const hit = this.scene3d.raycastSphere(ndcX, ndcY);
    if (!hit) return;
    const { lat, lon } = this.projection.spherePointToLatLon(hit.point);
    if (!this.projection.isLatitudeOnBody(lat)) return;
    const { u, v } = this.projection.latLonToUv(lat, lon);
    const dims = canvas.dimensions;
    const sceneX = u * dims.sceneWidth + dims.sceneX;
    const sceneY = v * dims.sceneHeight + dims.sceneY;

    const isDouble = this._isSphereDoubleRightClick(sceneX, sceneY);
    this._fireTileTriggers(sceneX, sceneY, TILE_RIGHTCLICK_METHOD);
    if (isDouble) this._fireTileTriggers(sceneX, sceneY, TILE_DBL_RIGHTCLICK_METHOD);
  }

  _raycastTokenSprites(ndcX, ndcY) {
    const entries = this.tokenLayer?.entries;
    if (!entries || entries.size === 0) return null;

    const meshes = [];
    for (const entry of entries.values()) {
      if (entry.sprite?.visible) meshes.push(entry.sprite);
    }
    if (meshes.length === 0) return null;

    const hits = this.scene3d.raycastObjects(ndcX, ndcY, meshes);
    for (const hit of hits) {
      if (this.scene3d.isFacingCamera(hit.object.position)) {
        const entry = this._lookupEntryByMesh(hit.object);
        if (entry) return { entry, hit };
      }
    }
    return null;
  }

  _lookupEntryByMesh(mesh) {
    for (const entry of this.tokenLayer.entries.values()) {
      if (entry.sprite === mesh) return entry;
    }
    return null;
  }

  // Token interaction is forwarded SEMANTICALLY: rather than synthesize raw PIXI
  // pointer events (Foundry's compiled MouseInteractionManager silently refuses to
  // promote synthesized events into its HOVER→CLICKED state machine), we call
  // Foundry's real high-level handlers directly off our raycast hit. control(),
  // releaseAll(), the actor sheet, and the Token HUD are genuine Foundry behavior
  // and fire the usual hooks (controlToken, etc.).
  _handleTokenPointer(e, entry) {
    const token = entry.token;

    if (e.button === 2) {
      // Right-click → Token HUD. Consume the event so the orbit camera, which we
      // installed underneath this forwarder, does not also start an orbit drag.
      if (e.type === "pointerdown") {
        log(`right-click token "${token.name}" → Token HUD`);
        if (!token.controlled) token.control({ releaseOthers: true });
        this._toggleTokenHud(token);
        // The orbit camera listens on this same element and starts a right-drag
        // on button 2. stopPropagation alone won't stop a sibling listener, and
        // we are installed first, so stopImmediatePropagation preempts the orbit.
        e.stopImmediatePropagation();
        e.preventDefault();
      }
      return;
    }

    if (e.button !== 0) return; // ignore middle / aux buttons

    if (e.type === "pointerdown") {
      log(`left-click token "${token.name}" → control(releaseOthers=${!e.shiftKey})`);
      token.control({ releaseOthers: !e.shiftKey });
    } else if (e.type === "pointerup") {
      this._checkDoubleClick(entry);
    }
  }

  _toggleTokenHud(token) {
    const hud = canvas.hud?.token;
    if (!hud) return;
    // Mirror Foundry: a second right-click on the same token dismisses the HUD.
    if (hud.object === token) hud.clear();
    else hud.bind(token);
  }

  _openTokenSheet(token) {
    const sheet = token.actor?.sheet;
    if (!sheet) {
      log(`double-click token "${token.name}" — no actor sheet to open`);
      return;
    }
    log(`double-click token "${token.name}" → render actor sheet`);
    sheet.render(true);
  }

  _checkDoubleClick(entry) {
    const tokenId = entry.token.id;
    const now = performance.now();
    const last = this._lastClickByTokenId.get(tokenId);
    this._lastClickByTokenId.set(tokenId, now);
    if (last !== undefined && now - last < DOUBLE_CLICK_MS) {
      this._openTokenSheet(entry.token);
      this._lastClickByTokenId.delete(tokenId);
    }
  }

  _sceneToGlobal(sceneX, sceneY) {
    // PIXI's event boundary operates in global/screen coordinates, but our
    // raycast + inverse-projection path produces world/scene coordinates. The
    // canvas stage is panned and zoomed, so convert through its transform.
    const p = canvas.stage.toGlobal(new PIXI.Point(sceneX, sceneY));
    return { x: p.x, y: p.y };
  }

  // typeOverride lets callers synthesize an event of a different type than the
  // source DOM event — used to forward a deferred "pointerdown" reconstructed at
  // gesture-resolution time (when only the "pointerup" DOM event is in hand).
  _dispatchPixiEvent(domEvent, sceneX, sceneY, typeOverride) {
    const boundary = canvas.app?.renderer?.events?.rootBoundary;
    if (!boundary) {
      log("no rootBoundary — cannot dispatch");
      return;
    }

    const type = typeOverride ?? domEvent.type;

    if (type === "pointerleave") {
      this._activePointerId = null;
      return;
    }

    const g = this._sceneToGlobal(sceneX, sceneY);

    if (type === "pointerdown" || type === "pointerup") {
      const hitTarget = boundary.hitTest(g.x, g.y);
      const targetName = hitTarget?.constructor?.name ?? "null";
      const isToken = hitTarget?.constructor?.name === "Token" || hitTarget?.parent?.constructor?.name === "Token";
      log(`pixi dispatch ${type} at scene(${sceneX.toFixed(0)},${sceneY.toFixed(0)}) global(${g.x.toFixed(0)},${g.y.toFixed(0)}) → hitTest=${targetName} isToken=${isToken}`);
    }

    if (type === "pointerdown") this._activePointerId = domEvent.pointerId;
    if (type === "pointerup" && this._activePointerId === domEvent.pointerId) {
      this._activePointerId = null;
    }

    const event = new PIXI.FederatedPointerEvent(boundary);
    event.global.set(g.x, g.y);
    event.client.set(domEvent.clientX, domEvent.clientY);
    event.screen.set(domEvent.clientX, domEvent.clientY);
    event.button = domEvent.button;
    event.buttons = domEvent.buttons;
    event.pointerId = domEvent.pointerId ?? 1;
    event.pointerType = domEvent.pointerType || "mouse";
    event.pressure = domEvent.pressure ?? 0;
    event.isPrimary = domEvent.isPrimary ?? true;
    event.altKey = domEvent.altKey ?? false;
    event.ctrlKey = domEvent.ctrlKey ?? false;
    event.shiftKey = domEvent.shiftKey ?? false;
    event.metaKey = domEvent.metaKey ?? false;
    event.nativeEvent = domEvent;
    event.originalEvent = domEvent;
    event.type = type;

    boundary.mapEvent(event);
  }
}
