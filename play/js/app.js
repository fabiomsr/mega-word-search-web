// Mega Word Search in the browser: the screens of the game (UI/Screens) over the model and generator of core.js,
// with the progress, options and the game in progress kept in localStorage. A custom game can be shared as a link:
// ?seed=…&lang=…&size=…&words=…&shapes=…&board=…&cats=…&time=… gives everyone the same board (also in the app,
// with the same options and seed).
import * as core from "./core.js";
import { BoardView, hexColor, letterOn } from "./board.js";
import { play, sound } from "./sound.js";

const LANGUAGES = [["es", "Español"], ["en", "English"], ["de", "Deutsch"]];
const STORE = "mws.";
const MINIMAP_FROM = 16;
const HINT_TIME = 4;
const HINT_CELLS_ACROSS = 11;
const RESULT_DELAY = 1;
const COMPLETE_DELAY = 2.2;
const WARNING_TIME = 30;
const WORDITTO_COLOR = [0xb8, 0x86, 0x0b];
const MISSING_COLOR = [84, 96, 120];
const TITLE_COLOR = [255, 214, 102];
const GOLD = ["#b8860b", "#ffc107", "#ffd54f", "#fff176"];
const PLAY_STORE = "https://play.google.com/store/apps/details?id=com.sglora.megawordsearch";

// The options' colours (Model/ColorChoices.cs).
const SELECTION_COLORS = [["Azul", 0x346ed2], ["Verde", 0x2e9650], ["Morado", 0x7e57c2], ["Naranja", 0xe6781e], ["Rosa", 0xd84380], ["Gris", 0x5a6478]];
const BASIC_PALETTES = 5;
const PALETTES = [
  ["Arcoíris", [0xe57373, 0xe07b00, 0x4caf50, 0x1ea8de, 0x9c59b6, 0x009688, 0xe9548c, 0x7986cb]],
  ["Océano", [0x0077b6, 0x0096c7, 0x023e8a, 0x4895ef, 0x00a6c8, 0x2a9d8f, 0x457b9d, 0x264653]],
  ["Bosque", [0x388e3c, 0x689f38, 0x556b2f, 0x2e7d32, 0x827717, 0x00796b, 0x795548, 0x5d4037]],
  ["Atardecer", [0xe65100, 0xef6c00, 0xd84315, 0xc2185b, 0xad1457, 0xf4511e, 0xc62828, 0xff6f00]],
  ["Caramelo", [0xec407a, 0xab47bc, 0x7e57c2, 0x5c6bc0, 0x039be5, 0x00acc1, 0xff7043, 0xf57c00]],
  // On their own screen.
  ["Algodón de azúcar", [0xffc7c7, 0xffe2e2, 0x8785a2, 0xf4eeff, 0xdcd6f7, 0xa6b1e1, 0x424874, 0xea80b0]],
  ["Mar profundo", [0xa6c0c5, 0xdbe2ef, 0x3f72af, 0x112d4e, 0x1b262c, 0x0f4c75, 0x3282b8, 0xbbe1fa]],
  ["Melocotón", [0xdd969c, 0xffe3e1, 0xffd1d1, 0xff9494, 0xb1b2ff, 0xaac4ff, 0xd2daff, 0xeef1ff]],
  ["Menta y fresa", [0xffb6b9, 0xfacebb, 0xbbded6, 0x61c0bf, 0xa8d8ea, 0xaa96da, 0xfcbad3, 0xffffd2]],
  ["Niebla", [0x6096b4, 0x93bfcf, 0xbdcdd6, 0xedddab, 0xdefcf9, 0xcadefc, 0xc3bef0, 0xcca8e9]],
  ["Luciérnaga", [0x222831, 0x393e46, 0xffd369, 0x5d0ced, 0x08d9d6, 0xff5200, 0xff2e63, 0x92e601]],
  ["Frambuesa", [0xd14d72, 0xffabab, 0xfcc8d1, 0xcc99b3, 0xf38181, 0xfce38a, 0xeaffd0, 0x95e1d3]],
  ["Hortensia", [0xf2d7d9, 0xd3cedf, 0x9cb4cc, 0x748da6, 0xffcfdf, 0xfefdca, 0xe0f9b5, 0xa5dee5]],
  ["Ocaso", [0xf67280, 0xc06c84, 0x6c5b7b, 0x355c7d, 0x5aa2c4, 0xadc4ce, 0xedd6af, 0xf2e9a0]],
  ["Café con leche", [0x8d7b68, 0xa4907c, 0xc8b6a6, 0xf1dec9, 0xe23e57, 0x88304e, 0x522546, 0x311d3f]],
  ["Arrecife", [0x364f6b, 0x3fc1c9, 0xf5dcdc, 0xfc5185, 0xfcd1d1, 0xece2e1, 0xd3e0dc, 0xaee1e1]],
  ["Pradera", [0xedf2bf, 0x9dc08b, 0x609966, 0x40513b, 0x00b8a9, 0xf7efba, 0xf6416c, 0xffde7d]],
  ["Pétalos", [0xffeecc, 0xffddcc, 0xd9ffb3, 0xfebbcc, 0xff9ed7, 0xffffb5, 0xcde990, 0xaacb73]],
];
// The themes (UI/Theme.cs): the interface's colours are in game.css; these, on the board's canvas.
const THEMES = {
  classic: { name: "Clásico", background: "#182030", board: [246, 241, 228], edge: "rgb(170,150,120)", frame: "rgba(24,32,48,0.78)", view: "rgb(52,104,168)" },
  cats: { name: "Gatos", background: "#10243f", board: [0xf7, 0xf3, 0xe9], edge: "rgb(210,198,181)", frame: "rgba(16,36,63,0.78)", view: "rgb(46,139,216)" },
};
const DEFAULT_THEME = "cats";
// The kittens (Model/CatStickers.cs), numbered row by row on their sheet.
const STICKER_COLUMNS = 6;
const STICKER_ROWS = 5;
const STICKER_COUNT = 30;
const PEEKING = 0;
const SLEEPING = 13;
const FACES = [1, 3, 4, 7, 8, 10, 12, 14, 15, 21, 26, 28];
// The kitten of this run of the game, any but the sleeping one.
const RUN_KITTEN = (() => {
  const kitten = Math.floor(Math.random() * (STICKER_COUNT - 1));
  return kitten >= SLEEPING ? kitten + 1 : kitten;
})();
// Paw prints on the background (UI/ThemeDecor.cs): how wide, how far from everything, and one per this much room.
const MIN_PAW = 16;
const MAX_PAW = 24;
const PAW_CLEARANCE = 10;
const PAW_EDGE = 4;
const PAW_SPACING = 56;
const ROOM_PER_PAW = 48000;
const PAW_TRIES = 300;
// A back button and its kitten: room for a title's rays to keep clear of.
const BACK_BUTTON_ROOM = 104;
// In landscape the word panel is a column on the right this wide (a share of the screen, within limits).
const PANEL_SHARE = 0.3;
const MIN_PANEL_WIDTH = 280;
const MAX_PANEL_WIDTH = 360;
const CLEAR_RADIUS = 28;
const DOCKED_CLEAR_RADIUS = 22;
const LETTER_SIZES = ["Normal", "Grande", "Muy grande"];
const LETTER_HEIGHTS = [0.66, 0.74, 0.82];
const CELLS_ACROSS = [11, 9, 7.5];
const AMOUNTS = ["Pocas", "Normal", "Muchas"];
// The first stage's help (UI/BasicsHelp.cs).
const HELP_SIDE = 5;
const HELP_BIG_SIDE = 8;
const HELP_CELL = 52;
const HELP_FILLER = "MARTOLENUSCIDABROPELIAGUNSEROMATICLUNAPEROSALTIDEMOC";
const HELP_WORD_ROW = 2;
const STEP_TIME = 0.55;
const HOLD_TIME = 1.5;
const DRAG_TIME = 1.3;
const REST_TIME = 0.6;
const ZOOM_TIME = 1.2;
const HELP_MAX_ZOOM = 1.9;
// The shapes of a custom game in a shared link, one letter each.
const SHAPE_LETTERS = [["h", "horizontal"], ["v", "vertical"], ["d", "diagonal"], ["r", "reversed"], ["o", "snakeOrthogonal"], ["s", "snake"]];
const URL_AMOUNTS = ["few", "normal", "many"];

// Texts only the web version has, in English and German (the rest come from the game's Strings.cs).
const WEB_STRINGS = {
  en: {
    "Compartir": "Share",
    "Enlace copiado": "Link copied",
    "Copia este enlace para compartir la sopa:": "Copy this link to share the puzzle:",
    "Este enlace no tiene una partida válida": "This link has no valid game",
    "Mega Word Search para Android": "Mega Word Search for Android",
    "Volver a la web": "Back to the website",
    "Cómo se juega": "How to play",
    "Wordittos": "Wordittos",
    "¡Mira esta sopa de letras! Semilla {0}": "Try this word search! Seed {0}",
  },
  de: {
    "Compartir": "Teilen",
    "Enlace copiado": "Link kopiert",
    "Copia este enlace para compartir la sopa:": "Kopiere diesen Link, um das Rätsel zu teilen:",
    "Este enlace no tiene una partida válida": "Dieser Link enthält kein gültiges Spiel",
    "Mega Word Search para Android": "Mega Word Search für Android",
    "Volver a la web": "Zurück zur Website",
    "Cómo se juega": "So wird gespielt",
    "Wordittos": "Wordittos",
    "¡Mira esta sopa de letras! Semilla {0}": "Probier dieses Suchrätsel! Startwert {0}",
  },
};

