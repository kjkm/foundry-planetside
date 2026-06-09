import * as THREE from "./vendor/three.module.js";

// CPU derivation (readback, Sobel normal map, bake sampling) runs at this capped
// working resolution (long edge), independent of the source image size — so load
// cost doesn't scale with high-res heightmaps. The colour texture stays full-res.
// ≥ the body tessellation and high enough for crisp normals; tune by eye.
const TERRAIN_WORK_MAX = 1536;

export const TERRAIN_DEFAULTS = Object.freeze({
  heightmap: "",
  displacementScale: 0.03, // in globe radii (sphere radius = 1)
  reliefStrength: 1.0
});

export function readTerrainFlags(scene) {
  const f = scene?.flags?.planetside ?? {};
  return {
    heightmap: f.heightmap ?? TERRAIN_DEFAULTS.heightmap,
    displacementScale: Number(f.displacementScale ?? TERRAIN_DEFAULTS.displacementScale),
    reliefStrength: Number(f.reliefStrength ?? TERRAIN_DEFAULTS.reliefStrength)
  };
}

// Shared terrain source: loads a heightmap PNG to a grayscale buffer, samples a
// radial elevation in scene-image space (so it aligns with the map by
// construction), and derives a normal map for fine relief. Inert (elevationAt →
// 0, no normal map) when no heightmap is set. Mutated in place by configure() so
// scene/placeables/overlays holders track changes without re-wiring.
export class Heightfield {
  constructor(opts = {}) {
    this.onReady = null;      // controller sets: () => rebuild body + markDirty
    this.src = "";
    this.displacementScale = 0;
    this.reliefStrength = 1;
    this._buf = null;         // Float32 grayscale [0,1], row-major, top row first
    this._w = 0;
    this._h = 0;
    this._normalMap = null;   // THREE.CanvasTexture, or null
    this.configure(opts);
  }

  get enabled() { return !!this.src; }   // a heightmap is configured
  get loaded() { return !!this._buf; }   // pixel data is available
  get normalMap() { return this._normalMap; }

  configure({ heightmap = "", displacementScale = TERRAIN_DEFAULTS.displacementScale,
              reliefStrength = TERRAIN_DEFAULTS.reliefStrength } = {}) {
    this.displacementScale = Number.isFinite(displacementScale) ? displacementScale : 0;
    this.reliefStrength = Number.isFinite(reliefStrength) ? reliefStrength : 1;
    const src = heightmap || "";
    if (src !== this.src) {
      this.src = src;
      this._disposeData();
      if (src) this._load(src);
    } else if (this._buf) {
      this._buildNormalMap(); // src unchanged; relief strength may have changed
    }
  }

  _load(src) {
    new THREE.TextureLoader().load(
      src,
      (tex) => {
        try { this._ingest(tex.image); } catch (e) { console.warn("[planetside] heightmap ingest failed", e); }
        tex.dispose();
        this.onReady?.();
      },
      undefined,
      () => console.warn("[planetside] heightmap failed to load:", src)
    );
  }

  _ingest(img) {
    if (!img?.width || !img?.height) return;
    // Downsample to a capped working resolution before readback so the Sobel pass
    // and bake sampling don't scale with the source image's size. drawImage does
    // the scaling natively (cheap); getImageData then runs on the small canvas.
    const scale = Math.min(1, TERRAIN_WORK_MAX / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const buf = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      // Luminance from RGB (heightmaps are grayscale, but be tolerant).
      buf[i] = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255;
    }
    this._buf = buf;
    this._w = w;
    this._h = h;
    this._buildNormalMap();
  }

  // Bilinear sample in scene-image space: U wraps (the east-west seam is the same
  // meridian — seam columns must agree), V clamps. (u, v) is the same scene UV the
  // color texture and placeables/overlays use; v = 0 is the top/north row.
  _sample(u, v) {
    const w = this._w, h = this._h;
    const fx = u * w - 0.5;
    const fy = v * h - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const wrap = (x) => ((x % w) + w) % w;
    const clamp = (y) => Math.max(0, Math.min(h - 1, y));
    const x0w = wrap(x0), x1w = wrap(x0 + 1);
    const y0c = clamp(y0), y1c = clamp(y0 + 1);
    const a = this._buf[y0c * w + x0w], b = this._buf[y0c * w + x1w];
    const cc = this._buf[y1c * w + x0w], d = this._buf[y1c * w + x1w];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + d * tx) * ty;
  }

  // Raw radial elevation (globe units) at a scene UV. Returns 0 when inert.
  // Pole-spike damping (for a converged pole vertex on a capless globe) is applied
  // by the caller at bake time, so placeables, overlays, and the caps all see the
  // true heights (the caps interpolate the body's real perimeter heights).
  elevationAt(u, v) {
    if (!this._buf || !this.displacementScale) return 0;
    return this._sample(u, v) * this.displacementScale;
  }

  _buildNormalMap() {
    if (!this._buf) { this._disposeNormalMap(); return; }
    const w = this._w, h = this._h;
    const out = new Uint8ClampedArray(w * h * 4);
    const strength = this.reliefStrength;
    const wrap = (x) => ((x % w) + w) % w;
    const clamp = (y) => Math.max(0, Math.min(h - 1, y));
    const at = (x, y) => this._buf[clamp(y) * w + wrap(x)];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const tl = at(x - 1, y - 1), t = at(x, y - 1), tr = at(x + 1, y - 1);
        const l = at(x - 1, y), r = at(x + 1, y);
        const bl = at(x - 1, y + 1), b = at(x, y + 1), br = at(x + 1, y + 1);
        const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
        const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);
        let nx = -dx * strength, ny = -dy * strength, nz = 1;
        const len = Math.hypot(nx, ny, nz) || 1;
        const i = (y * w + x) * 4;
        out[i]     = (nx / len * 0.5 + 0.5) * 255;
        out[i + 1] = (ny / len * 0.5 + 0.5) * 255;
        out[i + 2] = (nz / len * 0.5 + 0.5) * 255;
        out[i + 3] = 255;
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").putImageData(new ImageData(out, w, h), 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    this._disposeNormalMap();
    this._normalMap = tex;
  }

  _disposeNormalMap() {
    if (this._normalMap) { this._normalMap.dispose(); this._normalMap = null; }
  }

  _disposeData() {
    this._buf = null;
    this._w = this._h = 0;
    this._disposeNormalMap();
  }

  destroy() {
    this._disposeData();
    this.onReady = null;
  }
}
