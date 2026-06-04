import { Mercator } from "./mercator.js";
import { Scene } from "./scene.js";
import { OrbitCamera } from "./camera.js";
import { InputForwarder } from "./input.js";
import { OverlayReanchor } from "./overlays.js";
import { TitleOverlay, readTitleFlags } from "./title.js";
import { TokenLayer } from "./tokens.js";
import { TileLayer } from "./tiles.js";

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
      mercator: this.mercator
    });
    this.overlays.install();

    this.titleOverlay = new TitleOverlay({ hostElement: this.host });
    this.titleOverlay.install();
    this.titleOverlay.update(readTitleFlags(canvas.scene));

    this.tokenLayer.install();
    this.tileLayer.install();

    this._tickerCb = () => this._frame();
    canvas.app.ticker.add(this._tickerCb);

    this.active = true;
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
    this.tokenLayer?.update();
    this.tileLayer?.update();
    this.scene3d.render();
    this.overlays.update();
  }
}
