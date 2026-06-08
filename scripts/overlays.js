const OVERLAY_SELECTORS = [
  "#hud",
  "#chat-bubbles",
  "#tooltip",
  "#context-menu",
  "#measurement"
];

const PING_DURATION_MS = 2000; // fallback if CONFIG.Canvas.pings.duration is unset

export class OverlayReanchor {
  constructor({ scene3d, mercator, hostElement }) {
    this.scene3d = scene3d;
    this.mercator = mercator;
    this.host = hostElement;
    this._originalStyles = new Map();
    this._pings = [];           // active globe ping markers
    this._controls = null;      // ControlsLayer whose drawPing we wrapped
    this._origDrawPing = null;  // original drawPing to restore
  }

  install() {
    for (const selector of OVERLAY_SELECTORS) {
      const el = document.querySelector(selector);
      if (!el) continue;
      this._originalStyles.set(el, {
        position: el.style.position,
        left: el.style.left,
        top: el.style.top,
        display: el.style.display,
        transform: el.style.transform
      });
    }
    this._wrapDrawPing();
  }

  uninstall() {
    for (const [el, original] of this._originalStyles.entries()) {
      el.style.position = original.position;
      el.style.left = original.left;
      el.style.top = original.top;
      el.style.display = original.display;
      el.style.transform = original.transform;
    }
    this._originalStyles.clear();

    if (this._controls && this._origDrawPing) this._controls.drawPing = this._origDrawPing;
    this._controls = null;
    this._origDrawPing = null;
    for (const p of this._pings) p.el.parentNode?.removeChild(p.el);
    this._pings = [];
  }

  // Render Foundry pings on the globe. Wrap the per-client ping render point
  // (ControlsLayer#drawPing) so we see every ping (local and broadcast); call the
  // original through so the flat-canvas ping is unaffected. canvas.controls can be
  // rebuilt on a redraw, so this is (re)applied on each install and restored on
  // uninstall.
  _wrapDrawPing() {
    const controls = canvas.controls;
    if (!controls || typeof controls.drawPing !== "function") return;
    if (controls.drawPing._planetsidePatched) return;

    const orig = controls.drawPing;
    const self = this;
    const wrapped = function (position, options = {}) {
      try {
        self.spawnPing(position?.x, position?.y, options);
      } catch (err) {
        console.warn("[planetside] ping render failed", err);
      }
      return orig.call(this, position, options);
    };
    wrapped._planetsidePatched = true;
    this._controls = controls;
    this._origDrawPing = orig;
    controls.drawPing = wrapped;
  }

  // Create a transient marker for a ping at a scene coordinate. It is positioned
  // (and far-side-hidden) each frame by update() via the shared _reanchorElement,
  // and removed automatically when it expires.
  spawnPing(sceneX, sceneY, options = {}) {
    if (!this.host || sceneX == null || sceneY == null) return;
    const c = options?.user?.color;
    const color = (c && (c.css ?? c.toString())) || "#ff6400";
    const el = document.createElement("div");
    el.className = "planetside-ping";
    el.style.setProperty("--ping-color", color);
    el.style.display = "none"; // placed on the next update()
    this.host.appendChild(el);
    const duration = CONFIG?.Canvas?.pings?.duration ?? PING_DURATION_MS;
    this._pings.push({ el, sceneX, sceneY, expiresAt: performance.now() + duration });
  }

  _updatePings() {
    if (this._pings.length === 0) return;
    const now = performance.now();
    for (let i = this._pings.length - 1; i >= 0; i--) {
      const p = this._pings[i];
      if (now >= p.expiresAt) {
        p.el.parentNode?.removeChild(p.el);
        this._pings.splice(i, 1);
        continue;
      }
      this._reanchorElement(p.el, { x: p.sceneX, y: p.sceneY });
    }
  }

  sceneToScreen(sceneX, sceneY) {
    const dims = canvas.dimensions;
    const u = (sceneX - dims.sceneX) / dims.sceneWidth;
    const v = (sceneY - dims.sceneY) / dims.sceneHeight;
    const { lat, lon } = this.mercator.uvToLatLon(u, v);
    if (!this.mercator.isLatitudeOnBody(lat)) return null;

    const world = this.mercator.latLonToSpherePoint(lat, lon, 1);
    if (!this.scene3d.isFacingCamera(world)) return null;
    return this.scene3d.projectWorldToScreen(world);
  }

  // The Token HUD is bound via canvas.hud.token (right-click on a globe token).
  // Foundry positions the inner #token-hud element at the token's FLAT-canvas
  // coordinates; we override that to the token's projected position on the globe.
  // We reanchor the inner element directly (not the #hud container) so the two
  // offsets don't compound. When the bound token rotates to the far hemisphere,
  // _reanchorElement hides it.
  _reanchorTokenHud() {
    const tokenHud = canvas.hud?.token;
    if (!tokenHud?.rendered || !tokenHud.object) return;
    const el = tokenHud.element?.[0] ?? document.querySelector("#token-hud");
    if (!el) return;
    const tok = tokenHud.object;
    this._reanchorElement(el, { x: tok.center.x, y: tok.center.y });
  }

  _reanchorElement(el, sceneAnchor) {
    if (!el) return;
    const screen = this.sceneToScreen(sceneAnchor.x, sceneAnchor.y);
    if (!screen) {
      el.style.display = "none";
      return;
    }
    el.style.display = "";
    el.style.position = "absolute";
    el.style.left = `${screen.x}px`;
    el.style.top = `${screen.y}px`;
    el.style.transform = "translate(-50%, -50%)";
  }

  update() {
    this._reanchorTokenHud();

    const bubbles = document.querySelectorAll("#chat-bubbles .bubble");
    for (const bubble of bubbles) {
      const tokenId = bubble.dataset?.tokenId;
      if (!tokenId) continue;
      const tok = canvas.tokens?.get(tokenId);
      if (!tok) continue;
      this._reanchorElement(bubble, { x: tok.center.x, y: tok.center.y });
    }

    const tooltip = document.querySelector("#tooltip");
    if (tooltip?.dataset?.anchorX !== undefined && tooltip?.dataset?.anchorY !== undefined) {
      this._reanchorElement(tooltip, {
        x: parseFloat(tooltip.dataset.anchorX),
        y: parseFloat(tooltip.dataset.anchorY)
      });
    }

    this._updatePings();
  }
}
