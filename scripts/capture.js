import * as THREE from "./vendor/three.module.js";

export class Capture {
  constructor() {
    this.renderTexture = null;
    this.dataTexture = null;
    this.pixelBuffer = null;
    this.width = 0;
    this.height = 0;
    this.dirty = true;
    this._hookIds = [];
  }

  init() {
    const dims = canvas.dimensions;
    this.width = dims.sceneWidth;
    this.height = dims.sceneHeight;
    this.offsetX = dims.sceneX;
    this.offsetY = dims.sceneY;

    this.renderTexture = PIXI.RenderTexture.create({
      width: this.width,
      height: this.height,
      resolution: 1
    });

    this.pixelBuffer = new Uint8Array(this.width * this.height * 4);
    this.dataTexture = new THREE.DataTexture(
      this.pixelBuffer,
      this.width,
      this.height,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    this.dataTexture.wrapS = THREE.RepeatWrapping;
    this.dataTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.dataTexture.minFilter = THREE.LinearFilter;
    this.dataTexture.magFilter = THREE.LinearFilter;
    this.dataTexture.flipY = true;
    this.dataTexture.needsUpdate = true;

    this._registerDirtyHooks();
  }

  _registerDirtyHooks() {
    const markDirty = () => { this.dirty = true; };
    const hookNames = [
      "updateToken", "createToken", "deleteToken",
      "updateWall", "createWall", "deleteWall",
      "updateAmbientLight", "createAmbientLight", "deleteAmbientLight",
      "updateTile", "createTile", "deleteTile",
      "updateDrawing", "createDrawing", "deleteDrawing",
      "updateMeasuredTemplate", "createMeasuredTemplate", "deleteMeasuredTemplate",
      "sightRefresh", "lightingRefresh", "canvasPan"
    ];
    for (const name of hookNames) {
      const id = Hooks.on(name, markDirty);
      this._hookIds.push([name, id]);
    }
  }

  update() {
    if (!this.dirty || !this.renderTexture) return false;

    const stage = canvas.stage;
    const savedX = stage.position.x;
    const savedY = stage.position.y;
    const savedSx = stage.scale.x;
    const savedSy = stage.scale.y;

    stage.position.set(-this.offsetX, -this.offsetY);
    stage.scale.set(1, 1);

    try {
      canvas.app.renderer.render(stage, { renderTexture: this.renderTexture, clear: true });
      const pixels = canvas.app.renderer.extract.pixels(this.renderTexture);
      this.pixelBuffer.set(pixels);
      this.dataTexture.needsUpdate = true;
    } finally {
      stage.position.set(savedX, savedY);
      stage.scale.set(savedSx, savedSy);
    }

    this.dirty = false;
    return true;
  }

  forceDirty() {
    this.dirty = true;
  }

  getTexture() {
    return this.dataTexture;
  }

  getDimensions() {
    return { width: this.width, height: this.height };
  }

  destroy() {
    for (const [name, id] of this._hookIds) Hooks.off(name, id);
    this._hookIds = [];
    if (this.renderTexture) { this.renderTexture.destroy(true); this.renderTexture = null; }
    if (this.dataTexture) { this.dataTexture.dispose(); this.dataTexture = null; }
    this.pixelBuffer = null;
  }
}
