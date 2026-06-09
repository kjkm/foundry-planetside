import { Planetside } from "./planetside.js";
import { TITLE_FONT_OPTIONS, TITLE_CORNER_OPTIONS, readTitleFlags } from "./title.js";
import { PROJECTION_OPTIONS, readProjectionFlags } from "./projection.js";
import { readTerrainFlags } from "./heightfield.js";
import { readLightingFlags } from "./lighting.js";

const MODULE_ID = "planetside";
const TAB_TEMPLATE = `modules/${MODULE_ID}/templates/scene-config-tab.hbs`;

// v13 moved the Handlebars helpers under foundry.applications.handlebars; the bare
// globals still exist on v13 but are deprecated. Prefer the namespaced versions
// when present, fall back to the globals (v12).
const _hb = globalThis.foundry?.applications?.handlebars;
const loadTpl = (paths) => (_hb?.loadTemplates ?? loadTemplates)(paths);
const renderTpl = (path, data) => (_hb?.renderTemplate ?? renderTemplate)(path, data);

let controller = null;

function isSceneEnabled(scene) {
  if (!scene) return false;
  try {
    return Boolean(scene.getFlag(MODULE_ID, "enabled"));
  } catch (_) {
    return false;
  }
}

Hooks.once("init", () => {
  controller = new Planetside();
  game.modules.get(MODULE_ID).api = {
    controller,
    enableScene: async (scene = canvas?.scene) => {
      if (!scene) return;
      await scene.setFlag(MODULE_ID, "enabled", true);
      controller.activate();
    },
    disableScene: async (scene = canvas?.scene) => {
      if (!scene) return;
      await scene.setFlag(MODULE_ID, "enabled", false);
      controller.deactivate();
    }
  };
  loadTpl([TAB_TEMPLATE]);
  console.log(`[${MODULE_ID}] init`);
});

Hooks.on("canvasReady", () => {
  if (!controller) return;
  if (isSceneEnabled(canvas.scene)) controller.activate();
  else controller.deactivate();
});

Hooks.on("canvasTearDown", () => {
  controller?.deactivate();
});

Hooks.on("renderSceneConfig", async (app, html) => {
  const scene = app.document;
  const tabHtml = await renderTpl(TAB_TEMPLATE, {
    enabled: isSceneEnabled(scene),
    ...readTitleFlags(scene),
    ...readProjectionFlags(scene),
    ...readTerrainFlags(scene),
    ...readLightingFlags(scene),
    fontOptions: TITLE_FONT_OPTIONS,
    cornerOptions: TITLE_CORNER_OPTIONS,
    projectionOptions: PROJECTION_OPTIONS
  });

  // v13 SceneConfig is ApplicationV2 — the hook passes a native HTMLElement and
  // uses data-action="tab" / data-group="sheet" tab markup. v12 is ApplicationV1
  // (jQuery, class="item" nav, data-group="main"). Branch accordingly.
  if (html instanceof HTMLElement) _injectPlanetsideTabV2(app, html, tabHtml);
  else _injectPlanetsideTabV1(app, html, tabHtml);
});

// ApplicationV2 (Foundry v13): native DOM, the sheet's own tab controller handles
// switching for any [data-action="tab"] in the matching data-group.
function _injectPlanetsideTabV2(app, root, tabHtml) {
  if (root.querySelector('[data-tab="planetside"]')) return; // guard re-render

  const nav = root.querySelector('nav.sheet-tabs[data-application-part="tabs"]')
    ?? root.querySelector('nav.sheet-tabs');
  if (nav) {
    nav.insertAdjacentHTML("beforeend",
      '<a data-action="tab" data-group="sheet" data-tab="planetside">'
      + '<i class="fa-solid fa-globe" inert></i><span>Planetside</span></a>');
  }

  // The template's wrapper is `<div class="tab" data-tab="planetside" data-group="main">`;
  // remap the group to v13's "sheet" and match the scrollable sections.
  const holder = document.createElement("div");
  holder.innerHTML = tabHtml.trim();
  const section = holder.firstElementChild;
  if (!section) return;
  section.dataset.group = "sheet";
  section.classList.add("scrollable");

  const sheetTabs = [...root.querySelectorAll('div.tab[data-group="sheet"], section.tab[data-group="sheet"]')];
  const lastTab = sheetTabs[sheetTabs.length - 1];
  if (lastTab) lastTab.after(section);
  else root.querySelector("footer")?.before(section) ?? root.append(section);

  _wireFilePickers(section);
  app.setPosition?.({ height: "auto" });
}

