import * as THREE from "./vendor/three.module.js";

const SPRITE_RADIUS = 1.001;
const TOKEN_SIZE_FACTOR = 1.0;
const NAMEPLATE_OFFSET_PX = 18;

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

const PLACEHOLDER_CACHE = new Map();

function placeholderTexture(label) {
  const key = label || "?";
  if (PLACEHOLDER_CACHE.has(key)) return PLACEHOLDER_CACHE.get(key);
  const size = 128;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#666";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 64px sans-serif";
  ctx.fillText(key, size / 2, size / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  PLACEHOLDER_CACHE.set(key, tex);
  return tex;
}

export class TokenLayer {
  constructor({ scene3d, mercator, hostElement }) {
    this.scene3d = scene3d;
    this.mercator = mercator;
    this.host = hostElement;
    this.entries = new Map();
    this.textureCache = new Map();
    this.loader = new THREE.TextureLoader();
  }

  install() {
    const placeables = canvas.tokens?.placeables ?? [];
    for (const token of placeables) this.addToken(token);
  }

  destroy() {
    for (const entry of this.entries.values()) this._removeEntry(entry);
    this.entries.clear();
    for (const cached of this.textureCache.values()) cached.texture.dispose();
    this.textureCache.clear();
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
    this.scene3d.scene.add(sprite);

    const nameplate = document.createElement("div");
    nameplate.className = "planetside-nameplate";
    Object.assign(nameplate.style, NAMEPLATE_BASE_STYLES);
    this.host.appendChild(nameplate);

    const entry = { token, sprite, nameplate, textureKey: null };
    this.entries.set(token.id, entry);

    this._applyTexture(entry, doc.texture?.src);
    this._applyDocument(entry);
  }

  updateToken(token, _changes) {
    const entry = this.entries.get(token.id);
    if (!entry) {
      this.addToken(token);
      return;
    }
    entry.token = token;
    const doc = token.document ?? token;
    const newSrc = doc.texture?.src ?? null;
    if (newSrc !== entry.textureKey) this._applyTexture(entry, newSrc);
    this._applyDocument(entry);
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
    entry.sprite.material.dispose();
    if (entry.nameplate.parentNode) entry.nameplate.parentNode.removeChild(entry.nameplate);
    if (entry.textureKey) this._releaseTexture(entry.textureKey);
  }

  _applyDocument(entry) {
    const doc = entry.token.document ?? entry.token;
    entry.sprite.material.opacity = doc.alpha ?? 1.0;
    entry._rotationRad = ((doc.rotation ?? 0) * Math.PI) / 180;
    const dims = canvas.dimensions;
    const gridSize = dims?.size ?? 100;
    const sceneWidth = dims?.sceneWidth ?? 2048;
    const cellBase = (gridSize / sceneWidth) * 2 * Math.PI * TOKEN_SIZE_FACTOR;
    const cellsW = doc.width ?? 1;
    const cellsH = doc.height ?? 1;
    const texScaleX = doc.texture?.scaleX ?? 1.0;
    const texScaleY = doc.texture?.scaleY ?? 1.0;
    const scaleX = cellsW * cellBase * texScaleX;
    const scaleY = cellsH * cellBase * texScaleY;
    entry.sprite.scale.set(scaleX, scaleY, 1);
    entry.nameplate.textContent = doc.name ?? "";
  }

  _applyTexture(entry, src) {
    if (entry.textureKey) {
      this._releaseTexture(entry.textureKey);
      entry.textureKey = null;
    }
    const doc = entry.token.document ?? entry.token;
    const placeholderLabel = (doc.name?.[0] || "?").toUpperCase();
    if (!src) {
      entry.sprite.material.map = placeholderTexture(placeholderLabel);
      entry.sprite.material.needsUpdate = true;
      return;
    }
    const cached = this.textureCache.get(src);
    if (cached) {
      cached.refCount++;
      entry.sprite.material.map = cached.texture;
      entry.sprite.material.needsUpdate = true;
      entry.textureKey = src;
      return;
    }
    entry.sprite.material.map = placeholderTexture(placeholderLabel);
    entry.sprite.material.needsUpdate = true;
    this.loader.load(
      src,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        if (!this.entries.has(entry.token.id)) {
          texture.dispose();
          return;
        }
        const existing = this.textureCache.get(src);
        if (existing) {
          existing.refCount++;
          texture.dispose();
          entry.sprite.material.map = existing.texture;
          entry.sprite.material.needsUpdate = true;
          entry.textureKey = src;
          return;
        }
        this.textureCache.set(src, { texture, refCount: 1 });
        entry.sprite.material.map = texture;
        entry.sprite.material.needsUpdate = true;
        entry.textureKey = src;
      },
      undefined,
      (err) => {
        console.warn(`[planetside] failed to load token texture: ${src}`, err);
      }
    );
  }

  _releaseTexture(src) {
    const cached = this.textureCache.get(src);
    if (!cached) return;
    cached.refCount--;
    if (cached.refCount <= 0) {
      cached.texture.dispose();
      this.textureCache.delete(src);
    }
  }

  update() {
    const canvasRect = this.scene3d.canvas?.getBoundingClientRect();
    if (!canvasRect) return;
    for (const entry of this.entries.values()) {
      this._updateEntry(entry, canvasRect);
    }
  }

  _updateEntry(entry, canvasRect) {
    const token = entry.token;
    const doc = token.document ?? token;

    if (token.visible === false) {
      entry.sprite.visible = false;
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
      entry.sprite.visible = false;
      entry.nameplate.style.display = "none";
      return;
    }

    const point = this.mercator.latLonToSpherePoint(lat, lon, SPRITE_RADIUS);
    entry.sprite.position.set(point.x, point.y, point.z);
    entry.sprite.lookAt(0, 0, 0);
    entry.sprite.rotateZ(entry._rotationRad ?? 0);
    const facing = this.scene3d.isFacingCamera(point);
    entry.sprite.visible = facing;

    const displayMode = doc.displayName ?? 0;
    if (!facing || displayMode === 0) {
      entry.nameplate.style.display = "none";
      return;
    }

    const screen = this.scene3d.projectWorldToScreen(point);
    const left = canvasRect.left + screen.x;
    const top = canvasRect.top + screen.y + NAMEPLATE_OFFSET_PX;
    entry.nameplate.style.left = `${left}px`;
    entry.nameplate.style.top = `${top}px`;
    entry.nameplate.style.display = "block";
  }
}
