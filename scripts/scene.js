import * as THREE from "./vendor/three.module.js";
import { samplePerimeterAverageColor } from "./caps.js";
import { LensFlare } from "./flare.js";

const SPHERE_RADIUS = 1;
const SPHERE_SEGMENTS = 96;
const SPHERE_RINGS = 64;
// Higher tessellation when a heightmap is active, so baked landforms aren't
// coarsely faceted (the derived normal map carries sub-vertex detail).
const TERRAIN_SEGMENTS = 256;
const TERRAIN_RINGS = 128;
// On a capless globe (equirect/equal-area at ±90°) the body reaches a converged
// pole vertex; damp displacement to zero within this band of the pole so it can't
// spike. When caps exist the edge is a circle (no spike) and carries full heights.
const POLE_DAMP_BAND_DEG = 6;
// Cap-colour readback works at this resolution (low-frequency; the body's colour
// texture stays full-res). Independent of the source image size.
const BG_CAPCOLOR_MAX = 512;
// How fast a cap's per-longitude rim variation fades toward the pole. Higher =
// the bumpy rim detail is confined nearer the rim and the cap centre is a smooth
// dome (avoids a puckered/creased pole). 1 = linear.
const CAP_VARIATION_FADE_POWER = 3;

// Cap the renderer pixel ratio: full devicePixelRatio with antialias on a hi-DPI
// display renders ~4x the fragments for marginal globe quality. ~1.5 is visually
// indistinguishable in practice; tune by eye on a hi-DPI display (task 4.1).
const MAX_PIXEL_RATIO = 1.5;

const SUN_DIRECTION = new THREE.Vector3(1, 0.3, 1).normalize();
const SUN_DISTANCE = 160;
const SUN_SPRITE_SCALE = 5.5;
const AMBIENT_INTENSITY = 0.08;
const SUN_INTENSITY = 1.0;

const STAR_COUNT = 5000;
const STAR_RADIUS = 150;
const STAR_SIZE = 1.6;

const ATMOSPHERE_OUTER = {
  radius: 1.06,
  color: 0xc8e0ff,
  intensity: 1.6,
  power: 0.6,
  nightDim: 0.0,
  dayLo: -0.55,
  dayHi: 0.4
};

const ATMOSPHERE_INNER = {
  radius: 1.04,
  color: 0xffffff,
  intensity: 10.0,
  power: 1.5,
  nightDim: 0.0,
  dayLo: -0.35,
  dayHi: 0.35
};

export class Scene {
  constructor({ projection, imageSrc, hostElement, markDirty, heightfield }) {
    this.projection = projection;
    this.imageSrc = imageSrc;
    this.host = hostElement;
    this.markDirty = markDirty;
    this.heightfield = heightfield;

    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.canvas = null;

    this.body = null;
    this.northCap = null;
    this.southCap = null;
    this.capMaterial = null;
    this._capColor = null;  // perimeter-average (cap centre colour), linear
    this._bgPixels = null;  // background image pixel buffer (downsampled), for cap colours
    this._bgW = 0;
    this._bgH = 0;
    this.colorReady = false; // colour texture loaded + pixels read back
    this._onColorReady = null; // controller hook: decide reveal / cap / terrain build
    this.bodyTexture = null;
    this.sunLight = null;
    this.ambient = null;
    this.sunSprite = null;
    this.atmosphereOuter = null;
    this.atmosphereInner = null;
    this.lensFlare = null;
    this.stars = null;

    // Scratch reused by surfaceFrame() to avoid per-entry per-frame allocation.
    // Single synchronous caller; the returned frame is consumed before the next
    // call, so do NOT retain it across calls.
    this._sfNormal = new THREE.Vector3();
    this._sfNorth = new THREE.Vector3();
    this._sfEast = new THREE.Vector3();
    this._sfMatrix = new THREE.Matrix4();
    this._sfQuat = new THREE.Quaternion();
    this._sfFrame = {
      east: this._sfEast,
      north: this._sfNorth,
      normal: this._sfNormal,
      quaternion: this._sfQuat
    };
  }

  init() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;

