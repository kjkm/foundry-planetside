import { PlaceableLayer } from "./placeables.js";

const TOKEN_RADIUS = 1.001;
const NAMEPLATE_OFFSET_PX = 18;

const NAMEPLATE_BASE_STYLES = {
  position: "fixed",
  zIndex: "5",
  pointerEvents: "none",
  color: "#ffffff",
  textShadow: "0 0 6px rgba(0,0,0,0.85), 0 1px 1px rgba(0,0,0,0.7)",
  fontFamily: "Signika, sans-serif",
  fontSize: "12px",
  fontWeight: "500",
  whiteSpace: "nowrap",
  transform: "translate(-50%, 0)",
  display: "none"
};

export class TokenLayer extends PlaceableLayer {
  // ---- placeable specifics ----
  _collection() { return canvas.tokens?.placeables ?? []; }
  _radius() { return TOKEN_RADIUS; }

  _centerScene(p) {
    const doc = p.document ?? p;
    const dims = canvas.dimensions;
    const gridSize = dims?.size ?? 100;
    return {
      x: (doc.x ?? 0) + ((doc.width ?? 1) * gridSize) / 2,
      y: (doc.y ?? 0) + ((doc.height ?? 1) * gridSize) / 2
    };
  }

  // Token width/height are in grid units → scene pixels via the grid size.
  _footprintScene(p) {
    const doc = p.document ?? p;
    const gridSize = canvas.dimensions?.size ?? 100;
    return { w: (doc.width ?? 1) * gridSize, h: (doc.height ?? 1) * gridSize };
  }

  // The token decorations we mirror, back-to-front. Rendered individually (never
  // the whole Token container, which holds occlusion children that punch a hole).
  _decorationObjects(p) { return [p.border, p.bars, p.effects, p.target]; }

  // Foundry's own nameplate would bake into the texture and duplicate the
  // billboarded DOM nameplate; exclude it from the capture.
  _hiddenDuringCapture(p) { return [p.nameplate]; }

  // ---- nameplate (DOM) extras ----
  _onEntryAdded(entry) {
    entry.token = entry.placeable; // alias used by input.js raycast/lookup
    const doc = entry.placeable.document ?? entry.placeable;
    const nameplate = document.createElement("div");
    nameplate.className = "planetside-nameplate";
    Object.assign(nameplate.style, NAMEPLATE_BASE_STYLES);
    nameplate.textContent = doc.name ?? "";
    this.host.appendChild(nameplate);
    entry.nameplate = nameplate;
  }

  _onEntryUpdated(entry) {
    entry.token = entry.placeable;
    const doc = entry.placeable.document ?? entry.placeable;
    if (entry.nameplate) entry.nameplate.textContent = doc.name ?? "";
  }

  _onEntryRemoved(entry) {
    if (entry.nameplate?.parentNode) entry.nameplate.parentNode.removeChild(entry.nameplate);
  }

  _hideExtras(entry) {
    if (entry.nameplate) entry.nameplate.style.display = "none";
  }

  _showExtras(entry, { P, canvasRect }) {
    const doc = entry.placeable.document ?? entry.placeable;
    const displayMode = doc.displayName ?? 0;
    if (displayMode === 0) {
      this._hideExtras(entry);
      return;
    }
    const screen = this.scene3d.projectWorldToScreen(P);
    entry.nameplate.style.left = `${canvasRect.left + screen.x}px`;
    entry.nameplate.style.top = `${canvasRect.top + screen.y + NAMEPLATE_OFFSET_PX}px`;
    entry.nameplate.style.display = "block";
  }

  // ---- public API (used by main.js hooks) ----
  addToken(token) { this._add(token); }
  updateToken(token, _changes) { this._refresh(token); }
  removeToken(token) { this._remove(token); }
}
