import * as THREE from "./vendor/three.module.js";

const POLE_EPSILON = 0.01;
const MAX_ELEV = Math.PI / 2 - POLE_EPSILON;

const MIN_RADIUS = 1.2;
const MAX_RADIUS = 8;
const DEFAULT_RADIUS = 2.5;

const DRAG_AZ_SPEED = 0.005;
const DRAG_EL_SPEED = 0.005;
const ZOOM_SPEED = 0.0015;

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
}
