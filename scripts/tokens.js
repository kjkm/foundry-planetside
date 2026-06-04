import * as THREE from "./vendor/three.module.js";

const SPRITE_RADIUS = 1.001;
const TOKEN_SIZE_FACTOR = 1.0;
const NAMEPLATE_OFFSET_PX = 18;

// Capture tuning. Tokens are captured at their footprint pixel size times a
// small supersample for crispness when the camera zooms in, capped so large
// tokens don't allocate huge textures. We do NOT pool render targets — captures
// are change-driven and infrequent, so a per-frame budget is the only guard we
// need (premature pooling would be optimizing something we haven't measured).
const CAPTURE_SUPERSAMPLE = 2;
const CAPTURE_MAX_DIM = 1024;
const MAX_CAPTURES_PER_FRAME = 4;

const NAMEPLATE_BASE_STYLES = {
  position: "fixed",
  zIndex: "5",
  pointerEvents: "none",
  color: "#ffffff",
  textShadow: "0 0 6px rgba(0,0,0,0.85), 0 1px 1px rgba(0,0,0,0.7)",
  fontFamily: "Signika, sans-serif",
  fontSize: "12px",
  fontWeight: "500",
  whiteSpace: "nowrap",
  transform: "translate(-50%, 0)",
  display: "none"
};

export class TokenLayer {
  constructor({ scene3d, mercator, hostElement }) {
    this.scene3d = scene3d;
    this.mercator = mercator;
    this.host = hostElement;
    this.entries = new Map();
  }

  install() {
    const placeables = canvas.tokens?.placeables ?? [];
    for (const token of placeables) this.addToken(token);
  }

  destroy() {
    for (const entry of this.entries.values()) this._removeEntry(entry);
    this.entries.clear();
  }

  addToken(token) {
    if (!token || this.entries.has(token.id)) return;
    const doc = token.document ?? token;

    const geom = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const sprite = new THREE.Mesh(geom, mat);
    sprite.renderOrder = 1;
    sprite.visible = false; // until the first capture lands
    this.scene3d.scene.add(sprite);

    const nameplate = document.createElement("div");
    nameplate.className = "planetside-nameplate";
    Object.assign(nameplate.style, NAMEPLATE_BASE_STYLES);
    nameplate.textContent = doc.name ?? "";
    this.host.appendChild(nameplate);

    const entry = {
      token,
      sprite,
      nameplate,
      dirty: true,      // needs an initial capture
      captured: false,  // a texture has landed at least once
      planeW: 0.1,
      planeH: 0.1,
      offEastG: 0,      // token-center → texture-center offset, globe units, east
      offSouthG: 0      // ... south
    };
    this.entries.set(token.id, entry);
  }

  updateToken(token, _changes) {
    const entry = this.entries.get(token.id);
    if (!entry) {
      this.addToken(token);
      return;
    }
    entry.token = token;
    entry.dirty = true; // re-capture on the next frame (coalesces repeated refreshes)
    const doc = token.document ?? token;
    entry.nameplate.textContent = doc.name ?? "";
  }

  removeToken(token) {
    const entry = this.entries.get(token.id);
    if (!entry) return;
    this._removeEntry(entry);
    this.entries.delete(token.id);
  }

  _removeEntry(entry) {
    this.scene3d.scene.remove(entry.sprite);
    entry.sprite.geometry.dispose();
    if (entry.sprite.material.map) entry.sprite.material.map.dispose();
    entry.sprite.material.dispose();
    if (entry.nameplate.parentNode) entry.nameplate.parentNode.removeChild(entry.nameplate);
  }

  update() {
    const canvasRect = this.scene3d.canvas?.getBoundingClientRect();
    if (!canvasRect) return;

    this._captureDirtyTokens();
    for (const entry of this.entries.values()) {
      this._updateEntry(entry, canvasRect);
    }
  }

