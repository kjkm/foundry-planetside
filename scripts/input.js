const DOUBLE_CLICK_MS = 250;
const DEBUG = false;
const log = (...args) => { if (DEBUG) console.log("[planetside-input]", ...args); };

export class InputForwarder {
  constructor({ scene3d, mercator, orbitCamera, tokenLayer }) {
    this.scene3d = scene3d;
    this.mercator = mercator;
    this.orbit = orbitCamera;
    this.tokenLayer = tokenLayer;
    this.dom = scene3d.canvas;
    this._activePointerId = null;
    this._lastClickByTokenId = new Map();
    this._savedEventTarget = null;
  }

  install() {
    this.dom.addEventListener("pointerdown", this._onPointer);
    this.dom.addEventListener("pointermove", this._onPointer);
    this.dom.addEventListener("pointerup", this._onPointer);
    this.dom.addEventListener("pointerleave", this._onPointer);
    this.dom.addEventListener("wheel", this._onWheelPassThrough, { passive: false });
    this.dom.addEventListener("contextmenu", this._onContextMenu);
    this._detachFoundryEventSystem();
  }

  uninstall() {
    this.dom.removeEventListener("pointerdown", this._onPointer);
    this.dom.removeEventListener("pointermove", this._onPointer);
    this.dom.removeEventListener("pointerup", this._onPointer);
    this.dom.removeEventListener("pointerleave", this._onPointer);
    this.dom.removeEventListener("wheel", this._onWheelPassThrough);
    this.dom.removeEventListener("contextmenu", this._onContextMenu);
    this._reattachFoundryEventSystem();
  }

  // While the globe is up, #board is hidden and the player only interacts with
  // the Three.js canvas. Foundry's PIXI EventSystem, however, stays bound to the
  // real canvas and keeps mapping the *actual* cursor position into the same
  // rootBoundary we dispatch into — yanking PIXI's over-target off whatever token
  // our synthetic move just hovered, so MIM never settles into HOVER. Detach it
  // so our forwarder is the sole source of events into the boundary.
  _detachFoundryEventSystem() {
    const es = canvas.app?.renderer?.events;
    if (!es) return;
    try {
      this._savedEventTarget = es.domElement;
      es.setTargetElement(null);
      log("detached Foundry PIXI EventSystem from real canvas");
    } catch (err) {
      console.warn("[planetside-input] could not detach Foundry EventSystem", err);
      this._savedEventTarget = null;
    }
  }

  _reattachFoundryEventSystem() {
    const es = canvas.app?.renderer?.events;
    if (!es || !this._savedEventTarget) return;
    try {
      es.setTargetElement(this._savedEventTarget);
      log("reattached Foundry PIXI EventSystem to real canvas");
    } catch (err) {
      console.warn("[planetside-input] could not reattach Foundry EventSystem", err);
    }
    this._savedEventTarget = null;
  }

  _onContextMenu = (e) => { e.preventDefault(); };

  _onWheelPassThrough = (_e) => {};

  _onPointer = (e) => {
    if (e.type === "pointerdown" || e.type === "pointerup") {
      log(`event ${e.type} button=${e.button} client=(${e.clientX},${e.clientY}) orbitDragging=${this.orbit.isDragging()}`);
    }

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

    // A plain left-click on empty space deselects, mirroring Foundry's flat-map
    // behavior. Shift preserves the current selection (multi-select workflow).
    if (e.type === "pointerdown" && e.button === 0 && !e.shiftKey) {
      const controlled = canvas.tokens?.controlled ?? [];
      if (controlled.length) {
        log(`empty-space left-click → releaseAll (${controlled.length} controlled)`);
        canvas.tokens.releaseAll();
      }
    }

    const hit = this.scene3d.raycastSphere(ndcX, ndcY);
    if (!hit) {
      if (e.type === "pointerdown" || e.type === "pointerup") log(`no sphere hit — drop ${e.type}`);
      return;
    }

    const { lat, lon } = this.mercator.spherePointToLatLon(hit.point);
    if (!this.mercator.isLatitudeOnBody(lat)) {
      if (e.type === "pointerdown" || e.type === "pointerup") log(`hit beyond cropped lat (${(lat*180/Math.PI).toFixed(1)}°) — drop`);
      return;
    }

    const { u, v } = this.mercator.latLonToUv(lat, lon);
    const dims = canvas.dimensions;
    const sceneX = u * dims.sceneWidth + dims.sceneX;
    const sceneY = v * dims.sceneHeight + dims.sceneY;

    if (e.type === "pointerdown" || e.type === "pointerup") {
      log(`sphere ${e.type} → dispatch at scene (${sceneX.toFixed(0)},${sceneY.toFixed(0)})`);
    }
    this._dispatchPixiEvent(e, sceneX, sceneY);
  };

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
    // raycast + inverse-Mercator path produces world/scene coordinates. The
    // canvas stage is panned and zoomed, so convert through its transform.
    const p = canvas.stage.toGlobal(new PIXI.Point(sceneX, sceneY));
    return { x: p.x, y: p.y };
  }

  _dispatchPixiEvent(domEvent, sceneX, sceneY) {
    const boundary = canvas.app?.renderer?.events?.rootBoundary;
    if (!boundary) {
      log("no rootBoundary — cannot dispatch");
      return;
    }

    if (domEvent.type === "pointerleave") {
      this._activePointerId = null;
      return;
    }

    const g = this._sceneToGlobal(sceneX, sceneY);

    if (domEvent.type === "pointerdown" || domEvent.type === "pointerup") {
      const hitTarget = boundary.hitTest(g.x, g.y);
      const targetName = hitTarget?.constructor?.name ?? "null";
      const isToken = hitTarget?.constructor?.name === "Token" || hitTarget?.parent?.constructor?.name === "Token";
      log(`pixi dispatch ${domEvent.type} at scene(${sceneX.toFixed(0)},${sceneY.toFixed(0)}) global(${g.x.toFixed(0)},${g.y.toFixed(0)}) → hitTest=${targetName} isToken=${isToken}`);
    }

    if (domEvent.type === "pointerdown") this._activePointerId = domEvent.pointerId;
    if (domEvent.type === "pointerup" && this._activePointerId === domEvent.pointerId) {
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
    event.type = domEvent.type;

    boundary.mapEvent(event);
  }
}
