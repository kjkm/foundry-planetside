export const MINIMAP_DEFAULTS = Object.freeze({
  minimapEnabled: false,
  minimapImage: "",
  minimapCorner: "br"
});

export const MINIMAP_CORNER_OPTIONS = Object.freeze({
  "tl": "Top-Left",
  "tr": "Top-Right",
  "bl": "Bottom-Left",
  "br": "Bottom-Right"
});

// Default on-screen width of the minimap panel (px); height is derived from the
// scene aspect ratio. Anchored in a chosen corner of the canvas region.
const MINIMAP_WIDTH = 280;
const CORNER_INSET = 16;

// Extra per-corner inset (px, added to CORNER_INSET on the named edges) so the
// panel clears Foundry's core UI in that corner: tl/tr the scene navigation bar,
// tl/bl the left tool controls column, bl the players list, br the hotbar. Tuned
// by eye against the default v12/v13 layout — adjust here if your UI differs.
const CORNER_EXTRA_INSET = {
  tl: { top: 40, left: 82 },
  tr: { top: -8, right: 40 },
  bl: { bottom: 70, left: 0 },
  br: { bottom: 56, right: 36 }
};

export function readMinimapFlags(scene) {
  const flags = scene?.flags?.planetside ?? {};
  const corner = MINIMAP_CORNER_OPTIONS[flags.minimapCorner] ? flags.minimapCorner : MINIMAP_DEFAULTS.minimapCorner;
  return {
    minimapEnabled: Boolean(flags.minimapEnabled ?? MINIMAP_DEFAULTS.minimapEnabled),
    minimapImage: flags.minimapImage ?? MINIMAP_DEFAULTS.minimapImage,
    minimapCorner: corner
  };
}

// A flat minimap panel rendered over the globe while Planetside is active. Shows
// the map image (the custom minimap image, or the scene background as a fallback)
// stretched to the scene's aspect ratio, with a crosshair reticle — a centre box
// plus full-span horizontal/vertical lines — tracking the orbit camera's
// view-center. Modeled on TitleOverlay: controller-owned, install/update/destroy,
// hot-reloaded from scene flags. Pure DOM/CSS, no input wired.
export class MinimapOverlay {
  constructor({ projection, hostElement }) {
    this.projection = projection;
    this.host = hostElement;
    this.container = null;
    this.box = null;
    this.hLine = null;
    this.vLine = null;
    this._appliedSrc = null;     // last background image applied (change-detected)
    this._appliedLayout = null;  // last size/position string (change-detected)
  }

  install() {
    this.container = document.createElement("div");
    this.container.id = "planetside-minimap";
    Object.assign(this.container.style, {
      position: "fixed",
      zIndex: "12",
      pointerEvents: "none",
      display: "none",
      backgroundSize: "100% 100%",   // stretch/compress the image to fill the box
      backgroundRepeat: "no-repeat"
    });

    this.hLine = document.createElement("div");
    this.hLine.className = "planetside-minimap-hline";

    this.vLine = document.createElement("div");
    this.vLine.className = "planetside-minimap-vline";

    this.box = document.createElement("div");
    this.box.className = "planetside-minimap-box";

    this.container.appendChild(this.hLine);
    this.container.appendChild(this.vLine);
    this.container.appendChild(this.box);
    this.host.appendChild(this.container);
  }

  // Called each frame by the controller. `enabled`/`imageSrc` come from the scene
  // flags; `azimuth`/`elevation` are the orbit camera's current orientation (which
  // ARE the view-center's lon/lat — see planetside.js#sceneToCameraTarget).
  update({ enabled, imageSrc, corner, azimuth, elevation }) {
    if (!this.container) return;

    // Resolve the image: custom minimap image, else the scene background. With
    // neither there is nothing to show.
    const src = imageSrc || canvas.scene?.background?.src || "";
    if (!enabled || !src) {
      this.container.style.display = "none";
      return;
    }
    this.container.style.display = "";

    if (src !== this._appliedSrc) {
      this.container.style.backgroundImage = `url("${src}")`;
      this._appliedSrc = src;
    }

    this._applyLayout(corner);

    // Reticle position from the camera↔lat/lon correspondence. Longitude (u) is
    // linear and exact; latitude (v) uses the globe's projection so it agrees with
    // the body. Azimuth is unbounded (it wraps), so wrap u into [0, 1].
    const uv = this.projection.latLonToUv(elevation, azimuth);
    const u = ((uv.u % 1) + 1) % 1;
    const v = Math.max(0, Math.min(1, uv.v));
    const uPct = `${u * 100}%`;
    const vPct = `${v * 100}%`;
    this.vLine.style.left = uPct;
    this.hLine.style.top = vPct;
    this.box.style.left = uPct;
    this.box.style.top = vPct;
  }

  // Size the panel to the scene's aspect ratio and anchor it in the chosen corner
  // of the canvas region (relative to the #board rect, so the sidebar is avoided).
  // Change-detected so the per-frame call only writes to the DOM when it moves.
  _applyLayout(corner = MINIMAP_DEFAULTS.minimapCorner) {
    const dims = canvas.dimensions;
    const sceneW = dims?.sceneWidth || 2048;
    const sceneH = dims?.sceneHeight || 1024;
    const width = MINIMAP_WIDTH;
    const height = Math.round(width * (sceneH / sceneW));

    const board = document.getElementById("board");
    const rect = board?.getBoundingClientRect();
    const baseTop = rect ? rect.top : 0;
    const baseLeft = rect ? rect.left : 0;
    const baseRight = rect ? window.innerWidth - rect.right : 0;
    const baseBottom = rect ? window.innerHeight - rect.bottom : 0;

    // Add the base inset plus this corner's UI-clearance extra to each edge.
    const ext = CORNER_EXTRA_INSET[corner] || CORNER_EXTRA_INSET.br;
    const top = Math.round(baseTop + CORNER_INSET + (ext.top || 0));
    const left = Math.round(baseLeft + CORNER_INSET + (ext.left || 0));
    const right = Math.round(baseRight + CORNER_INSET + (ext.right || 0));
    const bottom = Math.round(baseBottom + CORNER_INSET + (ext.bottom || 0));

    // Anchor by the two relevant edges per corner; the others go "auto".
    const pos = {
      tl: { top: `${top}px`, left: `${left}px`, right: "auto", bottom: "auto" },
      tr: { top: `${top}px`, right: `${right}px`, left: "auto", bottom: "auto" },
      bl: { bottom: `${bottom}px`, left: `${left}px`, right: "auto", top: "auto" },
      br: { bottom: `${bottom}px`, right: `${right}px`, left: "auto", top: "auto" }
    }[corner] || null;
    const place = pos || { bottom: `${bottom}px`, right: `${right}px`, left: "auto", top: "auto" };

    const key = `${width}x${height}@${corner}:${top},${left},${right},${bottom}`;
    if (key === this._appliedLayout) return;
    this._appliedLayout = key;
    Object.assign(this.container.style, {
      width: `${width}px`,
      height: `${height}px`,
      ...place
    });
  }

  // Inverse mapping kept reachable for a future click-to-pull: a viewport point
  // inside the panel → scene lat/lon. No input is wired in v1.
  clientToLatLon(clientX, clientY) {
    if (!this.container) return null;
    const rect = this.container.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const u = (clientX - rect.left) / rect.width;
    const v = (clientY - rect.top) / rect.height;
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;
    return this.projection.uvToLatLon(u, v);
  }

  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.box = null;
    this.hLine = null;
    this.vLine = null;
    this._appliedSrc = null;
    this._appliedLayout = null;
  }
}