const app = document.getElementById("app");
const content = { banks: {}, strings: { en: {}, de: {} } };
let language = "es";
let bank, worlds, emoji;
let settings, progress, custom, saved;
let wordittoAtlas = null;
let emojiAtlas = null;
// The options' tab shown: 0 the look, 1 the rest.
let optionsTab = 0;
const stack = [];

// ---- Storage (it may be unavailable: then nothing is kept) ----

function load(name, fallback) {
  try {
    const text = localStorage.getItem(STORE + name);
    return text ? { ...fallback, ...JSON.parse(text) } : fallback;
  } catch (e) {
    return fallback;
  }
}

function store(name, value) {
  try {
    if (value === null) localStorage.removeItem(STORE + name);
    else localStorage.setItem(STORE + name, JSON.stringify(value));
  } catch (e) {
    // Private mode or full: the game goes on without keeping it.
  }
}

const saveSettings = () => store("settings", settings);
const saveProgress = () => store("progress", progress);
const saveCustom = () => store("custom", custom);

// ---- Texts ----

function tr(spanish, ...args) {
  const table = language === "es" ? null : content.strings[language];
  let text = (table && (table[spanish] ?? WEB_STRINGS[language][spanish])) ?? spanish;
  args.forEach((arg, i) => (text = text.split(`{${i}}`).join(String(arg))));
  return text;
}

function pickLanguage(override) {
  const known = (code) => LANGUAGES.some(([c]) => c === code);
  if (known(override)) return override;
  if (known(settings.language)) return settings.language;
  try {
    // The language chosen on the website, if any.
    const site = localStorage.getItem("lang");
    if (known(site)) return site;
  } catch (e) {}
  for (const code of navigator.languages || [navigator.language || ""]) {
    const short = String(code).slice(0, 2).toLowerCase();
    if (known(short)) return short;
  }
  return "en";
}

async function useLanguage(code) {
  language = code;
  document.documentElement.lang = code;
  if (!content.banks[code]) {
    const data = await fetchJson(`content/words-${code}.json`);
    content.banks[code] = core.makeWordBank(data, (name) => tr("Es de la categoría «{0}»", name));
  }
  bank = content.banks[code];
}

const fetchJson = (path) => fetch(path).then((response) => {
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
});

function loadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

// ---- Little helpers ----

