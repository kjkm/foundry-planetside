const OVERLAY_SELECTORS = [
  "#hud",
  "#chat-bubbles",
  "#tooltip",
  "#context-menu",
  "#measurement"
];

export class OverlayReanchor {
  constructor({ scene3d, mercator }) {
    this.scene3d = scene3d;
    this.mercator = mercator;
    this._originalStyles = new Map();
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
  }
}
