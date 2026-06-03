import { Planetside } from "./planetside.js";
import { TITLE_FONT_OPTIONS, TITLE_CORNER_OPTIONS, readTitleFlags } from "./title.js";

const MODULE_ID = "planetside";
const TAB_TEMPLATE = `modules/${MODULE_ID}/templates/scene-config-tab.hbs`;

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
  loadTemplates([TAB_TEMPLATE]);
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
  const enabled = isSceneEnabled(scene);
  const titleFlags = readTitleFlags(scene);
  const tabHtml = await renderTemplate(TAB_TEMPLATE, {
    enabled,
    ...titleFlags,
    fontOptions: TITLE_FONT_OPTIONS,
    cornerOptions: TITLE_CORNER_OPTIONS
  });

  const $html = html instanceof jQuery ? html : $(html);
  const nav = $html.find('nav.sheet-tabs').first();
  if (nav.length && !nav.find('[data-tab="planetside"]').length) {
    nav.append('<a class="item" data-tab="planetside"><i class="fas fa-globe"></i> Planetside</a>');
  }

  if (!$html.find('section.tab[data-tab="planetside"], div.tab[data-tab="planetside"]').length) {
    const lastTab = $html.find('section.tab[data-group="main"], div.tab[data-group="main"]').last();
    if (lastTab.length) lastTab.after(tabHtml);
    else $html.find('footer').first().before(tabHtml);
  }

  app.setPosition({ height: "auto" });
});

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

Hooks.on("updateScene", (scene, changes) => {
  if (!controller) return;
  if (scene.id !== canvas?.scene?.id) return;

  const nested = changes?.flags?.[MODULE_ID];
  const dotFlatAny = Object.keys(changes?.flags ?? {}).some(k => k.startsWith(`${MODULE_ID}.`));
  if (nested === undefined && !dotFlatAny) return;

  if (isSceneEnabled(scene)) {
    controller.activate();
    controller.refreshTitle();
  } else {
    controller.deactivate();
  }
});
