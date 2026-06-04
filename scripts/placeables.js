import * as THREE from "./vendor/three.module.js";

const DEFAULT_RADIUS = 1.001;
const SIZE_FACTOR = 1.0;

// Capture tuning. Placeables are captured at their footprint pixel size times a
// small supersample for crispness when the camera zooms in, capped so large
// placeables don't allocate huge textures. We do NOT pool render targets —
// captures are change-driven and infrequent, so a per-frame budget is the only
// guard we need (premature pooling would optimize an unmeasured cost).
const CAPTURE_SUPERSAMPLE = 2;
const CAPTURE_MAX_DIM = 1024;
const MAX_CAPTURES_PER_FRAME = 4;

/**
 * Shared rendering pipeline for Foundry placeables (tokens, tiles) on the globe.
 *
 * Each placeable becomes a flat textured `THREE.Mesh` laid on the sphere via the
 * surface tangent frame, positioned by Mercator forward projection of its center.
 * The texture is produced by capturing the live Foundry rendering: the image
 * (a PrimarySpriteMesh in the PrimaryCanvasGroup, which cannot be reparented and
 * only outlines outside its primary-group framebuffer) is drawn as a plain Sprite
 * of its texture, composited with any decoration objects into one render texture
 * under a neutralized stage transform. Re-capture is coalesced on a dirty flag
 * with a per-frame budget.
 *
 * Subclasses override the extension points to supply the placeable collection,
 * geometry accessors, decorations, and any per-type extras (e.g. DOM nameplates).
 */
export class PlaceableLayer {
  constructor({ scene3d, mercator, hostElement }) {
    this.scene3d = scene3d;
    this.mercator = mercator;
    this.host = hostElement;
    this.entries = new Map();
  }

  // ---- subclass extension points (sensible defaults) ----
  _collection() { return []; }                 // array of Foundry placeables
  _idOf(p) { return p?.id; }
  _meshOf(p) { return p?.mesh; }               // the PrimarySpriteMesh image
  _isVisible(p) { return p?.visible !== false; }
  _radius() { return DEFAULT_RADIUS; }         // radial offset of the mesh
  _renderOrder() { return 1; }
  _centerScene(p) {                            // placeable center in scene coords
    const doc = p.document ?? p;
    return { x: doc.x ?? 0, y: doc.y ?? 0 };
  }
  _decorationObjects(_p) { return []; }         // PIXI objects composited over the image
  _hiddenDuringCapture(_p) { return []; }       // PIXI children to hide while capturing
  _onEntryAdded(_entry) {}
  _onEntryUpdated(_entry) {}
  _onEntryRemoved(_entry) {}
  _showExtras(_entry, _info) {}                 // e.g. position+show a DOM nameplate
  _hideExtras(_entry) {}

  // ---- lifecycle ----
  install() {
    for (const p of this._collection()) this._add(p);
  }

  destroy() {
    for (const entry of this.entries.values()) this._removeEntry(entry);
    this.entries.clear();
  }

  _add(p) {
    if (!p) return;
    const id = this._idOf(p);
    if (id == null || this.entries.has(id)) return;

    const geom = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const sprite = new THREE.Mesh(geom, mat);
    sprite.renderOrder = this._renderOrder();
    sprite.visible = false; // until the first capture lands
    this.scene3d.scene.add(sprite);

    const entry = {
      placeable: p,
      sprite,
      dirty: true,
      captured: false,
      planeW: 0.1,
      planeH: 0.1,
      offEastG: 0, // center → texture-center offset, globe units, east
      offSouthG: 0 // ... south
    };
    this.entries.set(id, entry);
    this._onEntryAdded(entry);
  }

  _refresh(p) {
    const id = this._idOf(p);
    const entry = id != null ? this.entries.get(id) : null;
    if (!entry) {
      this._add(p);
      return;
    }
    entry.placeable = p;
    entry.dirty = true; // re-capture next frame (coalesces repeated refreshes)
    this._onEntryUpdated(entry);
  }

  _remove(p) {
    const id = this._idOf(p);
    const entry = id != null ? this.entries.get(id) : null;
    if (!entry) return;
    this._removeEntry(entry);
    this.entries.delete(id);
  }

  _removeEntry(entry) {
    this.scene3d.scene.remove(entry.sprite);
    entry.sprite.geometry.dispose();
    if (entry.sprite.material.map) entry.sprite.material.map.dispose();
    entry.sprite.material.dispose();
    this._onEntryRemoved(entry);
  }

