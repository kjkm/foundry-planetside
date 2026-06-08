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

    this.mercator = new Mercator({ maxLatitudeDeg: 85 });

    this.scene3d = new Scene({
      mercator: this.mercator,
      imageSrc,
      hostElement: this.host
    });
    this.scene3d.init();

    this.orbit = new OrbitCamera({
      camera: this.scene3d.camera,
      domElement: this.scene3d.canvas
    });

    this.tokenLayer = new TokenLayer({
      scene3d: this.scene3d,
      mercator: this.mercator,
      hostElement: this.host
    });

    this.tileLayer = new TileLayer({
      scene3d: this.scene3d,
      mercator: this.mercator,
      hostElement: this.host
    });

    this.input = new InputForwarder({
      scene3d: this.scene3d,
      mercator: this.mercator,
      orbitCamera: this.orbit,
      tokenLayer: this.tokenLayer
    });

    this.input.install();
    this.orbit.install();

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

    this._tickerCb = () => this._frame();
    canvas.app.ticker.add(this._tickerCb);

    this.active = true;
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
    this.orbit?.tick();
    this.tokenLayer?.update();
    this.tileLayer?.update();
    this.scene3d.render();
    this.overlays.update();
  }
}
