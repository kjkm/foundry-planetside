import { PlaceableLayer } from "./placeables.js";

// Just outside the body sphere (1.0) but below tokens (1.001), and drawn before
// tokens, so background tiles sit under tokens on the globe.
const TILE_RADIUS = 1.0006;

export class TileLayer extends PlaceableLayer {
  _collection() { return canvas.tiles?.placeables ?? []; }
  _radius() { return TILE_RADIUS; }
  _renderOrder() { return 0; } // draw before tokens (renderOrder 1)

  // Tile width/height are in scene pixels (unlike tokens, which are grid units).
  _centerScene(p) {
    const doc = p.document ?? p;
    return {
      x: (doc.x ?? 0) + (doc.width ?? 0) / 2,
      y: (doc.y ?? 0) + (doc.height ?? 0) / 2
    };
  }

  // Tile width/height are already in scene pixels.
  _footprintScene(p) {
    const doc = p.document ?? p;
    return { w: doc.width ?? 0, h: doc.height ?? 0 };
  }

  // Tiles render image-only on the globe: no decorations, nothing to hide during
  // capture (base defaults to []). No DOM nameplate.

  // ---- public API (used by main.js hooks) ----
  addTile(tile) { this._add(tile); }
  updateTile(tile, _changes) { this._refresh(tile); }
  removeTile(tile) { this._remove(tile); }
}
