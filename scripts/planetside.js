import { Projection, readProjectionFlags } from "./projection.js";
import { Heightfield, readTerrainFlags } from "./heightfield.js";
import { readLightingFlags } from "./lighting.js";
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

// Module socket channel for the GM pull (rotate every client's globe to a point).
const PULL_SOCKET = "module.planetside";

// Pull camera move: like the opening's settle but scaled for a repeated action —
// lag the elevation (lateral spin first, tilt last) over a medium eased duration.
const PULL_DURATION_MS = 1600;
const PULL_ELEV_EASE_POWER = 2; // >0 lags elevation (matches the opening's feel)

export class Planetside {
  constructor() {
    this.active = false;
    this.host = null;
    this.projection = null;
    this.heightfield = null;
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
    this._socketCb = null;            // GM-pull socket listener
    this._introTarget = null;         // deferred establishing-shot target
    this._introStarted = false;       // opening begun (on first reveal)?
    this._terrainBaked = false;       // terrain baked + swapped in this activation?
    this._capsColored = false;        // caps coloured from the image (no-heightmap path)?
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

    const projFlags = readProjectionFlags(canvas.scene);
    this.projection = new Projection({
      curve: projFlags.projection,
      latitudeSpanDeg: projFlags.latitudeSpan
    });

    this.heightfield = new Heightfield(readTerrainFlags(canvas.scene));

    this.scene3d = new Scene({
      projection: this.projection,
      imageSrc,
      hostElement: this.host,
      markDirty,
      heightfield: this.heightfield
    });
    this.scene3d.init();

    // Apply per-scene lighting/atmosphere (sun, ambient, atmosphere) — live, no
    // rebuild; defaults reproduce the built-in look.
    this.scene3d.applyLighting(readLightingFlags(canvas.scene));

    // Coordinate the load sequence: the colour texture reveals the flat globe and
    // starts the opening; terrain bakes in (once) when its inputs are ready and
    // swaps in. Both async loads funnel through _onGlobeAssetReady.
    this.scene3d._onColorReady = () => this._onGlobeAssetReady();
    this.heightfield.onReady = () => this._onGlobeAssetReady();

    this.orbit = new OrbitCamera({
      camera: this.scene3d.camera,
      domElement: this.scene3d.canvas,
      markDirty
    });

    this.tokenLayer = new TokenLayer({
      scene3d: this.scene3d,
      projection: this.projection,
      hostElement: this.host,
      markDirty,
      heightfield: this.heightfield
    });

    this.tileLayer = new TileLayer({
      scene3d: this.scene3d,
      projection: this.projection,
      hostElement: this.host,
      markDirty,
      heightfield: this.heightfield
    });

    this.input = new InputForwarder({
      scene3d: this.scene3d,
      projection: this.projection,
      orbitCamera: this.orbit,
      tokenLayer: this.tokenLayer,
      onGmPull: (x, y) => this.firePull(x, y)
    });

    this.input.install();
    this.orbit.install();

    // OverlayReanchor is intentionally NOT given markDirty: it only repositions
    // DOM overlays (HUD, bubbles, pings), which it does every frame regardless of
    // the render gate, projecting with the current camera matrices. Ping pulses
    // run on the compositor, so the globe stays idle while a ping is active.
    this.overlays = new OverlayReanchor({
      scene3d: this.scene3d,
      projection: this.projection,
      hostElement: this.host,
      heightfield: this.heightfield
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
    // Snap to the wide establishing pose now (a framed view, not a black void),
    // but DEFER the animated opening until the globe is first revealed (colour
    // texture ready). Starting it here would let its wall-clock tween advance
    // through the load freeze and snap to mid-animation. _maybeStartIntro() begins
    // it on reveal so it plays as one continuous eased move.
    const target = this._defaultViewTarget();
    this._introTarget = target;
    this._introStarted = false;
    this._terrainBaked = false;
    this._capsColored = false;
    this.orbit.focus(
      { azimuth: target.azimuth + INTRO_AZ_OFFSET, elevation: 0, radius: INTRO_RADIUS },
      { animate: false }
    );

    this._dirty = true; // force the first frame to render
    this._tickerCb = () => this._frame();
    canvas.app.ticker.add(this._tickerCb);

    // Stop Foundry painting its (now hidden) 2D canvas every tick (D3).
    this._suspendFoundryRender();

    // Listen for GM pulls from other clients (scoped to this scene) and focus.
    this._socketCb = (data) => {
      if (data?.t === "pull" && data.sceneId === canvas.scene?.id) this.pullTo(data.x, data.y);
    };
    game.socket?.on(PULL_SOCKET, this._socketCb);

    this.active = true;
  }

  // GM Shift+long-press: show a ping marker at the location for everyone (a normal
  // networked canvas.ping; our drawPing wrap renders the globe marker on every
  // client), broadcast a scene-scoped pull so each client focuses its globe, and
  // focus our own globe now (socket emits don't loop back to the sender).
  firePull(sceneX, sceneY) {
    try { canvas.ping({ x: sceneX, y: sceneY }); }
    catch (err) { console.warn("[planetside] pull ping failed", err); }
    game.socket?.emit(PULL_SOCKET, { t: "pull", sceneId: canvas.scene?.id, x: sceneX, y: sceneY });
    this.pullTo(sceneX, sceneY);
  }

  // Ease the globe camera to a scene location (a received or locally-issued pull),
  // reusing the focus() primitive. focus() yields to manual orbit if the user drags.
  pullTo(sceneX, sceneY) {
    if (!this.active) return;
    const t = this.sceneToCameraTarget(sceneX, sceneY);
    // Rotate only — keep each viewer's current zoom (omit radius), and use the
    // opening's lateral-then-tilt easing so the pull settles like the scene load.
    this.orbit?.focus(
      { azimuth: t.azimuth, elevation: t.elevation },
      { animate: true, duration: PULL_DURATION_MS, elevEasePower: PULL_ELEV_EASE_POWER }
    );
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
  // shares the projection's sphere-point parameterization); zoom is a heuristic. When
  // x/y are null (no default view set — the common case) we centre on the scene.
  _defaultViewTarget() {
    const init = canvas.scene?.initial ?? {};
    return this.sceneToCameraTarget(init.x, init.y, init.scale ?? 1);
  }

  // Map a scene coordinate (+ optional Foundry view scale) to an orbit-camera
  // target { azimuth = lon, elevation = lat, radius }. Shared by the default-view
  // opening and the GM pull. When x/y are null, centres on the scene (az/el 0).
  sceneToCameraTarget(sceneX, sceneY, scale = 1) {
    const dims = canvas.dimensions;
    let azimuth = 0;
    let elevation = 0;
    if (sceneX != null && sceneY != null && dims) {
      const u = (sceneX - dims.sceneX) / dims.sceneWidth;
      const v = (sceneY - dims.sceneY) / dims.sceneHeight;
      const { lat, lon } = this.projection.uvToLatLon(u, v);
      azimuth = lon;
      elevation = lat;
    }
    return { azimuth, elevation, radius: this._scaleToRadius(scale) };
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

  // Re-apply lighting/atmosphere flags live (no rebuild). Called on flag change.
  applyLighting() {
    if (!this.active || !this.scene3d) return;
    this.scene3d.applyLighting(readLightingFlags(canvas.scene));
    this.markDirty();
  }

  // Re-read the projection + terrain flags and rebuild the globe body in place
  // (camera/texture preserved). The single Projection and Heightfield instances
  // are mutated, so all consumers (input, overlays, placeables, scene) follow
  // automatically. A new heightmap loads async and re-bakes again via onReady.
  applyProjection() {
    if (!this.active || !this.projection) return;
    const projFlags = readProjectionFlags(canvas.scene);
    this.projection.configure({
      curve: projFlags.projection,
      latitudeSpanDeg: projFlags.latitudeSpan
    });
    this.heightfield?.configure(readTerrainFlags(canvas.scene));
    // A changed heightmap reloads async; allow its onReady to re-bake. The direct
    // rebuild below handles the projection-only / already-loaded case immediately.
    this._terrainBaked = false;
    this._capsColored = false;
    this.scene3d?.rebuildBody();
    this.markDirty();
  }

  // Both async globe assets (colour texture, heightmap) funnel here. Reveal what's
  // ready, start the opening once revealed, and bake terrain a single time once
  // its inputs are ready — coalesced regardless of which asset loads first.
  _onGlobeAssetReady() {
    if (!this.active) return;
    this.markDirty();
    this._maybeStartIntro();

    const hf = this.heightfield;
    const colorReady = !!this.scene3d?.colorReady;
    if (hf?.enabled) {
      // Terrain: bake once, when both the heightmap and the colour (for cap
      // colours) are ready, then swap it in over the flat body.
      if (hf.loaded && colorReady && !this._terrainBaked) {
        this._terrainBaked = true;
        this.scene3d.rebuildBody();
      }
    } else if (colorReady && !this._capsColored && !this.projection?.coversPoles) {
      // No heightmap but caps exist: rebuild once to apply cap colours from the
      // loaded image. (Full-sphere coverage has no caps — nothing to recolour.)
      this._capsColored = true;
      this.scene3d.rebuildBody();
    }
  }

  // Start the eased opening the first time the globe is actually revealed (colour
  // texture ready), so the tween plays continuously instead of advancing on
  // wall-clock time while frames are stalled during the load.
  _maybeStartIntro() {
    if (this._introStarted || !this.scene3d?.colorReady || !this._introTarget) return;
    this._introStarted = true;
    this.orbit?.focus(this._introTarget, {
      animate: true,
      duration: INTRO_DURATION_MS,
      elevEasePower: INTRO_ELEV_EASE_POWER
    });
  }

  deactivate() {
    if (!this.active) return;
    if (this._tickerCb) {
      canvas.app.ticker.remove(this._tickerCb);
      this._tickerCb = null;
    }
    if (this._socketCb) {
      game.socket?.off(PULL_SOCKET, this._socketCb);
      this._socketCb = null;
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
    this.heightfield?.destroy();
    document.body.classList.remove("planetside-active");

    this.scene3d = null;
    this.orbit = null;
    this.input = null;
    this.overlays = null;
    this.titleOverlay = null;
    this.tokenLayer = null;
    this.tileLayer = null;
    this._introTarget = null;
    this._introStarted = false;
    this._terrainBaked = false;
    this._capsColored = false;
    this.projection = null;
    this.heightfield = null;
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