  update() {
    const canvasRect = this.scene3d.canvas?.getBoundingClientRect();
    if (!canvasRect) return;
    this._captureDirty();
    for (const entry of this.entries.values()) this._updateEntry(entry, canvasRect);
  }

  // Capture all dirty placeables this frame (coalesced: each captured at most
  // once, bounded by a per-frame budget). Neutralize the canvas stage transform
  // ONCE for the batch so world coordinates equal scene coordinates while we
  // render, then restore it. Remaining dirty entries defer to the next frame.
  _captureDirty() {
    const dirty = [];
    for (const entry of this.entries.values()) {
      if (entry.dirty) dirty.push(entry);
    }
    if (dirty.length === 0) return;

    const renderer = canvas.app?.renderer;
    const stage = canvas.stage;
    if (!renderer || !stage) return;

    const saved = { x: stage.position.x, y: stage.position.y, sx: stage.scale.x, sy: stage.scale.y };
    stage.position.set(0, 0);
    stage.scale.set(1, 1);
    this._syncStageTransform(stage);
    try {
      let budget = MAX_CAPTURES_PER_FRAME;
      for (const entry of dirty) {
        if (budget <= 0) break; // leave the rest dirty for next frame
        this._captureOne(entry, renderer);
        entry.dirty = false;
        budget--;
      }
    } finally {
      stage.position.set(saved.x, saved.y);
      stage.scale.set(saved.sx, saved.sy);
      this._syncStageTransform(stage);
    }
  }

  // Propagate a transform change down the stage subtree. The root stage has no
  // parent, so updateTransform() would dereference null; enableTempParent gives
  // it a temporary identity parent for the update (the same trick render uses).
  _syncStageTransform(stage) {
    const cache = stage.enableTempParent();
    stage.updateTransform();
    stage.disableTempParent(cache);
  }

  // Mirror one placeable into a texture: image (a PrimarySpriteMesh) plus any
  // decoration objects. With the stage neutralized by the caller, render both in
  // place into one render texture, offsetting by the union scene-space region.
  _captureOne(entry, renderer) {
    const p = entry.placeable;
    const mesh = this._meshOf(p);
    if (!mesh) return;

    // Children that would bake into the texture undesirably (e.g. Foundry's own
    // nameplate, which we render as billboarded DOM instead).
    const hidden = this._hiddenDuringCapture(p).filter(Boolean);
    const savedVis = hidden.map((h) => h.visible);
    for (const h of hidden) h.visible = false;

    let rt = null;
    try {
      // With the stage neutralized, getBounds() share a common world space (camera
      // pan/zoom removed). NOTE: that space does NOT share an origin with document
      // coordinates (the primary group / placeable layer carry their own offset),
      // so all capture math stays in this bounds space — never mix in document
      // coords like placeable.center.
      const mb = mesh.getBounds();

      // Render only the explicit decoration objects, never the whole placeable
      // container (which can hold occlusion children that punch a transparent
      // hole when composited over the image).
      const decorations = this._decorationObjects(p)
        .filter((d) => d && d.visible && d.renderable !== false);

      let region = (mb && mb.width > 0) ? mb.clone() : null;
      for (const d of decorations) region = this._unionRect(region, d.getBounds());
      if (!region || region.width <= 0 || region.height <= 0) return;

      const maxDim = Math.max(region.width, region.height);
      const resolution = Math.max(0.1, Math.min(CAPTURE_SUPERSAMPLE, CAPTURE_MAX_DIM / maxDim));

      rt = PIXI.RenderTexture.create({
        width: Math.ceil(region.width),
        height: Math.ceil(region.height),
        resolution
      });
      const xf = new PIXI.Matrix().translate(-region.x, -region.y);

      // The image is a PrimarySpriteMesh whose occlusion shader only outlines when
      // drawn outside its primary-group framebuffer. Draw it as a plain Sprite of
      // the same texture (default shader → filled), matching the mesh's displayed
      // size/rotation, anchored at the mesh AABB center.
      const srcTexture = mesh.texture ?? p.texture;
      let imgSprite = null;
      if (srcTexture && mb && mb.width > 0) {
        imgSprite = new PIXI.Sprite(srcTexture);
        imgSprite.anchor.set(0.5);
        imgSprite.position.set(mb.x + mb.width / 2, mb.y + mb.height / 2);
        imgSprite.width = Math.abs(mesh.width);
        imgSprite.height = Math.abs(mesh.height);
        imgSprite.rotation = mesh.rotation;
        if (mesh.scale.x < 0) imgSprite.scale.x = -imgSprite.scale.x;
        if (mesh.scale.y < 0) imgSprite.scale.y = -imgSprite.scale.y;
        imgSprite.tint = mesh.tint ?? 0xffffff;
      }

      let cleared = false;
      if (imgSprite) {
        renderer.render(imgSprite, { renderTexture: rt, clear: true, transform: xf, skipUpdateTransform: false });
        imgSprite.destroy({ children: false, texture: false, baseTexture: false });
        cleared = true;
      }
      for (const d of decorations) {
        renderer.render(d, { renderTexture: rt, clear: !cleared, transform: xf, skipUpdateTransform: true });
        cleared = true;
      }
      if (!cleared) return;

      const canvasEl = renderer.extract.canvas(rt);
      const texture = new THREE.CanvasTexture(canvasEl);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      const old = entry.sprite.material.map;
      entry.sprite.material.map = texture;
      entry.sprite.material.needsUpdate = true;
      if (old && old !== texture) old.dispose();

      const dims = canvas.dimensions;
      const sceneWidth = dims?.sceneWidth ?? 2048;
      const g = (2 * Math.PI * SIZE_FACTOR) / sceneWidth;
      entry.planeW = region.width * g;
      entry.planeH = region.height * g;

      // Keep the placeable CENTER on its sphere point despite asymmetric
      // decoration bounds. The image AABB is centered on the placeable, so its
      // center is the visual center in the SAME bounds space as `region` — using
      // it (not document-space center) makes the origin mismatch cancel.
      const hasMesh = mb && mb.width > 0 && mb.height > 0;
      const anchorX = hasMesh ? (mb.x + mb.width / 2) : (region.x + region.width / 2);
      const anchorY = hasMesh ? (mb.y + mb.height / 2) : (region.y + region.height / 2);
      entry.offEastG = (anchorX - (region.x + region.width / 2)) * g;   // +east
      entry.offSouthG = (anchorY - (region.y + region.height / 2)) * g; // +south

      entry.captured = true;
    } catch (err) {
      console.warn("[planetside] placeable capture failed:", err);
    } finally {
      hidden.forEach((h, i) => { h.visible = savedVis[i]; });
      if (rt) rt.destroy(true);
    }
  }

