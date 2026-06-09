// Per-scene lighting/atmosphere settings. Defaults reproduce the current built-in
// look: sun azimuth 45° + elevation 12° matches SUN_DIRECTION (1, 0.3, 1); ambient
// 0.08 and sun intensity 1.0 are the previous constants; atmosphere #c8e0ff / ×1
// is the current halo. So a scene with no flags renders identically to before.
export const LIGHTING_DEFAULTS = Object.freeze({
  sunColor: "#ffffff",
  sunIntensity: 1.0,
  sunAzimuth: 45,     // degrees — reads as "time of day"; sweeps the terminator
  sunElevation: 12,   // degrees
  ambientIntensity: 0.08,
  atmosphereColor: "#c8e0ff",
  atmosphereIntensity: 1.0
});

export function readLightingFlags(scene) {
  const f = scene?.flags?.planetside ?? {};
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  return {
    sunColor: f.sunColor || LIGHTING_DEFAULTS.sunColor,
    sunIntensity: num(f.sunIntensity, LIGHTING_DEFAULTS.sunIntensity),
    sunAzimuth: num(f.sunAzimuth, LIGHTING_DEFAULTS.sunAzimuth),
    sunElevation: num(f.sunElevation, LIGHTING_DEFAULTS.sunElevation),
    ambientIntensity: num(f.ambientIntensity, LIGHTING_DEFAULTS.ambientIntensity),
    atmosphereColor: f.atmosphereColor || LIGHTING_DEFAULTS.atmosphereColor,
    atmosphereIntensity: num(f.atmosphereIntensity, LIGHTING_DEFAULTS.atmosphereIntensity)
  };
}