    this.canvas = document.createElement("canvas");
    this.canvas.id = "planetside-canvas";
    this.host.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false
    });
    this.renderer.useLegacyLights = true;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    this.renderer.setSize(w, h, false);
    this.renderer.setClearColor(0x000000, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.01, 200);
    this.camera.up.set(0, 1, 0);

    this._buildStars();
    this._buildSphere();
    this._buildLighting();
    this._buildAtmosphere();
    this._buildLensFlare();

    window.addEventListener("resize", this._onResize);
  }

  _buildSphere() {
    // Load the texture once; the cap color is derived from it on load. The body +
    // caps geometry is built (and rebuilt on projection change) by _buildBody.
    this.bodyTexture = new THREE.TextureLoader().load(
      this.imageSrc,
      (tex) => this._onImageLoaded(tex)
    );
    this.bodyTexture.wrapS = THREE.RepeatWrapping;
    this.bodyTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.bodyTexture.minFilter = THREE.LinearFilter;
    this.bodyTexture.magFilter = THREE.LinearFilter;
    this.bodyTexture.colorSpace = THREE.SRGBColorSpace;

    this._buildBody();
  }

  // Build the body mesh + (conditional) polar caps from the current projection.
  // Reuses the already-loaded texture and the derived cap color, so it can be
  // re-run cheaply when the projection or latitude span changes.
  _buildBody() {
    const maxLat = this.projection.maxLat;
    const hf = this.heightfield;
    const terrain = !!hf?.enabled;
    const segs = terrain ? TERRAIN_SEGMENTS : SPHERE_SEGMENTS;
    const rings = terrain ? TERRAIN_RINGS : SPHERE_RINGS;
    const bodyGeom = new THREE.SphereGeometry(
      SPHERE_RADIUS, segs, rings,
      0, Math.PI * 2,
      Math.PI / 2 - maxLat, 2 * maxLat
    );
    this._rewriteProjectionUvs(bodyGeom);
    if (terrain && hf.loaded) this._bakeDisplacement(bodyGeom);

    const bodyMat = new THREE.MeshLambertMaterial({ map: this.bodyTexture, side: THREE.FrontSide });
    if (terrain && hf.normalMap) bodyMat.normalMap = hf.normalMap; // relief baked into the map
    this.body = new THREE.Mesh(bodyGeom, bodyMat);
    this.body.rotation.y = -Math.PI / 2;
    this.scene.add(this.body);

    // Polar caps only when the body does not reach the poles (Mercator, or span
    // < 90°). At full coverage the map itself reaches the poles — no caps.
    if (!this.projection.coversPoles) {
      const thetaLengthCap = Math.PI / 2 - maxLat;
      const northCapGeom = new THREE.SphereGeometry(
        SPHERE_RADIUS, segs, rings, 0, Math.PI * 2, 0, thetaLengthCap
      );
      const southCapGeom = new THREE.SphereGeometry(
        SPHERE_RADIUS, segs, rings, 0, Math.PI * 2, Math.PI / 2 + maxLat, thetaLengthCap
      );
      if (terrain && hf.loaded) {
        // Interpolate each cap from the body's perimeter heights to a single pole
        // height, so the gray cap continues the terrain without a cliff.
        this._bakeCapDisplacement(northCapGeom);
        this._bakeCapDisplacement(southCapGeom);
      }
      // Per-longitude rim colours fading to the average centre (once the image is
      // loaded), so the cap blends into the map instead of a flat ring.
      const capVertexColors = !!this._bgPixels;
      if (capVertexColors) {
        this._applyCapColors(northCapGeom);
        this._applyCapColors(southCapGeom);
      }
      this.capMaterial = new THREE.MeshLambertMaterial({
        color: capVertexColors ? 0xffffff : (this._capColor ?? 0x202020),
        vertexColors: capVertexColors,
        side: THREE.FrontSide
      });
      this.northCap = new THREE.Mesh(northCapGeom, this.capMaterial);
      this.southCap = new THREE.Mesh(southCapGeom, this.capMaterial);
      // Match the body's -90° longitude frame so cap rim heights line up with it.
      this.northCap.rotation.y = -Math.PI / 2;
      this.southCap.rotation.y = -Math.PI / 2;
      this.scene.add(this.northCap);
      this.scene.add(this.southCap);
    }
  }

  // Rebuild the body + caps after a projection / latitude-span change. Preserves
  // the camera, texture, lighting, atmosphere, etc.
  rebuildBody() {
    this._disposeBody();
    this._buildBody();
    this.markDirty?.();
  }

  _disposeBody() {
    if (this.body) {
      this.scene.remove(this.body);
      this.body.geometry.dispose();
      this.body.material.dispose(); // not the texture — it is reused
      this.body = null;
    }
    for (const cap of [this.northCap, this.southCap]) {
      if (!cap) continue;
      this.scene.remove(cap);
      cap.geometry.dispose();
    }
    if (this.capMaterial) { this.capMaterial.dispose(); this.capMaterial = null; }
    this.northCap = null;
    this.southCap = null;
  }

  _buildLighting() {
    this.ambient = new THREE.AmbientLight(0xffffff, AMBIENT_INTENSITY);
    this.scene.add(this.ambient);

    this.sunLight = new THREE.DirectionalLight(0xffffff, SUN_INTENSITY);
    this.sunLight.position.copy(SUN_DIRECTION).multiplyScalar(10);
    this.sunLight.target.position.set(0, 0, 0);
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    const flareTex = this._createFlareTexture();
    const flareMat = new THREE.SpriteMaterial({
      map: flareTex,
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true
    });
    this.sunSprite = new THREE.Sprite(flareMat);
    this.sunSprite.position.copy(SUN_DIRECTION).multiplyScalar(SUN_DISTANCE);
    this.sunSprite.scale.set(SUN_SPRITE_SCALE, SUN_SPRITE_SCALE, 1);
    this.scene.add(this.sunSprite);
  }

  _buildStars() {
    const positions = new Float32Array(STAR_COUNT * 3);
    const colors = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      const u = Math.random() * 2 - 1;
      const phi = Math.random() * 2 * Math.PI;
      const s = Math.sqrt(1 - u * u);
      positions[i * 3]     = s * Math.cos(phi) * STAR_RADIUS;
      positions[i * 3 + 1] = u * STAR_RADIUS;
      positions[i * 3 + 2] = s * Math.sin(phi) * STAR_RADIUS;

      const brightness = Math.pow(Math.random(), 3.0) * 0.7 + 0.3;
      const tintRoll = Math.random();
      let r = brightness, g = brightness, b = brightness;
      if (tintRoll > 0.99) {
        const dim = 0.15 + Math.random() * 0.25;
        r = dim * 0.95;
        g = dim * 0.55;
        b = dim * 0.25;
      } else if (tintRoll > 0.93) {
        r = brightness * 0.7;
        g = brightness * 0.82;
        b = brightness;
      } else if (tintRoll > 0.91) {
        r = brightness;
        g = brightness * 0.9;
        b = brightness * 0.72;
      }
      colors[i * 3]     = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: STAR_SIZE,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      depthWrite: false
    });
    this.stars = new THREE.Points(geom, mat);
    this.scene.add(this.stars);
  }

  _buildLensFlare() {
    this.lensFlare = new LensFlare({
      renderer: this.renderer,
      mainCamera: this.camera,
      hostElement: this.host,
      planetRadius: SPHERE_RADIUS
    });
    const sunWorldPos = SUN_DIRECTION.clone().multiplyScalar(SUN_DISTANCE);
    this.lensFlare.setSunWorldPosition(sunWorldPos);

    // distance: 0 = at sun, 1 = at center, > 1 = past center
    this.lensFlare.addElement({ size: 0.35, color: 0xffffcc, distance: 0.0,  alpha: 0.6 });
    this.lensFlare.addElement({ size: 0.12, color: 0xffaa44, distance: 0.35, alpha: 0.7 });
    this.lensFlare.addElement({ size: 0.08, color: 0xff6633, distance: 0.55, alpha: 0.5 });
    this.lensFlare.addElement({ size: 0.10, color: 0x6688ff, distance: 0.80, alpha: 0.5 });
    this.lensFlare.addElement({ size: 0.20, color: 0xaaccff, distance: 1.05, alpha: 0.4 });
    this.lensFlare.addElement({ size: 0.07, color: 0xff88aa, distance: 1.40, alpha: 0.4 });
    this.lensFlare.addElement({ size: 0.14, color: 0xffaa88, distance: 1.70, alpha: 0.35 });
  }

  _buildAtmosphere() {
    this.atmosphereOuter = this._buildAtmosphereShell(ATMOSPHERE_OUTER);
    this.atmosphereInner = this._buildAtmosphereShell(ATMOSPHERE_INNER);
  }

  _buildAtmosphereShell(params) {
    const geom = new THREE.SphereGeometry(params.radius, SPHERE_SEGMENTS, SPHERE_RINGS);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uSunDirection: { value: SUN_DIRECTION.clone() },
        uColor: { value: new THREE.Color(params.color) },
        uIntensity: { value: params.intensity },
        uPower: { value: params.power },
        uNightDim: { value: params.nightDim },
        uDayLo: { value: params.dayLo },
        uDayHi: { value: params.dayHi }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main() {
          vNormal = normalize(mat3(modelMatrix) * normal);
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDirection;
        uniform vec3 uColor;
        uniform float uIntensity;
        uniform float uPower;
        uniform float uNightDim;
        uniform float uDayLo;
        uniform float uDayHi;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          vec3 N = normalize(vNormal);
          float rim = pow(max(0.0, -dot(N, viewDir)), uPower);
          float sunDot = dot(N, normalize(uSunDirection));
          float day = smoothstep(uDayLo, uDayHi, sunDot);
          float lit = mix(uNightDim, 1.0, day);
          vec3 color = uColor * rim * uIntensity * lit;
          gl_FragColor = vec4(color, rim * lit);
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geom, mat);
    this.scene.add(mesh);
    return mesh;
  }

  _createFlareTexture() {
    const size = 256;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d");
    const cx = size / 2;
    const grd = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
    grd.addColorStop(0.00, "rgba(255, 250, 240, 1.0)");
    grd.addColorStop(0.76, "rgba(255, 240, 215, 0.97)");
    grd.addColorStop(0.78, "rgba(255, 220, 175, 0.20)");
    grd.addColorStop(0.81, "rgba(255, 190, 130, 0.04)");
    grd.addColorStop(0.84, "rgba(0,   0,   0,   0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _rewriteProjectionUvs(geometry) {
    const uvAttr = geometry.attributes.uv;
    const posAttr = geometry.attributes.position;

    for (let i = 0; i < uvAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const z = posAttr.getZ(i);
      const r = Math.sqrt(x * x + y * y + z * z) || 1;
      const lat = Math.asin(Math.max(-1, Math.min(1, y / r)));
      // Mesh V is the texture-flipped canonical V (the single flip site): the
      // texture loads flipY, so geometric north must sample V=1 while the
      // projection's canonical latToV puts north at V=0.
      uvAttr.setY(i, 1 - this.projection.latToV(lat));
    }
    uvAttr.needsUpdate = true;
  }

  // Bake the heightmap into the body geometry: offset each vertex radially by the
  // elevation at its location, then recompute normals so the displaced surface
  // shades. The mesh is rotated -90° about Y, so the WORLD longitude is
  // atan2(-z, x); sampling the heightfield by the resulting scene UV makes terrain
  // align with both the color map and the (world-positioned) placeables/overlays.
  _bakeDisplacement(geometry) {
    const pos = geometry.attributes.position;
    const coversPoles = this.projection.coversPoles; // capless → has a real pole vertex
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const r = Math.sqrt(x * x + y * y + z * z) || 1;
      const lat = Math.asin(Math.max(-1, Math.min(1, y / r)));
      const lon = Math.atan2(-z, x); // world longitude after the body's -90° Y rotation
      const { u, v } = this.projection.latLonToUv(lat, lon);
      let h = this.heightfield.elevationAt(u, v);
      if (h === 0) continue;
      if (coversPoles) h *= this._poleDamp(lat); // only a converged pole vertex needs it
      const scale = (r + h) / r;
      pos.setXYZ(i, x * scale, y * scale, z * scale);
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  _poleDamp(lat) {
    const latDeg = Math.abs(lat) * 180 / Math.PI;
    return Math.max(0, Math.min(1, (90 - latDeg) / POLE_DAMP_BAND_DEG));
  }

  // Displace a polar cap so its rim matches the body's displaced edge heights and
  // interpolates smoothly to a single (mean) height at the pole — no cliff at the
  // boundary, no tear at the converged pole vertex. The cap is rotated to the body
  // frame (worldLon = atan2(-z, x)), so rim sampling lines up with the body bake.
  _bakeCapDisplacement(capGeom) {
    const pos = capGeom.attributes.position;
    const maxLat = this.projection.maxLat;
    const span = (Math.PI / 2) - maxLat; // rim (maxLat) → pole (90°)
    if (span <= 1e-6) return;

    // Hemisphere sign of this cap, then the mean rim height → the single pole value.
    let sign = 1;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y !== 0) { sign = Math.sign(y); break; }
    }
    const rimLat = sign * maxLat;
    const SAMPLES = 64;
    let sum = 0;
    for (let s = 0; s < SAMPLES; s++) {
      const lon = -Math.PI + (s / SAMPLES) * 2 * Math.PI;
      const { u, v } = this.projection.latLonToUv(rimLat, lon);
      sum += this.heightfield.elevationAt(u, v);
    }
    const poleHeight = sum / SAMPLES;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const r = Math.sqrt(x * x + y * y + z * z) || 1;
      const lat = Math.asin(Math.max(-1, Math.min(1, y / r)));
      const lon = Math.atan2(-z, x);
      const { u, v } = this.projection.latLonToUv(rimLat, lon); // body edge height at this lon
      const rimH = this.heightfield.elevationAt(u, v);
      const t = Math.min(1, Math.max(0, (Math.abs(lat) - maxLat) / span)); // 0 rim → 1 pole
      // Fade the per-longitude variation out toward the pole faster than linear, so
      // the centre settles to a smooth dome (mean height) instead of a puckered
      // point; the rim (fade = 1) still matches the body edge exactly.
      const fade = Math.pow(1 - t, CAP_VARIATION_FADE_POWER);
      const h = poleHeight + (rimH - poleHeight) * fade;
      if (h === 0) continue;
      const scale = (r + h) / r;
      pos.setXYZ(i, x * scale, y * scale, z * scale);
    }
    pos.needsUpdate = true;
    capGeom.computeVertexNormals();
  }

  // Per-vertex colour for a cap: the body's edge colour at each longitude (so the
  // cap continues the map at the rim), fading to the perimeter-average toward the
  // pole with the same curve as the height — a smooth dome, no hard gray ring.
  _applyCapColors(capGeom) {
    if (!this._bgPixels) return;
    const pos = capGeom.attributes.position;
    const maxLat = this.projection.maxLat;
    const span = (Math.PI / 2) - maxLat;
    let sign = 1;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y !== 0) { sign = Math.sign(y); break; }
    }
    const rimLat = sign * maxLat;
    const avg = this._capColor ?? new THREE.Color(0x202020);
    const tmp = new THREE.Color();
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const r = Math.sqrt(x * x + y * y + z * z) || 1;
      const lat = Math.asin(Math.max(-1, Math.min(1, y / r)));
      const lon = Math.atan2(-z, x);
      const { u, v } = this.projection.latLonToUv(rimLat, lon);
      this._sampleBgColor(u, v, tmp);
      const t = span > 1e-6 ? Math.min(1, Math.max(0, (Math.abs(lat) - maxLat) / span)) : 0;
      const fade = Math.pow(1 - t, CAP_VARIATION_FADE_POWER);
      colors[i * 3]     = avg.r + (tmp.r - avg.r) * fade;
      colors[i * 3 + 1] = avg.g + (tmp.g - avg.g) * fade;
      colors[i * 3 + 2] = avg.b + (tmp.b - avg.b) * fade;
    }
    capGeom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }

  // Nearest-sample the background image at a scene UV → a linear THREE.Color
  // (sRGB→linear so it matches the body's displayed colour). U wraps, V clamps.
  _sampleBgColor(u, v, out) {
    const w = this._bgW, h = this._bgH, data = this._bgPixels;
    const x = ((Math.round(u * w) % w) + w) % w;
    const y = Math.max(0, Math.min(h - 1, Math.round(v * h)));
    const i = (y * w + x) * 4;
    return out.setRGB(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255, THREE.SRGBColorSpace);
  }

  _onImageLoaded(texture) {
    const img = texture.image;
    if (!img || !img.width || !img.height) return;
    // Downsample for the cap-colour readback (low-frequency). The body's full-res
    // colour texture is the TextureLoader texture itself — untouched, GPU-uploaded.
    const scale = Math.min(1, BG_CAPCOLOR_MAX / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    this._bgPixels = data;
    this._bgW = w;
    this._bgH = h;
    const { r, g, b } = samplePerimeterAverageColor(data, w, h);
    // The average is the cap's centre colour; sRGB → linear so it matches the body.
    this._capColor = new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
    // The colour texture reveals on its own (GPU update). The controller decides
    // when to (re)build caps/terrain now the image pixels are available — we do
    // NOT rebuild here (keeps the flat reveal cheap and avoids redundant bakes).
    this.colorReady = true;
    this._onColorReady?.();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
    if (this.lensFlare) {
      this.lensFlare.update();
      this.lensFlare.render();
    }
  }

  _onResize = () => {
    if (!this.renderer || !this.host) return;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.markDirty?.(); // the view changed — render this frame
  };

  raycastSphere(ndcX, ndcY) {
    const ray = new THREE.Raycaster();
    ray.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    const hits = ray.intersectObject(this.body, false);
    return hits.length > 0 ? hits[0] : null;
  }

  raycastObjects(ndcX, ndcY, objects) {
    if (!objects || objects.length === 0) return [];
    const ray = new THREE.Raycaster();
    ray.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    return ray.intersectObjects(objects, false);
  }

  projectWorldToScreen(point) {
    const v = new THREE.Vector3(point.x, point.y, point.z);
    v.project(this.camera);
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    return {
      x: (v.x * 0.5 + 0.5) * w,
      y: (-v.y * 0.5 + 0.5) * h,
      depth: v.z
    };
  }

  // Returns the surface tangent frame at (lat, lon): outward radial normal, the
  // north (increasing-latitude) and east (increasing-longitude) tangents, and a
  // quaternion orienting a plane so local +X→east, +Y→north, +Z→outward normal.
  // Tangents are derived by finite-differencing the projection's sphere mapping, so
  // this stays correct regardless of the mapping's internal convention. Used to
  // lay token meshes flat on the surface with a consistent (non-wobbling) roll.
  surfaceFrame(lat, lon) {
    const EPS = 1e-3;
    const P = this.projection.latLonToSpherePoint(lat, lon, 1);
    const Pn = this.projection.latLonToSpherePoint(lat + EPS, lon, 1);

    const normal = this._sfNormal.set(P.x, P.y, P.z).normalize();
    const north = this._sfNorth.set(Pn.x - P.x, Pn.y - P.y, Pn.z - P.z);
    north.addScaledVector(normal, -north.dot(normal)); // project onto tangent plane
    if (north.lengthSq() < 1e-12) {
      // Degenerate near a pole (the body is cropped at ±85°, so this is defensive).
      north.set(0, 1, 0).addScaledVector(normal, -normal.y);
      if (north.lengthSq() < 1e-12) north.set(1, 0, 0).addScaledVector(normal, -normal.x);
    }
    north.normalize();

    // ENU is right-handed (E × N = U), so east = north × normal.
    const east = this._sfEast.crossVectors(north, normal).normalize();
    this._sfMatrix.makeBasis(east, north, normal);
    this._sfQuat.setFromRotationMatrix(this._sfMatrix);
    return this._sfFrame; // shared scratch — consume before the next call
  }

  isFacingCamera(point) {
    const toCam = new THREE.Vector3()
      .copy(this.camera.position)
      .sub(new THREE.Vector3(point.x, point.y, point.z))
      .normalize();
    const normal = new THREE.Vector3(point.x, point.y, point.z).normalize();
    return toCam.dot(normal) > 0;
  }

  destroy() {
    window.removeEventListener("resize", this._onResize);
    if (this.body) { this.body.geometry.dispose(); this.body.material.dispose(); }
    if (this.northCap) this.northCap.geometry.dispose();
    if (this.southCap) this.southCap.geometry.dispose();
    if (this.capMaterial) this.capMaterial.dispose();
    if (this.bodyTexture) this.bodyTexture.dispose();
    if (this.sunSprite) {
      this.sunSprite.material.map?.dispose();
      this.sunSprite.material.dispose();
    }
    for (const shell of [this.atmosphereOuter, this.atmosphereInner]) {
      if (!shell) continue;
      shell.geometry.dispose();
      shell.material.dispose();
    }
    if (this.lensFlare) this.lensFlare.destroy();
    if (this.stars) {
      this.stars.geometry.dispose();
      this.stars.material.dispose();
    }
    if (this.renderer) this.renderer.dispose();
    if (this.canvas && this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.body = this.northCap = this.southCap = null;
    this.scene = this.camera = this.renderer = this.canvas = null;
    this.bodyTexture = null;
    this.sunLight = this.ambient = this.sunSprite = null;
    this.atmosphereOuter = this.atmosphereInner = this.lensFlare = this.stars = null;
  }
}