  _unionRect(a, b) {
    const ae = a && a.width > 0 && a.height > 0;
    const be = b && b.width > 0 && b.height > 0;
    if (ae && be) {
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const right = Math.max(a.x + a.width, b.x + b.width);
      const bottom = Math.max(a.y + a.height, b.y + b.height);
      return new PIXI.Rectangle(x, y, right - x, bottom - y);
    }
    return ae ? a : (be ? b : null);
  }

  _updateEntry(entry, canvasRect) {
    const p = entry.placeable;
    const sprite = entry.sprite;

    if (!entry.captured || !this._isVisible(p)) {
      sprite.visible = false;
      this._hideExtras(entry);
      return;
    }

    const dims = canvas.dimensions;
    if (!dims) return;
    const center = this._centerScene(p);
    const u = (center.x - dims.sceneX) / dims.sceneWidth;
    const v = (center.y - dims.sceneY) / dims.sceneHeight;
    const { lat, lon } = this.mercator.uvToLatLon(u, v);
    if (!this.mercator.isLatitudeOnBody(lat)) {
      sprite.visible = false;
      this._hideExtras(entry);
      return;
    }

    const P = this.mercator.latLonToSpherePoint(lat, lon, this._radius());
    const frame = this.scene3d.surfaceFrame(lat, lon);

    // Place the plane so the placeable CENTER (not the texture center) lands on P,
    // then orient it flat with a consistent tangent-frame roll. Rotation is baked
    // into the captured image, so no rotateZ here.
    const pos = new THREE.Vector3(P.x, P.y, P.z)
      .addScaledVector(frame.east, -entry.offEastG)
      .addScaledVector(frame.north, entry.offSouthG);
    sprite.position.copy(pos);
    sprite.quaternion.copy(frame.quaternion);
    sprite.scale.set(entry.planeW, entry.planeH, 1);

    const facing = this.scene3d.isFacingCamera(P);
    sprite.visible = facing;
    if (!facing) {
      this._hideExtras(entry);
      return;
    }
    this._showExtras(entry, { P, canvasRect });
  }
}