/** An element: el("button.btn.done", { onclick }, "text", child…). */
function el(spec, attributes = {}, ...children) {
  const [tag, ...classes] = spec.split(".");
  const element = document.createElement(tag || "div");
  if (classes.length) element.className = classes.join(" ");
  for (const [name, value] of Object.entries(attributes || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (name.startsWith("on")) element.addEventListener(name.slice(2), value);
    else if (name === "style") Object.assign(element.style, value);
    else element.setAttribute(name, value === true ? "" : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return element;
}

const button = (label, onclick, { sub, cls = "", disabled } = {}) =>
  el(`button.btn${cls ? "." + cls : ""}`, { onclick, disabled }, label, sub ? el("small", {}, sub) : null);

function formatTime(seconds, roundUp = false) {
  const total = Math.max(0, roundUp ? Math.ceil(seconds - 1e-9) : Math.floor(seconds));
  const hours = Math.floor(total / 3600), minutes = Math.floor(total / 60) % 60, rest = total % 60;
  const two = (n) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${two(minutes)}:${two(rest)}` : `${minutes}:${two(rest)}`;
}

function toast(text) {
  const note = el("div.toast", {}, text);
  document.body.append(note);
  setTimeout(() => (note.style.opacity = "0"), 1800);
  setTimeout(() => note.remove(), 2200);
}

/** A board's characters for HTML: emoji from the atlas, symbols in their font. */
function boardText(text, kind) {
  if (kind === core.BoardKind.Emoji) {
    return el("span", {}, ...[...text].map((c) => (core.isEmoji(c) ? emojiSpan(core.emojiIndex(c)) : c)));
  }
  return el(kind === core.BoardKind.Symbols ? "span.sym" : "span", {}, text);
}

function emojiSpan(index) {
  const columns = emoji.columns, rows = Math.ceil(emoji.themes.reduce((n, t) => n + t.characters.length, 0) / columns);
  return el("span.emoji", {
    style: {
      backgroundImage: "url(content/emoji-atlas.png)",
      backgroundSize: `${columns * 100}% ${rows * 100}%`,
      backgroundPosition: `${((index % columns) / (columns - 1)) * 100}% ${(Math.floor(index / columns) / Math.max(1, rows - 1)) * 100}%`,
    },
  });
}

function wordittoPicture(index, cls = "") {
  const columns = 10, rows = Math.ceil(core.WORDITTO_PICTURES / columns);
  return el(`div.pic${cls ? "." + cls : ""}`, {
    style: {
      backgroundImage: "url(content/wordittos.png)",
      backgroundSize: `${columns * 100}% ${rows * 100}%`,
      backgroundPosition: `${((index % columns) / (columns - 1)) * 100}% ${(Math.floor(index / columns) / (rows - 1)) * 100}%`,
    },
  });
}

/** A kitten of the cats theme (other themes do not show them: see game.css). */
function sticker(index, cls = "") {
  return el(`span.sticker${cls ? "." + cls : ""}`, {
    style: {
      backgroundPosition: `${((index % STICKER_COLUMNS) / (STICKER_COLUMNS - 1)) * 100}% ${(Math.floor(index / STICKER_COLUMNS) / (STICKER_ROWS - 1)) * 100}%`,
    },
  });
}

const RAYS = '<svg viewBox="0 -50 80 100"><path d="M35 -24 59 -41M42 0H72M35 24 59 41"/></svg>';

function rays(side) {
  const span = el(`span.rays-${side}`);
  span.innerHTML = RAYS;
  return span;
}

/** A screen's title, with rays on both sides in a theme that has them, if they fit (see fitRays). */
const title = (spec, text, attributes) => el(`${spec}.rayed`, attributes, el("span.t", {}, rays("left"), text, rays("right")));

const backButton = () => el("button.icon-btn.back", { onclick: close, "aria-label": tr("Volver") }, sticker(PEEKING), "<");

/** Rays only when both fit on the screen, out of a back button's way. */
function fitRays() {
  for (const heading of app.querySelectorAll(".t")) {
    const parent = heading.parentElement;
    parent.classList.remove("no-rays");
    const rect = heading.getBoundingClientRect(), size = parseFloat(getComputedStyle(heading.querySelector("svg")).width) || 0;
    const center = rect.left + rect.width / 2, reach = rect.width / 2 + size;
    const keepClear = parent.closest(".topbar") ? BACK_BUTTON_ROOM : 0;
    if (center - reach < keepClear || center + reach > window.innerWidth - keepClear) parent.classList.add("no-rays");
  }
}

function useTheme(id) {
  settings.theme = id in THEMES ? id : DEFAULT_THEME;
  document.documentElement.dataset.theme = settings.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEMES[settings.theme].background);
}

// ---- Paw prints on the background, in the room a screen leaves free: always the same for the same screen ----

function placePaws(id) {
  const layer = document.getElementById("paws");
  if (!layer) return;
  layer.replaceChildren();
  if (!id || settings.theme !== "cats") return;
  const width = window.innerWidth, height = window.innerHeight;
  const occupied = [...app.querySelectorAll("button, h1, h2, a, p, .section-title, .display, .count, .sticker, .sample, input")]
    .map((element) => element.getBoundingClientRect()).filter((rect) => rect.width > 0 && rect.height > 0);
  let hash = 2166136261;
  for (const c of id) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  const random = () => {
    hash = (hash + 0x6d2b79f5) | 0;
    let t = Math.imul(hash ^ (hash >>> 15), 1 | hash);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const wanted = Math.max(3, Math.floor((width * height) / ROOM_PER_PAW));
  const paws = [];
  for (let i = 0; i < PAW_TRIES && paws.length < wanted; i++) {
    const size = MIN_PAW + random() * (MAX_PAW - MIN_PAW), half = size / 2 + PAW_EDGE;
    const x = half + random() * (width - 2 * half), y = half + random() * (height - 2 * half);
    const angle = (random() - 0.5) * 1.2, reach = size / 2 + PAW_CLEARANCE;
    if (occupied.some((r) => x + reach > r.left && x - reach < r.right && y + reach > r.top && y - reach < r.bottom)) continue;
    if (paws.some((paw) => Math.hypot(paw.x - x, paw.y - y) < PAW_SPACING)) continue;
    paws.push({ x, y, size, angle });
  }
  layer.innerHTML = paws.map((paw) => `<g transform="translate(${paw.x} ${paw.y}) rotate(${(paw.angle * 180) / Math.PI}) scale(${paw.size})">`
    + '<ellipse cy=".17" rx=".27" ry=".22"/><circle cx="-.33" cy="-.1" r=".11"/><circle cx="-.13" cy="-.3" r=".115"/>'
    + '<circle cx=".13" cy="-.3" r=".115"/><circle cx=".33" cy="-.1" r=".11"/></g>').join("");
}

const invented = (word) => word.category === core.INVENTED_CATEGORY;
const spaced = (text) => [...text].join(" ");
const worldName = (world) => tr(world.name);
const stageTitle = (w, s) => tr("Fase {0}-{1} · {2}×{3}", w + 1, s + 1, worlds[w].stages[s].width, worlds[w].stages[s].height);

// ---- Screens: a stack, with the browser's back button popping it ----

function show(screen) {
  stack.forEach((s) => s.element && s.element.remove());
  const top = stack[stack.length - 1];
  if (!top) return;
  top.element = top.render();
  app.replaceChildren(top.element);
  fitRays();
  placePaws(typeof top.paws === "function" ? top.paws() : top.paws);
  top.shown?.();
}

window.addEventListener("resize", () => {
  const top = stack[stack.length - 1];
  if (!top) return;
  fitRays();
  placePaws(typeof top.paws === "function" ? top.paws() : top.paws);
});

function push(screen, { replace = false } = {}) {
  const top = stack[stack.length - 1];
  top?.hidden?.();
  if (replace) stack.pop();
  stack.push(screen);
  if (!replace) history.pushState({ depth: stack.length }, "");
  show();
}

function back() {
  if (stack.length <= 1) return;
  history.back();
}

window.addEventListener("popstate", () => {
  if (stack.length <= 1) return;
  const top = stack[stack.length - 1];
  // A puzzle pauses first (and keeps its place); the next back leaves it.
  if (top.onBack && top.onBack()) {
    history.pushState({ depth: stack.length }, "");
    return;
  }
  top.hidden?.();
  top.closed?.();
  stack.pop();
  show();
});

/** Leaves the screen on top without the browser's back (e.g. a button inside the screen). */
function close() {
  back();
}

function refresh() {
  show();
}

// ---- Home ----

function homeScreen() {
  return {
    paws: "home",
    render() {
      const continuing = saved && saved.lang === language ? saved : null;
      const found = progress.wordittos.length;
      return el("div.screen", {},
        el("div.column", {},
          el("h1.home-title", {}, title("span.mega", "Mega"), " ", el("span.name", {}, "Word Search")),
          el("p.subtitle", {}, tr("Sopas de letras gigantes")),
          el("div.menu.home", {},
            continuing ? button(tr("Continuar"), () => resumeSaved(continuing), { sub: savedTitle(continuing), cls: "resume" }) : null,
            button(tr("Desafíos"), () => push(worldsScreen())),
            button("Wordittos", () => push(wordittosScreen()), { sub: `${found}/${core.WORDITTO_PICTURES}` }),
            button(tr("Partida custom"), () => push(customScreen())),
            button(tr("Opciones"), () => push(optionsScreen())),
          ),
          sticker(SLEEPING, "under-menu"),
          el("p.subtitle", { style: { marginTop: "24px", fontSize: "16px" } },
            el("a", { href: PLAY_STORE, style: { color: "var(--title)" } }, tr("Mega Word Search para Android")),
            " · ",
            el("a", { href: "../", style: { color: "var(--dim)" } }, tr("Volver a la web")),
          ),
        ),
      );
    },
  };
}

function savedTitle(game) {
  if (game.kind === "stage") {
    const w = worlds.findIndex((world) => world.id === game.worldId);
    if (w >= 0 && game.stage < worlds[w].stages.length) return stageTitle(w, game.stage);
  }
  return game.title;
}

// ---- Challenges and their stages ----

function worldsScreen() {
  return {
    paws: "worlds",
    render() {
      return el("div.screen", {},
        el("div.column", {},
          title("h1", tr("Desafíos"), { style: { marginTop: "4vh" } }),
          el("div.menu", { style: { maxWidth: "460px", marginTop: "24px" } },
            worlds.map((world, i) => {
              const open = core.isWorldUnlocked(progress, worlds, i);
              const done = core.completedCount(progress, world);
              return button(`${i + 1}. ${worldName(world)}`, () => push(stagesScreen(i)), {
                sub: open ? tr("{0}/{1} fases", done, world.stages.length) : tr("Completa el desafío anterior"),
                cls: done === world.stages.length ? "done" : "",
                disabled: !open,
              });
            }),
            sticker(RUN_KITTEN, "over-back"),
            el("div.back-gap"),
            button(tr("Volver"), close),
          ),
        ),
      );
    },
  };
}

function stagesScreen(w) {
  const world = worlds[w];
  return {
    paws: "stages",
    render() {
      const grid = el("div.stage-grid", {},
        world.stages.map((stage, s) => {
          const best = progress.bestTimes[core.progressKey(world.id, s)];
          const open = core.isStageUnlocked(progress, worlds, w, s);
          let sub = `${stage.width}×${stage.height}`;
          if (best !== undefined) sub = formatTime(best);
          else if (!open && world.rowsOf) {
            const missing = core.stagesToOpenRow(worlds, w, Math.floor(s / world.rowsOf)) - core.completedInOrderedWorlds(progress, worlds);
            sub = missing === 1 ? tr("Falta 1 fase") : tr("Faltan {0} fases", missing);
          }
          const hasWorditto = progress.wordittos.includes(core.progressKey(world.id, s));
          return button(`${w + 1}-${s + 1}${hasWorditto ? " ★" : ""}`, () => openStage(w, s), {
            sub, cls: best !== undefined ? "done" : "", disabled: !open,
          });
        }));
      return el("div.screen", {},
        el("div.column", {},
          title("h1", worldName(world), { style: { marginTop: "2vh" } }),
          el("p.subtitle.tight", {}, `${core.completedCount(progress, world)}/${world.stages.length}`),
          grid,
          el("div.menu", { style: { marginTop: "20px" } }, button(tr("Volver"), close)),
        ),
      );
    },
  };
}

/** A stage: where it was left if it is the game in progress, solved if completed, else from the start. */
function openStage(w, s) {
  const world = worlds[w];
  if (saved && saved.kind === "stage" && saved.worldId === world.id && saved.stage === s && saved.lang === language && saved.seed === world.stages[s].seed) {
    resumeSaved(saved);
  } else if (core.progressKey(world.id, s) in progress.bestTimes) {
    push(puzzleScreen(stageGame(w, s, { solved: true })));
  } else {
    push(puzzleScreen(stageGame(w, s)));
  }
}

function stageGame(w, s, extra = {}) {
  const stage = worlds[w].stages[s];
  return {
    spec: core.stageSpec(stage, bank),
    seed: stage.seed,
    title: stageTitle(w, s),
    timeLimit: stage.timeLimit,
    world: w,
    stage: s,
    ...extra,
  };
}

// ---- Wordittos ----

function wordittoHints(worditto) {
  const word = worditto.word;
  if (!invented(word)) {
    return [worditto.hint, tr("Tiene {0} letras", word.letters.length), tr("Empieza por «{0}»", word.text[0].toUpperCase())];
  }
  const shown = [...core.maskWord(word.text)];
  const hints = [shown.join("")];
  for (let i = 0; hints.length < 3; i++) {
    if (i < shown.length && shown[i] !== "?") continue;
    if (i < shown.length) shown[i] = word.text[i];
    hints.push(shown.join(""));
  }
  return hints;
}

function wordittosScreen() {
  return {
    paws: "wordittos",
    render() {
      // In landscape, two columns: odd challenges on the left and even ones on the right.
      const twoColumns = matchMedia("(min-width: 900px) and (orientation: landscape)").matches;
      const columns = twoColumns ? [el("div.wordittos-list"), el("div.wordittos-list")] : [el("div.wordittos-list")];
      worlds.forEach((world, w) => {
        const list = columns[w % columns.length];
        list.append(el("div.section-title", {}, `${w + 1}. ${worldName(world)}`));
        world.stages.forEach((stage, s) => {
          const worditto = core.wordittoFor(stage, bank);
          const key = core.progressKey(world.id, s);
          const found = progress.wordittos.includes(key);
          const open = core.isStageUnlocked(progress, worlds, w, s);
          const word = worditto.word;
          let text = found ? word.text : worditto.hint;
          if (invented(word)) text = spaced(text);
          const picture = core.wordittoPicture(worlds, w, s);
          list.append(el(`button.wd-row${found ? ".found" : open ? "" : ".locked"}`, {
            onclick: () => {
              if (key in progress.bestTimes) push(puzzleScreen(stageGame(w, s, { solved: true })));
              else if (open) openStage(w, s);
            },
          },
          el("span.label", {}, `${w + 1}-${s + 1}`),
          el("div.wd-pic", {}, wordittoPicture(picture, found ? "" : "silhouette"), found ? null : el("span.q", {}, "?")),
          el("span.text", {}, invented(word) ? boardText(text, stage.board.kind) : text),
          el("span.mark", {}, found ? "✓" : open ? "›" : tr("bloqueada"))));
        });
      });
      return el("div.screen", {},
        el(`div.column${twoColumns ? ".wide" : ""}`, {},
          el("div.topbar", {}, backButton(), title("h2", "Wordittos"),
            el("span.count", {}, `${progress.wordittos.length}/${core.WORDITTO_PICTURES}`)),
          el(twoColumns ? "div.wordittos-columns" : "div", {}, columns),
        ),
      );
    },
  };
}

// ---- Options ----

function optionRows(sections) {
  return el("div.options", {}, sections.map(([name, columns, items], i) => [
    el("div.section-title", {}, sticker(FACES[i % FACES.length], "face"), name),
    el("div.option-row", { style: { gridTemplateColumns: `repeat(${columns}, 1fr)` } },
      items.map(([label, isOn, toggle]) => el(`button.opt${isOn() ? ".on" : ""}`, {
        onclick: () => {
          toggle();
          refresh();
        },
      }, label))),
  ]));
}

function optionsScreen() {
  const swatch = (hex) => el("span.swatch", { style: { background: `#${hex.toString(16).padStart(6, "0")}` } });
  const lookSections = () => [
    [tr("Tema"), 2, Object.entries(THEMES).map(([id, theme]) => [tr(theme.name), () => settings.theme === id, () => useTheme(id)])],
    [tr("Tamaño de letra"), 3, LETTER_SIZES.map((name, i) => [tr(name), () => settings.letterSize === i, () => (settings.letterSize = i)])],
    [tr("Color de selección"), 3, SELECTION_COLORS.map(([name, hex], i) =>
      [el("span", {}, swatch(hex), tr(name)), () => settings.selectionColor === i, () => (settings.selectionColor = i)])],
    [tr("Colores de las palabras"), 3, [
      ...PALETTES.slice(0, BASIC_PALETTES).map(([name, colors], i) =>
        [el("span", {}, el("span.swatches", {}, colors.map(swatch)), tr(name)), () => settings.palette === i, () => (settings.palette = i)]),
      // The other palettes, on their own screen; on while one of them is in use, with its name.
      [settings.palette >= BASIC_PALETTES && PALETTES[settings.palette] ? tr(PALETTES[settings.palette][0]) : tr("Más…"),
        () => settings.palette >= BASIC_PALETTES, () => push(palettesScreen())],
    ]],
  ];
  const generalSections = () => {
    const sections = [
      [tr("Idioma"), 4, [
        [tr("Sistema"), () => !settings.language, () => setLanguage("")],
        ...LANGUAGES.map(([code, name]) => [name, () => settings.language === code, () => setLanguage(code)]),
      ]],
      [tr("Sonido"), 2, [
        [tr("Sí"), () => settings.sound, () => { settings.sound = true; sound.enabled = true; play("found"); }],
        [tr("No"), () => !settings.sound, () => { settings.sound = false; sound.enabled = false; }],
      ]],
    ];
    if (navigator.vibrate) {
      sections.push([tr("Vibración"), 2, [
        [tr("Sí"), () => settings.vibration, () => { settings.vibration = true; navigator.vibrate(30); }],
        [tr("No"), () => !settings.vibration, () => (settings.vibration = false)],
      ]]);
    }
    sections.push([tr("Botón para borrar la selección"), 2, [
      [tr("Sí"), () => settings.clearButton, () => (settings.clearButton = true)],
      [tr("No"), () => !settings.clearButton, () => (settings.clearButton = false)],
    ]]);
    return sections;
  };
  const tab = (label, index) => el(`button.tab${optionsTab === index ? ".on" : ""}`, { onclick: () => { optionsTab = index; refresh(); } }, label);
  return {
    paws: () => `options/${optionsTab}`,
    render() {
      return el("div.screen", {},
        el("div.column", {},
          el("div.topbar", {}, backButton(), title("h2", tr("Opciones")), el("span")),
          el("div.tabs", {}, tab(tr("Aspecto"), 0), tab(tr("General"), 1)),
          optionsTab === 0 ? [optionRows(lookSections()), lettersSample()] : [
            optionRows(generalSections()),
            el("div.links", {},
              el("a.opt", { href: PLAY_STORE }, tr("Valóranos")),
              el("a.opt", { href: `../privacy.html?lang=${language}` }, tr("Privacidad"))),
          ],
          el("div", { style: { height: "24px" } }),
        ),
      );
    },
    hidden: saveSettings,
  };
}

/** A row of cells as big as a puzzle starts with at this letter size: the first two selected, the others found. */
function lettersSample() {
  const word = tr("LETRAS"), palette = (PALETTES[settings.palette] ?? PALETTES[0])[1];
  const across = CELLS_ACROSS[settings.letterSize] ?? CELLS_ACROSS[0];
  const side = Math.min(Math.min(window.innerWidth, window.innerHeight) / across, 52 * (11 / across), (Math.min(window.innerWidth, 520) - 32) / word.length);
  const height = LETTER_HEIGHTS[settings.letterSize] ?? LETTER_HEIGHTS[0];
  return el("div.sample", {}, [...word].map((letter, i) => {
    const color = hexColor(i < 2 ? (SELECTION_COLORS[settings.selectionColor] ?? SELECTION_COLORS[0])[1] : palette[(i - 2) % palette.length]);
    const ink = letterOn(color);
    return el("span.cell", { style: { width: `${side}px`, height: `${side}px`, fontSize: `${height * side * 1.12}px`, background: `rgb(${THEMES[settings.theme].board.join(",")})` } },
      el("span", { style: { background: `rgb(${color.join(",")})`, color: `rgb(${ink.join(",")})` } }, letter));
  }));
}

/** More palettes for the words found: a line each, with its name and its colours; a tap picks one and goes back. */
function palettesScreen() {
  return {
    paws: "palettes",
    render() {
      return el("div.screen", {},
        el("div.column", {},
          el("div.topbar", {}, backButton(), title("h2", tr("Paletas")), el("span")),
          el("div.palettes", {}, PALETTES.slice(BASIC_PALETTES).map(([name, colors], i) => {
            const index = BASIC_PALETTES + i;
            return el(`button.palette${settings.palette === index ? ".on" : ""}`, {
              onclick: () => {
                settings.palette = index;
                saveSettings();
                close();
              },
            },
            sticker(FACES[i % FACES.length]),
            el("span.name", {}, tr(name)),
            el("span.colors", {}, colors.map((hex) => {
              const color = hexColor(hex), ink = letterOn(color);
              return el("span", { style: { background: `rgb(${color.join(",")})`, color: `rgb(${ink.join(",")})` } }, "A");
            })));
          })),
        ),
      );
    },
  };
}

async function setLanguage(code) {
  settings.language = code;
  saveSettings();
  await useLanguage(pickLanguage());
  refresh();
}

// ---- Custom game ----

function customScreen() {
  let seed = newSeed();
  return {
    paws: "custom",
    render() {
      const words = (amount) => core.customWordCount(custom, bank, amount);
      const sections = [
        [tr("Palabras"), 3, [
          [tr("Aleatorias"), () => custom.categories.length === 0 && custom.board === core.BoardKind.Letters, () => {
            custom.categories = [];
            custom.board = core.BoardKind.Letters;
          }],
          ...bank.categories.map((category) => [category.name, () => custom.categories.includes(category.id), () => toggleCategory(category.id)]),
          ...[[tr("Pocas letras"), core.BoardKind.FewLetters], [tr("Símbolos"), core.BoardKind.Symbols], [tr("Emojis"), core.BoardKind.Emoji],
            [tr("Números"), core.BoardKind.Numbers]].map(([label, kind]) => [label, () => custom.board === kind, () => {
            custom.categories = [];
            custom.board = kind;
          }]),
        ]],
        [tr("Tamaño"), 4, core.CUSTOM_SIZES.map((side, i) => [`${side}×${side}`, () => custom.size === i, () => (custom.size = i)])],
        [tr("Cantidad de palabras"), 3, AMOUNTS.map((name, i) => [`${tr(name)} · ${words(i)}`, () => custom.amount === i, () => (custom.amount = i)])],
        [tr("Formas"), 3, [
          [tr("Horizontal"), "horizontal"], [tr("Vertical"), "vertical"], [tr("Diagonal"), "diagonal"], [tr("Del revés"), "reversed"],
          [tr("Serpiente recta"), "snakeOrthogonal"], [tr("Serpiente libre"), "snake"],
        ].map(([label, field]) => [label, () => custom[field], () => (custom[field] = !custom[field])])],
        [tr("Tiempo"), 5, core.TIME_LIMITS.map((minutes, i) =>
          [minutes === 0 ? tr("Sin límite") : tr("{0} min", minutes), () => custom.timeLimit === i, () => (custom.timeLimit = i)])],
      ];
      const canPlay = core.customShapes(custom) !== 0;
      return el("div.screen", {},
        el("div.column", {},
          el("div.topbar", {}, backButton(), title("h2", tr("Partida custom")), el("span")),
          optionRows(sections),
          el("div.seed-row", {},
            el("span.label", {}, tr("Semilla {0}", seed)),
            el("button.opt", { onclick: () => { seed = newSeed(); refresh(); } }, tr("Nueva")),
            el("button.opt", { onclick: () => push(seedScreen((typed) => (seed = typed))) }, tr("Escribir")),
            el("button.opt", { onclick: () => share(shareUrl(custom, seed, language), seed), disabled: !canPlay }, tr("Compartir")),
          ),
          el("div.footer-actions", {},
            el("div.warning", {}, canPlay ? "" : tr("Elige al menos una forma")),
            button(tr("Jugar"), () => {
              saveCustom();
              const game = customGame({ ...custom, categories: custom.categories.slice() }, seed);
              // Back here, the next game gets a new seed; to repeat this one, it can be typed.
              seed = newSeed();
              push(puzzleScreen(game));
            }, { disabled: !canPlay }),
          ),
        ),
      );
    },
    hidden: saveCustom,
  };
}

function toggleCategory(id) {
  custom.board = core.BoardKind.Letters;
  const at = custom.categories.indexOf(id);
  if (at >= 0) custom.categories.splice(at, 1);
  else custom.categories.push(id);
  const order = bank.categories.map((category) => category.id);
  custom.categories.sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

// Six digits: short enough to note down and type again.
const newSeed = () => 100000 + Math.floor(Math.random() * 900000);

function customGame(settingsOfGame, seed, extra = {}) {
  return {
    spec: core.customSpec(settingsOfGame, bank, seed, emoji),
    seed,
    title: `Custom · ${seed}`,
    timeLimit: core.customTimeLimit(settingsOfGame),
    custom: settingsOfGame,
    world: -1,
    stage: -1,
    ...extra,
  };
}

function seedScreen(done) {
  let digits = "";
  return {
    paws: "seed",
    render() {
      const key = (label, action, disabled) => button(label, () => { action(); refresh(); }, { disabled });
      return el("div.screen.seed-pad", {},
        el("div.column", {},
          title("h1", tr("Semilla"), { style: { marginTop: "2vh" } }),
          el("p.subtitle", {}, tr("La misma semilla y opciones dan la misma sopa")),
          el("div.display", {}, digits || "_"),
          el("div.pad", {},
            [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => key(String(n), () => { if (digits.length < 9) digits += n; })),
            key(tr("Borrar"), () => (digits = digits.slice(0, -1))),
            key("0", () => { if (digits && digits.length < 9) digits += "0"; }),
            button("OK", () => { done(Number(digits)); close(); }, { disabled: !digits }),
          ),
          el("div.menu", { style: { marginTop: "20px" } }, button(tr("Volver"), close)),
        ),
      );
    },
    shown() {
      this.keys = (e) => {
        if (/^[0-9]$/.test(e.key) && digits.length < 9 && !(digits === "" && e.key === "0")) digits += e.key;
        else if (e.key === "Backspace") digits = digits.slice(0, -1);
        else if (e.key === "Enter" && digits) {
          done(Number(digits));
          close();
          return;
        } else return;
        refresh();
      };
      document.addEventListener("keydown", this.keys);
    },
    hidden() {
      document.removeEventListener("keydown", this.keys);
    },
  };
}

// ---- Sharing: the custom game's options and seed in the URL ----

function shareUrl(settingsOfGame, seed, lang) {
  const params = new URLSearchParams();
  params.set("seed", String(seed));
  params.set("lang", lang);
  params.set("size", String(core.CUSTOM_SIZES[settingsOfGame.size]));
  params.set("words", URL_AMOUNTS[settingsOfGame.amount]);
  params.set("shapes", SHAPE_LETTERS.filter(([, field]) => settingsOfGame[field]).map(([letter]) => letter).join(""));
  params.set("board", settingsOfGame.board);
  if (settingsOfGame.categories.length) params.set("cats", settingsOfGame.categories.join(","));
  const minutes = core.TIME_LIMITS[settingsOfGame.timeLimit];
  if (minutes) params.set("time", String(minutes));
  return `${location.origin}${location.pathname}?${String(params).replace(/%2C/g, ",")}`;
}

/** The custom game of a shared link, or null if it has none (or an invalid one). */
function parseShared(params) {
  const seedText = params.get("seed");
  if (seedText === null) return null;
  if (!/^-?\d{1,10}$/.test(seedText)) return { invalid: true };
  const seed = Number(seedText);
  if (seed < -2147483648 || seed > 2147483647) return { invalid: true };
  const result = core.defaultCustom();
  const size = core.CUSTOM_SIZES.indexOf(Number(params.get("size") ?? 40));
  if (size >= 0) result.size = size;
  const amount = URL_AMOUNTS.indexOf(params.get("words") ?? "normal");
  if (amount >= 0) result.amount = amount;
  const shapes = params.get("shapes");
  if (shapes !== null) for (const [letter, field] of SHAPE_LETTERS) result[field] = shapes.includes(letter);
  const board = params.get("board") ?? core.BoardKind.Letters;
  if (Object.values(core.BoardKind).includes(board)) result.board = board;
  if (result.board === core.BoardKind.Letters && params.get("cats")) {
    const order = bank.categories.map((category) => category.id);
    result.categories = order.filter((id) => params.get("cats").split(",").includes(id));
  }
  const time = core.TIME_LIMITS.indexOf(Number(params.get("time") ?? 0));
  if (time >= 0) result.timeLimit = time;
  if (core.customShapes(result) === 0) return { invalid: true };
  return { custom: result, seed };
}

async function share(url, seed) {
  const text = tr("¡Mira esta sopa de letras! Semilla {0}", seed);
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ title: "Mega Word Search", text, url });
      return;
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast(tr("Enlace copiado"));
  } catch (e) {
    // No clipboard: the link to copy by hand.
    const input = el("input.share-link", { value: url, readonly: true, onfocus: (event) => event.target.select() });
    const box = el("div.overlay.share", {},
      el("p", {}, tr("Copia este enlace para compartir la sopa:")),
      input,
      el("div.menu", {}, button("OK", () => box.remove())));
    document.body.append(box);
    input.focus();
  }
}

// ---- The puzzle ----

function resumeSaved(game) {
  if (game.kind === "stage") {
    const w = worlds.findIndex((world) => world.id === game.worldId);
    if (w >= 0 && game.stage < worlds[w].stages.length && worlds[w].stages[game.stage].seed === game.seed) {
      push(puzzleScreen(stageGame(w, game.stage, { restore: game })));
      return;
    }
  } else if (game.custom) {
    push(puzzleScreen(customGame(game.custom, game.seed, { restore: game, title: game.title })));
    return;
  }
  deleteSaved();
  refresh();
}

function deleteSaved() {
  saved = null;
  store("saved", null);
}

const HOUSE = '<svg viewBox="0 0 32 32"><path d="M16 4 2 16h4v12h8v-8h4v8h8V16h4z"/></svg>';
const BROOM = '<svg viewBox="0 0 32 32"><path d="M26.6 2.6a1.5 1.5 0 0 1 2.1 2.1l-8.1 8.1 1.6 1.6c.8.8.8 2 0 2.8l-1 1-8.5-8.5 1-1c.8-.8 2-.8 2.8 0l1.6 1.6zM11.3 11.1l8.6 8.6c-1.4 4.6-4.6 8.4-9.2 10.3-.6.3-1.3.1-1.7-.3l-.9-.9 3.3-4.4-4.6 3.2-1.6-1.6 3.2-4.6-4.4 3.3-.9-.9c-.5-.5-.6-1.1-.3-1.7 1.9-4.6 5.7-7.8 10.3-9.2z"/></svg>';

/**
 * game: { spec, seed, title, timeLimit (s), world, stage (-1 for a custom game), custom (its settings), restore (a saved
 * game), solved (a completed stage, to look at it again) }.
 */
function puzzleScreen(game) {
  const puzzle = core.generate(game.spec, bank, game.seed);
  const state = new core.PuzzleState(puzzle, game.timeLimit);
  const kind = puzzle.spec.alphabet.kind;
  const worldId = game.world >= 0 ? worlds[game.world].id : null;
  const palette = PALETTES[settings.palette]?.[1] ?? PALETTES[0][1];
  const selectionColor = hexColor((SELECTION_COLORS[settings.selectionColor] ?? SELECTION_COLORS[0])[1]);
  const foundColor = (index) => hexColor(palette[index % palette.length]);
  const selection = [];
  // No word to find is longer than the longest one, the Worditto included: one letter more drops the first tapped.
  const longest = Math.max(...puzzle.words.map((placed) => placed.word.letters.length), puzzle.secret ? puzzle.secret.word.letters.length : 0);
  // Docked: the word panel is a column beside the board (landscape); boardRight is where the board's view ends.
  let docked = false, boardRight = window.innerWidth, showingTutorial = false;
  let view, panelOpen = false, paused = false, overlay = null, frame = 0, last = 0, overFor = 0, resultShown = false;
  let hinted = null, hintAge = HINT_TIME, hints = null, hintsRevealed = 1, started = false;
  const elements = {};

  function snapshot() {
    return {
      kind: worldId ? "stage" : "custom",
      worldId,
      stage: game.stage,
      custom: game.custom ?? null,
      seed: game.seed,
      lang: language,
      title: game.title,
      elapsed: state.elapsed,
      found: state.found.map((placed) => placed.cells.map((cell) => [cell.row, cell.col])),
      hintsUsed: state.hintsUsed,
      secretFound: state.secretFound,
      view: view ? { x: view.position.x, y: view.position.y, zoom: view.zoom } : null,
    };
  }

  function saveGame() {
    if (game.solved || state.isOver) return;
    saved = snapshot();
    store("saved", saved);
  }

  function restore() {
    const r = game.restore;
    for (const path of r.found || []) {
      const placed = state.tryFind(path.map(([row, col]) => ({ row, col })));
      if (placed) view.animator.found(placed.cells, foundColor(state.found.length - 1), true);
    }
    state.resume(r.elapsed || 0);
    state.hintsUsed = Math.min(Math.max(r.hintsUsed || 0, 0), core.MAX_HINTS);
    state.secretFound = !!r.secretFound && !!puzzle.secret;
    if (state.secretFound) view.animator.found(puzzle.secret.cells, WORDITTO_COLOR, true);
    if (r.view) view.show({ x: r.view.x, y: r.view.y }, r.view.zoom);
  }

  function showSolved() {
    for (const placed of puzzle.words) {
      if (state.tryFind(placed.cells)) view.animator.found(placed.cells, foundColor(state.found.length - 1), true);
    }
    state.resume(progress.bestTimes[core.progressKey(worldId, game.stage)] ?? 0);
    state.secretFound = progress.wordittos.includes(core.progressKey(worldId, game.stage)) && !!puzzle.secret;
    if (state.secretFound) view.animator.found(puzzle.secret.cells, WORDITTO_COLOR, true);
    else if (puzzle.secret) hints = wordittoHints(core.wordittoFor(worlds[game.world].stages[game.stage], bank));
    resultShown = true;
  }

  // -- Layout --

  function layout() {
    const bar = elements.bar.offsetHeight, width = window.innerWidth, height = window.innerHeight;
    const wasDocked = docked;
    docked = width > height;
    elements.root.classList.toggle("docked", docked);
    view.startWidth = Math.min(width, height);
    if (docked) {
      const panelWidth = Math.min(Math.max(width * PANEL_SHARE, MIN_PANEL_WIDTH), MAX_PANEL_WIDTH);
      boardRight = width - panelWidth;
      elements.panel.style.top = `${bar}px`;
      elements.panel.style.width = `${panelWidth}px`;
      view.setView(0, bar, boardRight, height - bar);
    } else {
      boardRight = width;
      elements.panel.style.top = elements.panel.style.width = "";
      const head = elements.panel.querySelector(".head").offsetHeight + parseFloat(getComputedStyle(elements.panel).paddingBottom || 0);
      view.setView(0, bar, width, height - bar - head);
    }
    if (docked !== wasDocked && started) renderPanel();
    if (docked && showingTutorial) closeTutorial();
    if (elements.minimap) {
      elements.minimap.style.top = `${bar + 8}px`;
      elements.minimap.style.right = `${width - boardRight + 8}px`;
    }
    placeClear();
    view.dirty = true;
  }

  function placeClear() {
    const clear = elements.clear;
    const margin = 14;
    if (docked) {
      // At the right end of the docked panel's header, where it covers nothing.
      const radius = DOCKED_CLEAR_RADIUS;
      clear.style.width = clear.style.height = `${2 * radius}px`;
      clear.style.left = `${window.innerWidth - margin - 2 * radius}px`;
      clear.style.top = `${view.view.y + 26 - radius}px`;
      clear.classList.toggle("hidden", !settings.clearButton || selection.length < 2);
      return;
    }
    const bottom = showingTutorial ? elements.tutorial.offsetTop : view.view.y + view.view.h;
    const radius = CLEAR_RADIUS;
    clear.style.width = clear.style.height = `${2 * radius}px`;
    const y = bottom - margin - radius;
    const right = boardRight - margin - radius, left = margin + radius;
    const stuck = (x, onRight) => {
      const topLeft = view.toScreen(0, 0), bottomRight = view.toScreen(puzzle.grid.width, puzzle.grid.height);
      if (x + radius <= topLeft.x || x - radius >= bottomRight.x || y + radius <= topLeft.y || y - radius >= bottomRight.y) return false;
      const slack = view.zoom / 2;
      const bottomInView = bottomRight.y <= bottom + slack;
      const sideInView = onRight ? bottomRight.x <= boardRight + slack : topLeft.x >= -slack;
      return bottomInView && sideInView;
    };
    const rightFree = !stuck(right, true), leftFree = !stuck(left, false);
    const x = rightFree || !leftFree ? right : left;
    clear.style.left = `${x - radius}px`;
    clear.style.top = `${y - radius}px`;
    const visible = settings.clearButton && selection.length >= 2 && !panelOpen && (rightFree || leftFree);
    clear.classList.toggle("hidden", !visible);
  }

  // -- Playing --

  function onTap(cell) {
    if (paused || overlay) return;
    if (state.isOver && (!puzzle.secret || state.secretFound)) return;
    const at = selection.findIndex((c) => c.row === cell.row && c.col === cell.col);
    const added = at < 0;
    if (added) {
      selection.push(cell);
      if (selection.length > longest) view.animator.setSelected(selection.shift(), false);
    } else selection.splice(at, 1);
    view.animator.setSelected(cell, added);
    view.dirty = true;
    play("tick", added ? -0.4 + 0.06 * selection.length : -0.7);
    placeClear();
    if (!added) return;

    const placed = state.tryFindTapped(selection);
    if (!placed) {
      const secret = state.tryFindSecret(selection);
      if (secret) foundSecret(secret);
      return;
    }
    // Letters tapped by mistake are deselected with it.
    deselectAll();
    view.animator.found(placed.cells, foundColor(state.found.length - 1));
    if (hinted && hinted.word === placed.word) hintAge = HINT_TIME;
    if (!state.isComplete) {
      play("found");
      vibrate(30);
    }
    placeClear();
    renderPanel();
    saveGame();
  }

  function foundSecret(secret) {
    deselectAll();
    hints = null;
    view.animator.found(secret.cells, WORDITTO_COLOR);
    confetti(GOLD);
    play("complete");
    vibrate([40, 60, 40]);
    if (worldId && !progress.wordittos.includes(core.progressKey(worldId, game.stage))) {
      progress.wordittos.push(core.progressKey(worldId, game.stage));
      saveProgress();
    }
    const word = invented(secret.word) ? spaced(secret.word.text) : secret.word.text;
    const reveal = el("div.reveal", { onclick: () => { reveal.remove(); overlay = null; } },
      el("div.rays"),
      wordittoPicture(core.wordittoPicture(worlds, game.world, game.stage)),
      el("h3", {}, tr("¡Worditto conseguido!")),
      el("div.word", {}, boardText(word, kind)));
    overlay = reveal;
    elements.root.append(reveal);
    placeClear();
    renderPanel();
    saveGame();
  }

  function deselectAll() {
    for (const cell of selection) view.animator.setSelected(cell, false);
    selection.length = 0;
  }

  function clearSelection() {
    deselectAll();
    play("tick", -0.7);
    view.dirty = true;
    placeClear();
  }

  function useHint() {
    if (paused || overlay) return;
    const placed = state.useHint(view.centerCell());
    if (!placed) return;
    hinted = placed;
    hintAge = 0;
    view.glideTo(placed.cells[0], Math.max(view.zoom, view.startWidth / HINT_CELLS_ACROSS));
    play("hint");
    updateBar();
    saveGame();
  }

  function vibrate(pattern) {
    if (settings.vibration && navigator.vibrate) navigator.vibrate(pattern);
  }

  // -- Pause and result --

  function showOverlay(content) {
    overlay?.remove();
    overlay = el("div.overlay", {}, content);
    elements.root.append(overlay);
    view.cancelPointers();
  }

  function hideOverlay() {
    overlay?.remove();
    overlay = null;
    paused = false;
    last = 0;
  }

  function pause() {
    if (paused) return;
    paused = true;
    saveGame();
    showOverlay([
      el("h2", {}, tr("Pausa")),
      el("p.sub", {}, game.title),
      el("div.menu", {},
        button(tr("Continuar"), hideOverlay),
        game.custom ? button(tr("Compartir"), () => share(shareUrl(game.custom, game.seed, language), game.seed), { cls: "secondary" }) : null,
        button(tr("Salir"), close),
      ),
    ]);
  }

  function showResult() {
    resultShown = true;
    const lines = [el("p", {}, tr("Tiempo: {0}", formatTime(state.elapsed))), el("p", {}, tr("Palabras: {0}/{1}", state.found.length, state.wordCount))];
    if (state.isTimeUp) {
      // A long list would not fit: the first ones and how many more.
      const missing = state.pending;
      const list = el("span", {}, missing.slice(0, 15).map((word, i) => [i ? ", " : "", boardText(word.text, kind)]));
      const text = missing.length > 15 ? tr("{0} y {1} más", "\u0000", missing.length - 15) : "\u0000";
      const [before, after] = tr("Faltaban: {0}.", text).split("\u0000");
      lines.push(el("p", {}, before, list, after));
    }
    const next = state.isComplete ? nextStage() : null;
    showOverlay([
      el("h2", {}, state.isComplete ? tr("¡Completada!") : tr("Se acabó el tiempo")),
      el("p.sub", {}, game.title),
      lines,
      el("div.menu", {},
        next ? button(tr("Siguiente fase"), () => push(puzzleScreen(stageGame(next[0], next[1])), { replace: true })) : null,
        game.custom ? button(tr("Compartir"), () => share(shareUrl(game.custom, game.seed, language), game.seed), { cls: "secondary" }) : null,
        button(tr("Ver tablero"), () => { hideOverlay(); }),
        button(tr("Salir"), close),
      ),
    ]);
    paused = false;
  }

  function nextStage() {
    if (!worldId) return null;
    const [w, s] = game.stage + 1 < worlds[game.world].stages.length ? [game.world, game.stage + 1] : [game.world + 1, 0];
    if (w >= worlds.length || !core.isStageUnlocked(progress, worlds, w, s)) return null;
    return [w, s];
  }

  function finished() {
    if (saved && saved.seed === game.seed && saved.kind === (worldId ? "stage" : "custom") && (!worldId || (saved.worldId === worldId && saved.stage === game.stage))) {
      deleteSaved();
    }
    if (!worldId || !state.isComplete) return;
    const key = core.progressKey(worldId, game.stage);
    if (!(key in progress.bestTimes) || state.elapsed < progress.bestTimes[key]) progress.bestTimes[key] = Math.round(state.elapsed * 10) / 10;
    saveProgress();
  }

  // -- Help shown once: how to play (first stage) and how snakes go (their challenges) --

  /** The first stage's window, in three pages: tapping a word's letters, dragging the board and zooming it. */
  function showBasics() {
    const touch = matchMedia("(pointer: coarse)").matches;
    const pages = [
      [tr("Encontrar palabras"), tr(touch ? "Toca las letras de una palabra, una a una. En cuanto estén todas, la palabra cuenta sola: no hay que pulsar nada más."
        : "Haz clic en las letras de una palabra, una a una. En cuanto estén todas, la palabra cuenta sola: no hay que pulsar nada más."), drawTapping],
      [tr("Mover el tablero"), tr(touch ? "El tablero es más grande que la pantalla: arrástralo con un dedo para ver el resto."
        : "El tablero es más grande que la ventana: arrástralo con el ratón para ver el resto."), drawDragging],
      [tr("Acercar y alejar"), tr(touch ? "Pellizca con dos dedos para acercar o alejar el tablero: sepáralos para ver las letras más grandes y júntalos para ver más tablero."
        : "Usa la rueda del ratón para acercar o alejar el tablero: las letras se ven más grandes o se ve más tablero."), drawZooming],
    ];
    paused = true;
    const showPage = (page) => {
      const [heading, rule, draw] = pages[page];
      const canvas = el("canvas.help-board", { width: HELP_SIDE * HELP_CELL * 2, height: HELP_SIDE * HELP_CELL * 2 });
      showOverlay(el("div.help-box", {},
        title("h3", heading),
        canvas,
        el("p", {}, rule),
        el("div.help-foot", {},
          el("span", {}, `${page + 1}/${pages.length}`),
          button(page < pages.length - 1 ? tr("Siguiente") : tr("Entendido"), () => {
            if (page < pages.length - 1) {
              showPage(page + 1);
              return;
            }
            settings.tutorialDone = true;
            saveSettings();
            hideOverlay();
            showTutorial();
          }))));
      const ctx = canvas.getContext("2d");
      ctx.scale(2, 2);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let begin = 0;
      const step = (now) => {
        if (!canvas.isConnected) return;
        if (!begin) begin = now;
        draw(ctx, (now - begin) / 1000, touch);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    showPage(0);
  }

  const smooth = (x) => x * x * (3 - 2 * x);

  function drawHelpLetter(ctx, letter, x, y, size, color) {
    ctx.font = `${size}px "Ubuntu Mono", monospace`;
    ctx.fillStyle = color;
    ctx.fillText(letter, x, y + size * 0.04);
  }

  function drawFinger(ctx, x, y, pressing) {
    const radius = HELP_CELL * (pressing ? 0.3 : 0.36);
    const disc = (dx, dy, r, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
      ctx.fill();
    };
    disc(2, 3, radius, "rgba(0,0,0,0.3)");
    disc(0, 0, radius, "rgb(44,48,58)");
    disc(0, 0, radius - 3, "rgba(255,255,255,0.92)");
  }

  const helpBoard = () => `rgb(${THEMES[settings.theme].board.join(",")})`;

  /** A finger taps the word's letters in turn; each lights up, and the whole word turns found. */
  function drawTapping(ctx, age) {
    const word = tr("LETRA").slice(0, HELP_SIDE), cell = HELP_CELL, side = HELP_SIDE * cell;
    ctx.fillStyle = helpBoard();
    ctx.fillRect(0, 0, side, side);
    const t = age % (word.length * STEP_TIME + HOLD_TIME);
    const tapped = Math.min(word.length, Math.floor(t / STEP_TIME + 0.25));
    const complete = tapped === word.length;
    const first = Math.floor((HELP_SIDE - word.length) / 2);
    const center = (col) => [(col + 0.5) * cell, (HELP_WORD_ROW + 0.5) * cell];
    const color = complete ? foundColor(0) : selectionColor;
    for (let i = 0; i < tapped; i++) {
      const [x, y] = center(first + i);
      ctx.fillStyle = `rgb(${color.join(",")})`;
      ctx.beginPath();
      ctx.arc(x, y, cell * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let row = 0; row < HELP_SIDE; row++) {
      for (let col = 0; col < HELP_SIDE; col++) {
        const index = row === HELP_WORD_ROW ? col - first : -1;
        const inWord = index >= 0 && index < word.length;
        const letter = inWord ? word[index] : HELP_FILLER[row * HELP_SIDE + col];
        drawHelpLetter(ctx, letter, (col + 0.5) * cell, (row + 0.5) * cell, cell * 0.6,
          inWord && index < tapped ? `rgb(${letterOn(color).join(",")})` : "rgb(44,48,58)");
      }
    }
    if (complete) return;
    const stepAt = Math.floor(t / STEP_TIME), within = t / STEP_TIME - stepAt;
    const [toX, toY] = center(first + Math.min(stepAt, word.length - 1));
    const [fromX, fromY] = stepAt === 0 ? [side * 0.5, side + cell * 0.6] : center(first + stepAt - 1);
    const move = smooth(Math.min(1, within / 0.55));
    drawFinger(ctx, fromX + (toX - fromX) * move + cell * 0.18, fromY + (toY - fromY) * move + cell * 0.22, within > 0.6 && within < 0.85);
  }

  /** How far along a there-and-back movement is, and whether it is moving now (not at a pause). */
  function helpSwing(age, time) {
    const t = age % (2 * (time + REST_TIME));
    const along = t < time ? smooth(t / time) : t < time + REST_TIME ? 1 : t < 2 * time + REST_TIME ? 1 - smooth((t - time - REST_TIME) / time) : 0;
    return [along, t < time || (t >= time + REST_TIME && t < 2 * time + REST_TIME)];
  }

  /** A board bigger than its window, dragged by a finger to show its far corner, and back. */
  function drawDragging(ctx, age) {
    const cell = HELP_CELL, side = HELP_SIDE * cell;
    const [along, moving] = helpSwing(age, DRAG_TIME);
    const offset = (HELP_BIG_SIDE - HELP_SIDE) * cell * along;
    ctx.fillStyle = helpBoard();
    ctx.fillRect(0, 0, side, side);
    for (let row = 0; row < HELP_BIG_SIDE; row++) {
      for (let col = 0; col < HELP_BIG_SIDE; col++) {
        drawHelpLetter(ctx, HELP_FILLER[(row * HELP_BIG_SIDE + col) % HELP_FILLER.length], (col + 0.5) * cell - offset, (row + 0.5) * cell - offset, cell * 0.6, "rgb(44,48,58)");
      }
    }
    drawFinger(ctx, side * 0.72 - offset * 0.85, side * 0.72 - offset * 0.85, moving);
  }

  /** The board grows around its middle and shrinks back, while two fingers (on a phone) move apart and together. */
  function drawZooming(ctx, age, touch) {
    const cell = HELP_CELL, side = HELP_SIDE * cell;
    const [along, moving] = helpSwing(age, ZOOM_TIME);
    const zoomed = cell * (1 + (HELP_MAX_ZOOM - 1) * along);
    ctx.fillStyle = helpBoard();
    ctx.fillRect(0, 0, side, side);
    for (let row = 0; row < HELP_SIDE; row++) {
      for (let col = 0; col < HELP_SIDE; col++) {
        drawHelpLetter(ctx, HELP_FILLER[(row * HELP_SIDE + col + 7) % HELP_FILLER.length],
          side / 2 + (col + 0.5 - HELP_SIDE / 2) * zoomed, side / 2 + (row + 0.5 - HELP_SIDE / 2) * zoomed, zoomed * 0.6, "rgb(44,48,58)");
      }
    }
    if (!touch) return;
    const apart = side * (0.14 + 0.2 * along);
    drawFinger(ctx, side / 2 - apart, side / 2 - apart, moving);
    drawFinger(ctx, side / 2 + apart, side / 2 + apart, moving);
  }

  /** After the window, its first step on the real screen: opening the word list (docked, it is always open). */
  function showTutorial() {
    if (docked) return;
    const touch = matchMedia("(pointer: coarse)").matches;
    showingTutorial = true;
    elements.tutorial = el("div.tutorial", {},
      el("p", {}, tr(touch ? "Toca «Palabras», abajo, para ver las palabras que hay que buscar." : "Haz clic en «Palabras», abajo, para ver las palabras que hay que buscar.")),
      button(tr("Siguiente"), closeTutorial));
    elements.root.append(elements.tutorial);
    placeClear();
  }

  function closeTutorial() {
    if (!showingTutorial) return;
    showingTutorial = false;
    elements.tutorial.remove();
    placeClear();
  }

  function helpFirst() {
    if (game.solved || game.restore) return;
    let title = null, texts = null, done = null;
    if (game.world === 0 && game.stage === 0 && !settings.tutorialDone) {
      showBasics();
      return;
    } else if (worldId && (puzzle.spec.shapes & (core.Shape.Snake | core.Shape.SnakeOrthogonal)) && !settings.helpsSeen.includes(worldId)) {
      title = tr("Palabras en serpiente");
      texts = [puzzle.spec.shapes & core.Shape.Snake
        ? "En este desafío las palabras giran también en diagonal: cada letra está en cualquiera de las 8 casillas de alrededor de la anterior, sin repetir casillas."
        : "En este desafío las palabras pueden girar: cada letra está arriba, abajo, a la izquierda o a la derecha de la anterior, sin repetir casillas."];
      done = () => settings.helpsSeen.push(worldId);
    }
    if (!title) return;
    paused = true;
    showOverlay([
      el("h2", {}, title),
      texts.map((text) => el("p", { style: { marginTop: "12px" } }, tr(text))),
      el("div.menu", {}, button(tr("Entendido"), () => {
        done();
        saveSettings();
        hideOverlay();
      })),
    ]);
  }

  // -- The word panel --

  function renderPanel() {
    const panel = elements.panel;
    const open = panelOpen || docked;
    panel.classList.toggle("open", open);
    const head = panel.querySelector(".head");
    // At the bottom, the bar also shows the next word to find; docked, the panel neither unfolds nor folds.
    const next = !docked && !hints ? wordGroups().flatMap((group) => group.words).find((word) => !state.isFound(word)) : null;
    head.replaceChildren(
      el(`span.count${state.isComplete ? ".complete" : ""}`, {}, hints ? tr("Pistas del Worditto") : tr("Palabras {0}/{1}", state.found.length, state.wordCount)),
      el("span.next", {}, next ? boardText(next.text, kind) : null),
      el("span.act", {}, docked ? "" : panelOpen ? tr("ocultar") : tr("ver")));
    const list = panel.querySelector(".words");
    if (!open) {
      list.replaceChildren();
      return;
    }
    if (hints) {
      list.replaceChildren(
        el("h4", {}, tr("Toca el ojo para ver otra pista")),
        el("ul.one.hints", {}, hints.map((hint, i) => el("li", {},
          i < hintsRevealed ? boardText(invented(puzzle.secret.word) ? spaced(hint) : hint, kind)
            : el("button.eye", { onclick: () => { hintsRevealed = i + 1; renderPanel(); }, "aria-label": "?" }, "👁")))),
      );
      return;
    }
    const symbols = kind === core.BoardKind.Symbols;
    list.replaceChildren(...wordGroups().map((group) => [
      el("h4", {}, group.id === core.INVENTED_CATEGORY ? tr("Palabras inventadas") : bank.contains(group.id) ? bank.get(group.id).name : group.id),
      el(`ul${symbols ? ".one.big" : ""}`, {}, group.words
        .map((word) => el(`li${state.isFound(word) ? ".found" : ""}`, {}, boardText(word.text, kind)))),
    ]).flat());
  }

  /** The words by category, as the list shows them. */
  function wordGroups() {
    const groups = [];
    for (const placed of puzzle.words) {
      let group = groups.find((g) => g.id === placed.word.category);
      if (!group) groups.push((group = { id: placed.word.category, words: [] }));
      group.words.push(placed.word);
    }
    const collator = new Intl.Collator("es", { sensitivity: "base" });
    for (const group of groups) group.words.sort((a, b) => collator.compare(a.text, b.text));
    return groups;
  }

  // -- Each frame --

  function updateBar() {
    const remaining = state.remaining;
    const time = remaining !== null ? formatTime(remaining, true) : formatTime(state.elapsed);
    if (elements.time.textContent !== time) elements.time.textContent = time;
    elements.time.classList.toggle("warn", remaining !== null && remaining <= WARNING_TIME && !state.isComplete);
    elements.hint.textContent = `? ${state.hintsLeft}`;
    elements.hint.disabled = state.hintsLeft <= 0 || state.isOver;
  }

  function tick(now) {
    frame = requestAnimationFrame(tick);
    // The clock follows real time (frames may come slowly); animations take at most a short step.
    const real = last ? Math.min(1, (now - last) / 1000) : 0;
    const seconds = Math.min(0.1, real);
    last = now;
    if (!paused && !overlay && !document.hidden) state.tick(real);
    view.update(seconds);
    hintAge = Math.min(HINT_TIME, hintAge + seconds);
    if (hinted && hintAge < HINT_TIME) {
      const pulse = 0.5 + 0.5 * Math.sin(hintAge * Math.PI * 4);
      const fade = Math.min(1, Math.max(0, (HINT_TIME - hintAge) / 0.5));
      view.highlight = { cell: hinted.cells[0], color: `rgba(${TITLE_COLOR.join(",")},${fade})`, width: 0.9 + 0.35 * pulse };
    } else if (view.highlight) {
      view.highlight = null;
      view.dirty = true;
    }
    if (state.isTimeUp && !view.extraMarks.length) {
      view.extraMarks = puzzle.words.filter((placed) => !state.isFound(placed.word))
        .flatMap((placed) => placed.cells.map((cell) => ({ cell, color: MISSING_COLOR, reveal: 1, scale: 1, white: 0, outline: true })));
      view.dirty = true;
    }
    if (elements.minimap) {
      const shown = !(panelOpen && !docked) && view.minimapWanted();
      elements.minimap.classList.toggle("hidden", !shown);
    }
    if (view.dirty) placeClear();
    view.draw();
    updateBar();

    if (state.isOver && !resultShown) {
      if (overFor === 0) {
        finished();
        if (state.isComplete) {
          confetti(palette.map((hex) => `#${hex.toString(16).padStart(6, "0")}`));
          play("complete");
          vibrate([40, 60, 40]);
        }
        renderPanel();
      }
      overFor += seconds || 0.016;
      if (overFor >= (state.isComplete ? COMPLETE_DELAY : RESULT_DELAY) && !overlay) showResult();
    }
  }

  // -- Confetti --

  function confetti(colors) {
    const canvas = el("canvas.confetti");
    elements.root.append(canvas);
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const pieces = Array.from({ length: 140 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3, y: h * 0.45,
      vx: (Math.random() - 0.5) * w * 1.4, vy: -h * (0.6 + Math.random() * 0.8),
      size: 5 + Math.random() * 6, angle: Math.random() * 6, spin: (Math.random() - 0.5) * 12,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    let start = 0, previous = 0;
    const step = (now) => {
      if (!start) start = previous = now;
      const dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      const t = (now - start) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = Math.max(0, Math.min(1, 3 - t));
      for (const p of pieces) {
        p.vy += h * 1.3 * dt;
        p.vx *= 1 - 1.2 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.angle += p.spin * dt;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      if (t < 3) requestAnimationFrame(step);
      else canvas.remove();
    };
    requestAnimationFrame(step);
  }

  // -- The screen --

  const onResize = () => layout();
  const onKey = (e) => {
    if (e.key === "Escape") {
      if (paused && overlay) hideOverlay();
      else if (!overlay) pause();
    }
  };
  const onVisibility = () => {
    if (document.hidden && !state.isOver && !paused && !overlay) pause();
    if (document.hidden) saveGame();
  };

  return {
    render() {
      // Rendered once: the board view keeps its canvas.
      if (elements.root) return elements.root;
      const canvas = el("canvas.board");
      const minimap = Math.max(puzzle.grid.width, puzzle.grid.height) > MINIMAP_FROM ? el("canvas.minimap") : null;
      elements.time = el("span.time");
      elements.hint = el("button.icon-btn.hint", { onclick: useHint, "aria-label": "?" });
      const home = el("button.icon-btn", { onclick: pause, "aria-label": tr("Pausa") });
      home.innerHTML = HOUSE;
      elements.bar = el("div.pbar", {}, home, elements.hint, el("span.title", {}, game.title), elements.time);
      elements.clear = el("button.clear.hidden", { onclick: clearSelection, "aria-label": tr("Borrar") });
      elements.clear.innerHTML = BROOM;
      elements.clear.append(sticker(SLEEPING));
      elements.panel = el("div.wpanel", {},
        el("button.head", {
          onclick: () => {
            if (docked) return;
            panelOpen = !panelOpen;
            if (panelOpen) closeTutorial();
            renderPanel();
            placeClear();
          },
        }),
        el("div.words"));
      elements.minimap = minimap;
      elements.root = el("div.puzzle", {}, canvas, elements.bar, minimap, elements.clear, elements.panel);
      canvas.style.width = "100%";
      canvas.style.height = "100%";

      if (!view) {
        view = new BoardView({
          canvas, minimap, grid: puzzle.grid, kind,
          letterHeight: LETTER_HEIGHTS[settings.letterSize] ?? LETTER_HEIGHTS[0],
          cellsAcross: CELLS_ACROSS[settings.letterSize] ?? CELLS_ACROSS[0],
          selectionColor, emojiAtlas, emojiColumns: emoji.columns, onTap,
          startWidth: Math.min(window.innerWidth, window.innerHeight),
          colors: THEMES[settings.theme],
        });
        if (minimap) bindMinimap(minimap);
      }
      return elements.root;
    },
    shown() {
      layout();
      if (!started) {
        started = true;
        if (game.restore) restore();
        if (game.solved) showSolved();
        renderPanel();
        saveGame();
        helpFirst();
      }
      window.addEventListener("resize", onResize);
      document.addEventListener("keydown", onKey);
      document.addEventListener("visibilitychange", onVisibility);
      last = 0;
      frame = requestAnimationFrame(tick);
    },
    hidden() {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onVisibility);
      saveGame();
    },
    closed() {
      // A shared game's link is left behind, so a reload goes home.
      if (location.search) history.replaceState(history.state, "", location.pathname);
    },
    /** The browser's back: pauses first; true keeps the screen. */
    onBack() {
      if (state.isOver || paused) return false;
      pause();
      return true;
    },
  };

  function bindMinimap(minimap) {
    const move = (e) => {
      const rect = minimap.getBoundingClientRect();
      const world = view.minimapToWorld(e.clientX - rect.left, e.clientY - rect.top);
      view.velocity = { x: 0, y: 0 };
      view.glide = null;
      view.position = view.clampPosition(world);
      view.dirty = true;
    };
    minimap.addEventListener("pointerdown", (e) => {
      minimap.setPointerCapture(e.pointerId);
      view.minimapHeld = true;
      move(e);
    });
    minimap.addEventListener("pointermove", (e) => view.minimapHeld && move(e));
    const up = () => (view.minimapHeld = false);
    minimap.addEventListener("pointerup", up);
    minimap.addEventListener("pointercancel", up);
  }
}

// ---- Start ----

async function start() {
  settings = load("settings", {
    language: "", sound: true, vibration: true, clearButton: true, letterSize: 0, selectionColor: 0, palette: 0, theme: DEFAULT_THEME, tutorialDone: false, helpsSeen: [],
  });
  useTheme(settings.theme);
  progress = load("progress", { bestTimes: {}, wordittos: [] });
  custom = load("custom", core.defaultCustom());
  saved = load("saved", null);
  sound.enabled = settings.sound;

  const params = new URLSearchParams(location.search);
  const [strings, emojiData, worldsData] = await Promise.all([
    fetchJson("content/strings.json"), fetchJson("content/emoji.json"), fetchJson("content/worlds.json"),
    document.fonts ? document.fonts.load('20px "Ubuntu Mono"').catch(() => null) : null,
    document.fonts ? document.fonts.load('bold 20px "Baloo 2"').catch(() => null) : null,
  ]);
  content.strings = strings;
  emoji = core.makeEmojiCatalog(emojiData);
  worlds = core.makeWorlds(worldsData, emoji);
  emojiAtlas = await loadImage("content/emoji-atlas.png");
  if (document.fonts) document.fonts.load('20px "Noto Sans Symbols 2"', "♠").catch(() => null);
  await useLanguage(pickLanguage(params.get("lang")));

  history.replaceState({ depth: 1 }, "");
  stack.push(homeScreen());
  show();

  const shared = parseShared(params);
  if (shared?.invalid) {
    history.replaceState(history.state, "", location.pathname);
    toast(tr("Este enlace no tiene una partida válida"));
  } else if (shared) {
    push(puzzleScreen(customGame(shared.custom, shared.seed)));
  }
}

start().catch((error) => {
  console.error(error);
  app.replaceChildren(el("p.loading", {}, "Mega Word Search could not start. Reload the page to try again."));
});
