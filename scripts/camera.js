import * as THREE from "./vendor/three.module.js";

const POLE_EPSILON = 0.01;
const MAX_ELEV = Math.PI / 2 - POLE_EPSILON;

const MIN_RADIUS = 1.2;
const MAX_RADIUS = 12;
const DEFAULT_RADIUS = 2.5;

const DRAG_AZ_SPEED = 0.005;
const DRAG_EL_SPEED = 0.005;
const ZOOM_SPEED = 0.0015;

const FOCUS_DURATION_MS = 800;
// Ease-out exponent: velocity is highest at the start and decays over a long
// tail, so motion slows down early and settles to a gentle standstill (higher =
// longer, gentler tail). 1 = linear, 3 = cubic, 5 = quintic.
const FOCUS_EASE_POWER = 5;

export class OrbitCamera {
  constructor({ camera, domElement }) {
    this.camera = camera;
    this.dom = domElement;

    this.azimuth = 0;
    this.elevation = 0;
    this.radius = DEFAULT_RADIUS;

    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;
    this._focus = null; // in-progress focus tween, or null
  }

  install() {
    this._apply();
    this.dom.addEventListener("pointerdown", this._onPointerDown);
    this.dom.addEventListener("pointermove", this._onPointerMove);
    this.dom.addEventListener("pointerup", this._onPointerUp);
    this.dom.addEventListener("pointercancel", this._onPointerUp);
    this.dom.addEventListener("wheel", this._onWheel, { passive: false });
  }

  uninstall() {
    this.dom.removeEventListener("pointerdown", this._onPointerDown);
    this.dom.removeEventListener("pointermove", this._onPointerMove);
    this.dom.removeEventListener("pointerup", this._onPointerUp);
    this.dom.removeEventListener("pointercancel", this._onPointerUp);
    this.dom.removeEventListener("wheel", this._onWheel);
  }

  _apply() {
    const x = this.radius * Math.cos(this.elevation) * Math.sin(this.azimuth);
    const y = this.radius * Math.sin(this.elevation);
    const z = this.radius * Math.cos(this.elevation) * Math.cos(this.azimuth);
    this.camera.position.set(x, y, z);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
  }

  _onPointerDown = (e) => {
    if (e.button !== 2) return;
    this._focus = null; // manual orbit always wins — cancel any in-progress focus
    this._dragging = true;
    this._lastX = e.clientX;
    this._lastY = e.clientY;
    this.dom.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  _onPointerMove = (e) => {
    if (!this._dragging) return;
    const dx = e.clientX - this._lastX;
    const dy = e.clientY - this._lastY;
    this._lastX = e.clientX;
    this._lastY = e.clientY;
    this.azimuth -= dx * DRAG_AZ_SPEED;
    this.elevation = Math.max(-MAX_ELEV, Math.min(MAX_ELEV, this.elevation + dy * DRAG_EL_SPEED));
    this._apply();
  };

  _onPointerUp = (e) => {
    if (!this._dragging) return;
    this._dragging = false;
    try { this.dom.releasePointerCapture(e.pointerId); } catch (_) {}
  };

  _onWheel = (e) => {
    e.preventDefault();
    this.radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, this.radius * (1 + e.deltaY * ZOOM_SPEED)));
    this._apply();
  };

  isDragging() {
    return this._dragging;
  }

  // Move the camera to a target orientation. `target` is { azimuth, elevation,
  // radius } (any omitted field holds its current value). Source-agnostic: the
  // default-view consumer and future camera-sync (GM ping-pan) both call this.
  // With animation, eases over `duration` ms; an in-progress focus is cancelled
  // when the user starts orbiting (see _onPointerDown).
  // `elevEasePower` (optional): when set, the elevation lags behind az/radius
  // using an ease-IN curve (t^power), so e.g. the opening can spin side-on first
  // and only tilt up to the destination latitude at the end. Omitted → elevation
  // shares the same ease-out as az/radius.
  focus(target = {}, { animate = true, duration = FOCUS_DURATION_MS, elevEasePower = 0 } = {}) {
    const az = target.azimuth ?? this.azimuth;
    const el = Math.max(-MAX_ELEV, Math.min(MAX_ELEV, target.elevation ?? this.elevation));
    const r = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, target.radius ?? this.radius));

    if (!animate || duration <= 0) {
      this._focus = null;
      this.azimuth = az;
      this.elevation = el;
      this.radius = r;
      this._apply();
      return;
    }

    // Interpolate azimuth along the shortest angular path (avoid spinning the
    // long way around the wrap).
    const dAz = Math.atan2(Math.sin(az - this.azimuth), Math.cos(az - this.azimuth));
    this._focus = {
      fromAz: this.azimuth, toAz: this.azimuth + dAz,
      fromEl: this.elevation, toEl: el,
      fromR: this.radius, toR: r,
      elevEasePower,
      start: performance.now(), duration
    };
  }

  // Advance an in-progress focus tween; call once per frame. No-op when idle.
  tick() {
    const f = this._focus;
    if (!f) return;
    const t = Math.min(1, (performance.now() - f.start) / f.duration);
    const s = 1 - Math.pow(1 - t, FOCUS_EASE_POWER); // ease-out: decelerate to a gentle stop
    // Elevation can lag (ease-in) so the camera tilts to the destination latitude
    // last — keeping the spin side-on until it arrives.
    const sEl = f.elevEasePower > 0 ? Math.pow(t, f.elevEasePower) : s;
    this.azimuth = f.fromAz + (f.toAz - f.fromAz) * s;
    this.elevation = f.fromEl + (f.toEl - f.fromEl) * sEl;
    this.radius = f.fromR + (f.toR - f.fromR) * s;
    this._apply();
    if (t >= 1) this._focus = null;
  }
}