// ApplicationV1 (Foundry v12): jQuery, original markup.
function _injectPlanetsideTabV1(app, html, tabHtml) {
  const $html = html instanceof jQuery ? html : $(html);
  const nav = $html.find("nav.sheet-tabs").first();
  if (nav.length && !nav.find('[data-tab="planetside"]').length) {
    nav.append('<a class="item" data-tab="planetside"><i class="fas fa-globe"></i> Planetside</a>');
  }
  if (!$html.find('section.tab[data-tab="planetside"], div.tab[data-tab="planetside"]').length) {
    const lastTab = $html.find('section.tab[data-group="main"], div.tab[data-group="main"]').last();
    if (lastTab.length) lastTab.after(tabHtml);
    else $html.find("footer").first().before(tabHtml);
  }
  _wireFilePickers($html[0] ?? $html);
  app.setPosition({ height: "auto" });
}

// Wire any file-picker buttons in the injected tab (the sheet won't auto-bind
// buttons we added). Best-effort + version-tolerant; the text input persists the
// path regardless, so this only adds the browse convenience.
function _wireFilePickers(root) {
  if (!root?.querySelectorAll) return;
  const FPClass = globalThis.FilePicker ?? foundry?.applications?.apps?.FilePicker;
  const FP = FPClass?.implementation ?? FPClass;
  for (const btn of root.querySelectorAll("button.file-picker[data-target]")) {
    if (btn._planetsideWired) continue;
    btn._planetsideWired = true;
    btn.addEventListener("click", () => {
      const input = root.querySelector(`[name="${btn.dataset.target}"]`);
      if (!input || !FP) return;
      new FP({
        type: btn.dataset.type || "image",
        current: input.value || "",
        callback: (path) => { input.value = path; }
      }).render(true);
    });
  }
}

function tokenSceneId(tokenDocument) {
  return tokenDocument?.parent?.id ?? tokenDocument?.scene?.id;
}

function tokenIsOnActiveScene(tokenDocument) {
  return controller?.active && tokenSceneId(tokenDocument) === canvas?.scene?.id;
}

Hooks.on("createToken", (tokenDocument) => {
  if (!tokenIsOnActiveScene(tokenDocument)) return;
  const placeable = tokenDocument.object ?? tokenDocument;
  controller.tokenLayer?.addToken(placeable);
});

Hooks.on("updateToken", (tokenDocument, changes) => {
  if (!tokenIsOnActiveScene(tokenDocument)) return;
  const placeable = tokenDocument.object ?? tokenDocument;
  controller.tokenLayer?.updateToken(placeable, changes);
});

Hooks.on("refreshToken", (token) => {
  if (!controller?.active) return;
  if (token?.scene?.id !== canvas?.scene?.id) return;
  controller.tokenLayer?.updateToken(token, null);
});

Hooks.on("deleteToken", (tokenDocument) => {
  if (!tokenIsOnActiveScene(tokenDocument)) return;
  controller.tokenLayer?.removeToken(tokenDocument);
});

function docIsOnActiveScene(doc) {
  if (!controller?.active) return false;
  const sceneId = doc?.parent?.id ?? doc?.scene?.id;
  return sceneId === canvas?.scene?.id;
}

Hooks.on("createTile", (tileDocument) => {
  if (!docIsOnActiveScene(tileDocument)) return;
  const placeable = tileDocument.object ?? tileDocument;
  controller.tileLayer?.addTile(placeable);
});

Hooks.on("updateTile", (tileDocument, changes) => {
  if (!docIsOnActiveScene(tileDocument)) return;
  const placeable = tileDocument.object ?? tileDocument;
  controller.tileLayer?.updateTile(placeable, changes);
});

Hooks.on("refreshTile", (tile) => {
  if (!controller?.active) return;
  if (tile?.scene?.id !== canvas?.scene?.id) return;
  controller.tileLayer?.updateTile(tile, null);
});

Hooks.on("deleteTile", (tileDocument) => {
  if (!docIsOnActiveScene(tileDocument)) return;
  controller.tileLayer?.removeTile(tileDocument);
});

Hooks.on("updateScene", (scene, changes) => {
  if (!controller) return;
  if (scene.id !== canvas?.scene?.id) return;

  const nested = changes?.flags?.[MODULE_ID];
  const dotFlatAny = Object.keys(changes?.flags ?? {}).some(k => k.startsWith(`${MODULE_ID}.`));
  if (nested === undefined && !dotFlatAny) return;

  if (isSceneEnabled(scene)) {
    controller.activate();
    controller.refreshTitle();
    controller.applyProjection();
    controller.applyLighting();
  } else {
    controller.deactivate();
  }
});
