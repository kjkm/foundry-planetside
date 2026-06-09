const DEG = Math.PI / 180;

// Each curve maps latitude ↔ a normalized n ∈ [-1, 1] (n = +1 at +maxLat / north).
// The canonical scene-UV V is v = 0.5 - 0.5·n (north → 0), matching the inverse
// path used for input/pings/HUD. The mesh UV uses 1 - v (texture flip), applied in
// exactly one place (scene.js) so render and inverse can never drift.
const CURVES = {
  equirectangular: {
    norm: (lat, maxLat) => lat / maxLat,
    denorm: (n, maxLat) => n * maxLat
  },
  equalArea: {
    norm: (lat, maxLat) => Math.sin(lat) / Math.sin(maxLat),
    denorm: (n, maxLat) => Math.asin(Math.max(-1, Math.min(1, n * Math.sin(maxLat))))
  },
  mercator: {
    norm: (lat, maxLat) =>
      Math.log(Math.tan(Math.PI / 4 + lat / 2)) / Math.log(Math.tan(Math.PI / 4 + maxLat / 2)),
    denorm: (n, maxLat) =>
      2 * Math.atan(Math.exp(n * Math.log(Math.tan(Math.PI / 4 + maxLat / 2)))) - Math.PI / 2
  }
};

export const PROJECTION_OPTIONS = Object.freeze({
  equirectangular: "Equirectangular (default)",
  mercator: "Mercator",
  equalArea: "Equal-area"
});

export const PROJECTION_DEFAULTS = Object.freeze({
  projection: "equirectangular",
  latitudeSpan: 90
});

// Mercator's V diverges at ±90°; keep its span safely short of the pole.
const MERCATOR_MAX_SPAN_DEG = 88;
const MIN_SPAN_DEG = 10;

export function readProjectionFlags(scene) {
  const flags = scene?.flags?.planetside ?? {};
  const projection = PROJECTION_OPTIONS[flags.projection] ? flags.projection : PROJECTION_DEFAULTS.projection;
  const latitudeSpan = Number(flags.latitudeSpan ?? PROJECTION_DEFAULTS.latitudeSpan);
  return { projection, latitudeSpan };
}

export class Projection {
  constructor(opts = {}) {
    this.configure(opts);
  }

  // Mutate in place so existing holders (input, overlays, placeables, scene) pick
  // up a projection/span change without having their references re-wired.
  configure({ curve = PROJECTION_DEFAULTS.projection, latitudeSpanDeg = PROJECTION_DEFAULTS.latitudeSpan } = {}) {
    this.curveName = CURVES[curve] ? curve : "equirectangular";
    this.curve = CURVES[this.curveName];
    const maxSpan = this.curveName === "mercator" ? MERCATOR_MAX_SPAN_DEG : 90;
    let span = Number.isFinite(latitudeSpanDeg) ? latitudeSpanDeg : 90;
    span = Math.max(MIN_SPAN_DEG, Math.min(maxSpan, span));
    this.spanDeg = span;
    this.maxLat = span * DEG;
    // Full-sphere coverage (image reaches the poles) — only equirect/equal-area at
    // ±90°. When true, the body needs no polar caps.
    this.coversPoles = span >= 90 && this.curveName !== "mercator";
  }

  // Canonical scene-UV V for a latitude (north → 0, south → 1).
  latToV(lat) {
    const clamped = Math.max(-this.maxLat, Math.min(this.maxLat, lat));
    return 0.5 - 0.5 * this.curve.norm(clamped, this.maxLat);
  }

  vToLat(v) {
    return this.curve.denorm(1 - 2 * v, this.maxLat);
  }

  latLonToUv(lat, lon) {
    return { u: (lon + Math.PI) / (2 * Math.PI), v: this.latToV(lat) };
  }

  uvToLatLon(u, v) {
    return { lat: this.vToLat(v), lon: u * 2 * Math.PI - Math.PI };
  }

  spherePointToLatLon(point) {
    const r = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z) || 1;
    return { lat: Math.asin(point.y / r), lon: Math.atan2(point.x, point.z) };
  }

  latLonToSpherePoint(lat, lon, radius = 1) {
    return {
      x: radius * Math.cos(lat) * Math.sin(lon),
      y: radius * Math.sin(lat),
      z: radius * Math.cos(lat) * Math.cos(lon)
    };
  }

  isLatitudeOnBody(lat) {
    return Math.abs(lat) <= this.maxLat;
  }
}
