import { Mercator } from "./mercator.js";
import { Scene } from "./scene.js";
import { OrbitCamera } from "./camera.js";
import { InputForwarder } from "./input.js";
import { OverlayReanchor } from "./overlays.js";
import { TitleOverlay, readTitleFlags } from "./title.js";
import { TokenLayer } from "./tokens.js";
import { TileLayer } from "./tiles.js";

// Cinematic opening (establishing shot) before settling on the default view.
// The spin reads side-on: the intro starts at the equator (elevation 0) and
// sweeps azimuth, so it looks like the globe turning about its vertical axis.
// The tilt up to the destination latitude is LAGGED (ease-in) so it happens last
// — the camera "arrives" at the end rather than viewing the spin from a steep
// angle the whole time.
const INTRO_RADIUS = 11;             // start zoomed out (camera clamps to its max)
const INTRO_AZ_OFFSET = 1.6;         // rad — lateral spin into the target
const INTRO_ELEV_EASE_POWER = 3;     // elevation lag: higher = tilts up later
const INTRO_DURATION_MS = 4400;      // slow ease-in

export class Planetside {
  constructor() {
    this.active = false;
    this.host = null;
    this.mercator = null;
    this.scene3d = null;
    this.orbit = null;
    this.input = null;
    this.overlays = null;
    this.titleOverlay = null;
    this.tokenLayer = null;
    this.tileLayer = null;
    this._tickerCb = null;
    this._dirty = true;               // render-on-demand gate (D1)
    this._foundryRenderRemoved = false; // Foundry 2D render suspended? (D3)
  }

  // Mark the globe as needing a re-render this frame. Called by every motion
  // source (camera apply, placeable capture, resize); _frame() renders only when
  // set, then clears it. Pings are NOT a dirty source — their tracking rides on
  // the camera source and their pulse is compositor-driven (see overlays).
  markDirty() {
    this._dirty = true;
  }

  activate() {
    if (this.active) return;
    this.host = document.querySelector("#board")?.parentNode;
    if (!this.host) {
      console.error("[planetside] could not find canvas host element");
      return;
    }
    const imageSrc = canvas.scene?.background?.src;
    if (!imageSrc) {
      console.error("[planetside] scene has no background image");
      return;
    }
    document.body.classList.add("planetside-active");

    const markDirty = () => this.markDirty();

    this.mercator = new Mercator({ maxLatitudeDeg: 85 });

    this.scene3d = new Scene({
      mercator: this.mercator,
      imageSrc,
      hostElement: this.host,
      markDirty
    });
    this.scene3d.init();

    this.orbit = new OrbitCamera({
      camera: this.scene3d.camera,
      domElement: this.scene3d.canvas,
      markDirty
    });

    this.tokenLayer = new TokenLayer({
      scene3d: this.scene3d,
      mercator: this.mercator,
      hostElement: this.host,
      markDirty
    });

    this.tileLayer = new TileLayer({
      scene3d: this.scene3d,
      mercator: this.mercator,
      hostElement: this.host,
      markDirty
    });

    this.input = new InputForwarder({
      scene3d: this.scene3d,
      mercator: this.mercator,
      orbitCamera: this.orbit,
      tokenLayer: this.tokenLayer
    });

    this.input.install();
    this.orbit.install();

    // OverlayReanchor is intentionally NOT given markDirty: it only repositions
    // DOM overlays (HUD, bubbles, pings), which it does every frame regardless of
    // the render gate, projecting with the current camera matrices. Ping pulses
    // run on the compositor, so the globe stays idle while a ping is active.
    this.overlays = new OverlayReanchor({
      scene3d: this.scene3d,
      mercator: this.mercator,
      hostElement: this.host
    });
    this.overlays.install();

    this.titleOverlay = new TitleOverlay({ hostElement: this.host });
    this.titleOverlay.install();
    this.titleOverlay.update(readTitleFlags(canvas.scene));

    this.tokenLayer.install();
    this.tileLayer.install();

    // Cinematic opening: snap to a wide pose at the equator (side-on) offset
    // laterally from the target, then spin around the vertical axis + zoom IN to
    // settle on the scene's default view (or scene centre). Elevation lags
    // (elevEasePower) so the camera tilts up to the destination latitude only at
    // the end — the spin stays side-on until it arrives.
    const target = this._defaultViewTarget();
    this.orbit.focus(
      { azimuth: target.azimuth + INTRO_AZ_OFFSET, elevation: 0, radius: INTRO_RADIUS },
      { animate: false }
    );
    this.orbit.focus(target, {
      animate: true,
      duration: INTRO_DURATION_MS,
      elevEasePower: INTRO_ELEV_EASE_POWER
    });

    this._dirty = true; // force the first frame to render
    this._tickerCb = () => this._frame();
    canvas.app.ticker.add(this._tickerCb);

    // Stop Foundry painting its (now hidden) 2D canvas every tick (D3).
    this._suspendFoundryRender();

    this.active = true;
  }

