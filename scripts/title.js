export const TITLE_DEFAULTS = Object.freeze({
  title: "",
  subtitle: "",
  titleFont: "serif",
  titleSize: 36,
  subtitleFont: "serif",
  subtitleSize: 18,
  titleCorner: "tl"
});

export const TITLE_FONT_OPTIONS = Object.freeze({
  "serif": "Serif (default)",
  "sans-serif": "Sans-serif",
  "monospace": "Monospace",
  "Signika": "Signika",
  "Arial": "Arial",
  "Georgia": "Georgia",
  "Trebuchet MS": "Trebuchet MS",
  "Verdana": "Verdana",
  "Times New Roman": "Times New Roman",
  "Courier New": "Courier New",
  "Impact": "Impact",
  "Palatino": "Palatino"
});

export const TITLE_CORNER_OPTIONS = Object.freeze({
  "tl": "Top-Left",
  "tr": "Top-Right",
  "bl": "Bottom-Left",
  "br": "Bottom-Right"
});

const GENERIC_FAMILIES = new Set(["serif", "sans-serif", "monospace"]);

const CORNER_INSET = 16;
const CORNER_EXTRA_INSET = {
  tl: { top: 48, right: 0, bottom: 0, left: 152 },
  tr: { top: 0, right: 28, bottom: 0, left: 0 },
  bl: { top: 0, right: 0, bottom: 60, left: 0 },
  br: { top: 0, right: 0, bottom: 0, left: 0 }
};

const TEXT_SHADOW = "0 0 8px rgba(0,0,0,0.85), 0 2px 2px rgba(0,0,0,0.7)";

function cornerStyleFromBoard(corner, board) {
  const rect = board?.getBoundingClientRect();
  if (!rect) {
    return {
      tl: { top: `${CORNER_INSET}px`, left: `${CORNER_INSET}px`, right: "auto", bottom: "auto", textAlign: "left", alignItems: "flex-start" },
      tr: { top: `${CORNER_INSET}px`, right: `${CORNER_INSET}px`, left: "auto", bottom: "auto", textAlign: "right", alignItems: "flex-end" },
      bl: { bottom: `${CORNER_INSET}px`, left: `${CORNER_INSET}px`, right: "auto", top: "auto", textAlign: "left", alignItems: "flex-start" },
      br: { bottom: `${CORNER_INSET}px`, right: `${CORNER_INSET}px`, left: "auto", top: "auto", textAlign: "right", alignItems: "flex-end" }
    }[corner] || {};
  }
  const extra = CORNER_EXTRA_INSET[corner] || CORNER_EXTRA_INSET.tl;
  const rightInset = window.innerWidth - rect.right + CORNER_INSET + extra.right;
  const bottomInset = window.innerHeight - rect.bottom + CORNER_INSET + extra.bottom;
  const topInset = rect.top + CORNER_INSET + extra.top;
  const leftInset = rect.left + CORNER_INSET + extra.left;
  switch (corner) {
    case "tr": return { top: `${topInset}px`, right: `${rightInset}px`, left: "auto", bottom: "auto", textAlign: "right", alignItems: "flex-end" };
    case "bl": return { bottom: `${bottomInset}px`, left: `${leftInset}px`, right: "auto", top: "auto", textAlign: "left", alignItems: "flex-start" };
    case "br": return { bottom: `${bottomInset}px`, right: `${rightInset}px`, left: "auto", top: "auto", textAlign: "right", alignItems: "flex-end" };
    case "tl":
    default: return { top: `${topInset}px`, left: `${leftInset}px`, right: "auto", bottom: "auto", textAlign: "left", alignItems: "flex-start" };
  }
}

export function readTitleFlags(scene) {
  const flags = scene?.flags?.planetside ?? {};
  return {
    title: flags.title ?? TITLE_DEFAULTS.title,
    subtitle: flags.subtitle ?? TITLE_DEFAULTS.subtitle,
    titleFont: flags.titleFont ?? TITLE_DEFAULTS.titleFont,
    titleSize: Number(flags.titleSize ?? TITLE_DEFAULTS.titleSize),
    subtitleFont: flags.subtitleFont ?? TITLE_DEFAULTS.subtitleFont,
    subtitleSize: Number(flags.subtitleSize ?? TITLE_DEFAULTS.subtitleSize),
    titleCorner: flags.titleCorner ?? TITLE_DEFAULTS.titleCorner
  };
}

function fontFamilyCss(family) {
  if (GENERIC_FAMILIES.has(family)) return family;
  return `"${family}", serif`;
}

export class TitleOverlay {
  constructor({ hostElement }) {
    this.host = hostElement;
    this.container = null;
    this.titleEl = null;
    this.subtitleEl = null;
  }

  install() {
    this.container = document.createElement("div");
    this.container.id = "planetside-title-overlay";
    Object.assign(this.container.style, {
      position: "fixed",
      zIndex: "10",
      pointerEvents: "none",
      display: "none",
      flexDirection: "column",
      maxWidth: "60%"
    });

    this.titleEl = document.createElement("div");
    this.titleEl.className = "planetside-title";
    Object.assign(this.titleEl.style, {
      color: "#ffffff",
      textShadow: TEXT_SHADOW,
      fontWeight: "600",
      lineHeight: "1.1"
    });

    this.subtitleEl = document.createElement("div");
    this.subtitleEl.className = "planetside-subtitle";
    Object.assign(this.subtitleEl.style, {
      color: "#ffffff",
      textShadow: TEXT_SHADOW,
      fontWeight: "400",
      lineHeight: "1.1",
      marginTop: "4px"
    });

    this.container.appendChild(this.titleEl);
    this.container.appendChild(this.subtitleEl);
    this.host.appendChild(this.container);

    this._onResize = () => {
      if (this._lastFlags) this.update(this._lastFlags);
    };
    window.addEventListener("resize", this._onResize);
  }

  update(flags) {
    if (!this.container) return;
    this._lastFlags = flags;
    const visible = (flags.title?.length ?? 0) > 0 || (flags.subtitle?.length ?? 0) > 0;
    this.container.style.display = visible ? "flex" : "none";
    if (!visible) return;

    const board = document.getElementById("board");
    const corner = cornerStyleFromBoard(flags.titleCorner, board);
    Object.assign(this.container.style, corner);

    this.titleEl.textContent = flags.title;
    this.titleEl.style.fontFamily = fontFamilyCss(flags.titleFont);
    this.titleEl.style.fontSize = `${flags.titleSize}px`;
    this.titleEl.style.display = flags.title.length > 0 ? "block" : "none";

    this.subtitleEl.textContent = flags.subtitle;
    this.subtitleEl.style.fontFamily = fontFamilyCss(flags.subtitleFont);
    this.subtitleEl.style.fontSize = `${flags.subtitleSize}px`;
    this.subtitleEl.style.display = flags.subtitle.length > 0 ? "block" : "none";
  }

  destroy() {
    if (this._onResize) {
      window.removeEventListener("resize", this._onResize);
      this._onResize = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.titleEl = null;
    this.subtitleEl = null;
    this._lastFlags = null;
  }
}
