import * as THREE from "./vendor/three.module.js";

export class LensFlare {
  constructor({ renderer, mainCamera, hostElement, planetRadius = 1.0 }) {
    this.renderer = renderer;
    this.mainCamera = mainCamera;
    this.host = hostElement;
    this.planetRadius = planetRadius;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

    this.elements = [];
    this.sunWorldPos = new THREE.Vector3();
    this.sunNDC = new THREE.Vector3();
    this._d = new THREE.Vector3();
    this._f = new THREE.Vector3();
  }

  setSunWorldPosition(pos) {
    this.sunWorldPos.copy(pos);
  }

  addElement({ size, color, distance, alpha = 1.0 }) {
    const tex = this._makeFlareTexture(color);
    const mat = new THREE.SpriteMaterial({
      map: tex,
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: alpha
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(size, size, 1);
    this.scene.add(sprite);
    this.elements.push({ sprite, distance, size, baseAlpha: alpha });
  }

  _makeFlareTexture(color) {
    const size = 128;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const cx = size / 2;
    const col = new THREE.Color(color);
    const r = Math.round(col.r * 255);
    const g = Math.round(col.g * 255);
    const b = Math.round(col.b * 255);
    const grd = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
    grd.addColorStop(0.00, `rgba(${r}, ${g}, ${b}, 1.0)`);
    grd.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, 0.55)`);
    grd.addColorStop(0.7,  `rgba(${r}, ${g}, ${b}, 0.12)`);
    grd.addColorStop(1.00, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _isOccludedByPlanet() {
    this._d.subVectors(this.sunWorldPos, this.mainCamera.position);
    this._f.copy(this.mainCamera.position);
    const a = this._d.dot(this._d);
    const b = 2 * this._f.dot(this._d);
    const c = this._f.dot(this._f) - this.planetRadius * this.planetRadius;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return false;
    const t1 = (-b - Math.sqrt(disc)) / (2 * a);
    return t1 > 0 && t1 < 1;
  }

  update() {
    this.sunNDC.copy(this.sunWorldPos).project(this.mainCamera);
    const behindCamera = this.sunNDC.z > 1.0;
    const occluded = this._isOccludedByPlanet();
    const hide = behindCamera || occluded;

    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    const aspect = w / h;
    if (this.camera.left !== -aspect) {
      this.camera.left = -aspect;
      this.camera.right = aspect;
      this.camera.updateProjectionMatrix();
    }

    const sunOffscreen =
      this.sunNDC.x < -1.2 || this.sunNDC.x > 1.2 ||
      this.sunNDC.y < -1.2 || this.sunNDC.y > 1.2;
    const edgeFade = sunOffscreen ? 0.0 : Math.min(
      1.0,
      (1.2 - Math.max(Math.abs(this.sunNDC.x), Math.abs(this.sunNDC.y))) / 0.4
    );

    for (const e of this.elements) {
      if (hide) {
        e.sprite.visible = false;
        continue;
      }
      const t = e.distance;
      e.sprite.position.set(
        this.sunNDC.x * (1 - t) * aspect,
        this.sunNDC.y * (1 - t),
        0
      );
      e.sprite.material.opacity = e.baseAlpha * edgeFade;
      e.sprite.visible = edgeFade > 0;
    }
  }

  render() {
    const autoClear = this.renderer.autoClear;
    this.renderer.autoClear = false;
    this.renderer.render(this.scene, this.camera);
    this.renderer.autoClear = autoClear;
  }

  destroy() {
    for (const e of this.elements) {
      this.scene.remove(e.sprite);
      e.sprite.material.map?.dispose();
      e.sprite.material.dispose();
    }
    this.elements = [];
  }
}