  // Remove ONLY Foundry's per-frame 2D render from the shared ticker, leaving the
  // ticker running so animation logic, timers, and hooks (incl. refreshToken)
  // still fire. PIXI's Application registers `app.render` on the ticker at
  // UPDATE_PRIORITY.LOW; removing that callback is the surgical, reversible lever.
  // (Candidate mechanism — confirmed by smoke test; fallback is ticker.maxFPS.)
  _suspendFoundryRender() {
    const app = canvas?.app;
    if (!app?.ticker || this._foundryRenderRemoved) return;
    try {
      app.ticker.remove(app.render, app);
      this._foundryRenderRemoved = true;
    } catch (err) {
      console.warn("[planetside] could not suspend Foundry render", err);
    }
  }

  _restoreFoundryRender() {
    const app = canvas?.app;
    if (!app?.ticker || !this._foundryRenderRemoved) return;
    try {
      app.ticker.add(app.render, app, PIXI.UPDATE_PRIORITY.LOW);
      app.render(); // paint once so the flat canvas is correct before it is shown
    } catch (err) {
      console.warn("[planetside] could not restore Foundry render", err);
    }
    this._foundryRenderRemoved = false;
  }

  // Map the scene's default view (scene.initial = { x, y, scale }) to a camera
  // target. Position is exact (azimuth = lon, elevation = lat — the orbit camera
  // shares the Mercator sphere-point parameterization); zoom is a heuristic. When
  // x/y are null (no default view set — the common case) we centre on the scene.
  _defaultViewTarget() {
    const init = canvas.scene?.initial ?? {};
    const dims = canvas.dimensions;
    let azimuth = 0;
    let elevation = 0;
    if (init.x != null && init.y != null && dims) {
      const u = (init.x - dims.sceneX) / dims.sceneWidth;
      const v = (init.y - dims.sceneY) / dims.sceneHeight;
      const { lat, lon } = this.mercator.uvToLatLon(u, v);
      azimuth = lon;
      elevation = lat;
    }
    return { azimuth, elevation, radius: this._scaleToRadius(init.scale ?? 1) };
  }

  // Heuristic: Foundry view `scale` (canvas px per scene px) → orbit radius. The
  // flat view shows `viewportWidth/scale` scene-px; as a fraction of the scene
  // width that's a longitude arc, which we fit to the camera's horizontal FOV.
  // Tunable; the camera clamps the result to its radius bounds.
  _scaleToRadius(scale) {
    const dims = canvas.dimensions;
    const sceneWidth = dims?.sceneWidth || 2048;
    const cam = this.scene3d.camera;
    const viewportW = this.scene3d.canvas?.clientWidth || window.innerWidth || sceneWidth;
    const s = scale > 0 ? scale : 1;
    const visibleFraction = viewportW / (s * sceneWidth);
    const vFov = ((cam?.fov ?? 50) * Math.PI) / 180;
    const aspect = cam?.aspect || (viewportW / (this.scene3d.canvas?.clientHeight || viewportW));
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    return 1 + (visibleFraction * 2 * Math.PI) / hFov;
  }

  refreshTitle() {
    if (!this.active || !this.titleOverlay) return;
    this.titleOverlay.update(readTitleFlags(canvas.scene));
  }

  deactivate() {
    if (!this.active) return;
    if (this._tickerCb) {
      canvas.app.ticker.remove(this._tickerCb);
      this._tickerCb = null;
    }
    // Restore Foundry's 2D render (and paint one frame) before #board is unhidden.
    this._restoreFoundryRender();
    this.tokenLayer?.destroy();
    this.tileLayer?.destroy();
    this.titleOverlay?.destroy();
    this.overlays?.uninstall();
    this.input?.uninstall();
    this.orbit?.uninstall();
    this.scene3d?.destroy();
    document.body.classList.remove("planetside-active");

    this.scene3d = null;
    this.orbit = null;
    this.input = null;
    this.overlays = null;
    this.titleOverlay = null;
    this.tokenLayer = null;
    this.tileLayer = null;
    this.mercator = null;
    this.host = null;
    this.active = false;
  }

  _frame() {
    if (!this.active) return;
    // Run every frame so dirty sources are detected (camera tween step, a landed
    // capture, etc.); these set _dirty when something actually changed.
    this.orbit?.tick();
    this.tokenLayer?.update();
    this.tileLayer?.update();
    // Render only on dirty frames. Render BEFORE overlays so DOM reanchoring uses
    // the camera matrices updated by this render; when idle we skip the WebGL
    // passes entirely and the camera matrices are still current (it didn't move).
    if (this._dirty) {
      this.scene3d.render();
      this._dirty = false;
    }
    this.overlays.update();
  }
}