  // Capture all dirty tokens this frame (coalesced: each captured at most once,
  // bounded by a per-frame budget). We neutralize the canvas stage transform ONCE
  // for the whole batch — so world coordinates equal scene coordinates while we
  // render — then restore it. Remaining dirty tokens defer to the next frame.
  _captureDirtyTokens() {
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
  // parent, so updateTransform() would dereference null; enableTempParent gives it
  // a temporary identity parent for the update (the same trick renderer.render
  // uses internally).
  _syncStageTransform(stage) {
    const cache = stage.enableTempParent();
    stage.updateTransform();
    stage.disableTempParent(cache);
  }

  // Mirror one token into a texture: image (token.mesh, in the PrimaryCanvasGroup)
  // plus the decoration container (border / status icons / bars / target). The
  // PrimarySpriteMesh cannot be reparented, so instead — with the stage transform
  // already neutralized by the caller — we render both objects in place into one
  // render texture, offsetting by the union scene-space region. The image renders
  // with its rotation baked; decorations render axis-aligned, exactly as on the
  // flat map.
  _captureOne(entry, renderer) {
    const token = entry.token;
    const mesh = token?.mesh;
    if (!mesh) return;

    // Foundry's own nameplate would bake into the texture and duplicate the
    // billboarded DOM nameplate; hide it for both bounds measurement and render.
    const nameplate = token.nameplate;
    const npVisible = nameplate ? nameplate.visible : undefined;
    if (nameplate) nameplate.visible = false;

    let rt = null;
    try {
      // With the stage neutralized, mesh.getBounds() and token.getBounds() share a
      // common world space (camera pan/zoom removed). NOTE: that world space does
      // NOT share an origin with document coordinates (the primary group / token
      // layer carry their own offset), so we must do all capture math in this
      // bounds space and never mix in token.center (which is document space).
      const mb = mesh.getBounds();

      // Render ONLY the real decoration objects, never the whole Token container:
      // the container also holds occlusion/interaction children that punch a
      // token-shaped transparent hole when composited over the image. These are the
      // visible decorations we actually want mirrored (selection border, resource
      // bars, status-effect icons, target reticle), in back-to-front order.
      const decorations = [token.border, token.bars, token.effects, token.target]
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

      // The token IMAGE is a PrimarySpriteMesh whose occlusion shader only renders
      // an outline when drawn outside its primary-group framebuffer. So draw the
      // image as a plain Sprite of the same texture (default shader → filled),
      // sized/positioned/rotated to match the mesh's displayed footprint, with the
      // mesh AABB center (= token center in this world space) as its anchor point.
      const srcTexture = mesh.texture ?? token.texture;
      let imgSprite = null;
      if (srcTexture && mb && mb.width > 0) {
        imgSprite = new PIXI.Sprite(srcTexture);
        imgSprite.anchor.set(0.5);
        imgSprite.position.set(mb.x + mb.width / 2, mb.y + mb.height / 2);
        // mesh.width/height already include the token's appearance scale
        // (token.w is just the footprint).
        imgSprite.width = Math.abs(mesh.width);
        imgSprite.height = Math.abs(mesh.height);
        imgSprite.rotation = mesh.rotation;
        if (mesh.scale.x < 0) imgSprite.scale.x = -imgSprite.scale.x;
        if (mesh.scale.y < 0) imgSprite.scale.y = -imgSprite.scale.y;
        imgSprite.tint = mesh.tint ?? 0xffffff;
      }

      // Composite: image first (cleared), then each decoration over it.
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
      const g = (2 * Math.PI * TOKEN_SIZE_FACTOR) / sceneWidth;
      entry.planeW = region.width * g;
      entry.planeH = region.height * g;

      // Keep the token CENTER on its sphere point despite asymmetric decoration
      // bounds. The image AABB is centered on the token, so its center is the
      // token's visual center in the SAME (bounds) space as `region` — using it
      // (rather than document-space token.center) makes the origin mismatch cancel.
      const hasMesh = mb && mb.width > 0 && mb.height > 0;
      const anchorX = hasMesh ? (mb.x + mb.width / 2) : (region.x + region.width / 2);
      const anchorY = hasMesh ? (mb.y + mb.height / 2) : (region.y + region.height / 2);
      entry.offEastG = (anchorX - (region.x + region.width / 2)) * g;   // +east
      entry.offSouthG = (anchorY - (region.y + region.height / 2)) * g; // +south

      entry.captured = true;
    } catch (err) {
      console.warn("[planetside] token capture failed:", token?.name, err);
    } finally {
      if (nameplate) nameplate.visible = npVisible;
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
    const token = entry.token;
    const doc = token.document ?? token;
    const sprite = entry.sprite;

    if (!entry.captured || token.visible === false) {
      sprite.visible = false;
      entry.nameplate.style.display = "none";
      return;
    }

    const dims = canvas.dimensions;
    if (!dims) return;
    const gridSize = dims.size ?? 100;
    const docWidth = doc.width ?? 1;
    const docHeight = doc.height ?? 1;
    const centerX = (doc.x ?? 0) + (docWidth * gridSize) / 2;
    const centerY = (doc.y ?? 0) + (docHeight * gridSize) / 2;
    const u = (centerX - dims.sceneX) / dims.sceneWidth;
    const v = (centerY - dims.sceneY) / dims.sceneHeight;
    const { lat, lon } = this.mercator.uvToLatLon(u, v);
    if (!this.mercator.isLatitudeOnBody(lat)) {
      sprite.visible = false;
      entry.nameplate.style.display = "none";
      return;
    }

    const P = this.mercator.latLonToSpherePoint(lat, lon, SPRITE_RADIUS);
    const frame = this.scene3d.surfaceFrame(lat, lon);

    // Place the plane so the TOKEN CENTER (not the texture center) lands on P,
    // then orient it flat with a consistent tangent-frame roll. Rotation is
    // baked into the captured image, so no rotateZ here.
    const pos = new THREE.Vector3(P.x, P.y, P.z)
      .addScaledVector(frame.east, -entry.offEastG)
      .addScaledVector(frame.north, entry.offSouthG);
    sprite.position.copy(pos);
    sprite.quaternion.copy(frame.quaternion);
    sprite.scale.set(entry.planeW, entry.planeH, 1);

    const facing = this.scene3d.isFacingCamera(P);
    sprite.visible = facing;

    const displayMode = doc.displayName ?? 0;
    if (!facing || displayMode === 0) {
      entry.nameplate.style.display = "none";
      return;
    }

    const screen = this.scene3d.projectWorldToScreen(P);
    const left = canvasRect.left + screen.x;
    const top = canvasRect.top + screen.y + NAMEPLATE_OFFSET_PX;
    entry.nameplate.style.left = `${left}px`;
    entry.nameplate.style.top = `${top}px`;
    entry.nameplate.style.display = "block";
  }
}
