// The board on a canvas (see Board/BoardRenderer, Camera2D, CellAnimator and DragGesture in the game): a camera
// that pans with inertia and zooms, taps that select letters, the rounded squares of selected and found letters
// with their animations, and a minimap.
import { isEmoji, emojiIndex, BoardKind } from "./core.js";

const SQUARE = 0.86;
// Cell size on screen (device pixels) where letters start to show and where they are opaque.
const LETTERS_FROM = 7;
const LETTERS_FULL = 12;
const EDGE = 0.12;
const MAX_ZOOM = 96;
// Room the board may leave between its edge and the view's (CSS pixels).
const MARGIN = 24;
const FRICTION = 4;
// How far a pointer moves before a tap becomes a drag (CSS pixels).
const TAP_SLOP = 10;
const WHEEL_ZOOM = 1.15;

const SELECT_TIME = 0.18;
const FOUND_TIME = 0.24;
const STAGGER = 0.07;
const BOUNCE = 0.18;

const BOARD = [246, 241, 228];
const BOARD_EDGE = "rgb(170,150,120)";
const LETTER = [44, 48, 58];
const MINIMAP_FRAME = "rgba(24,32,48,0.78)";
const MINIMAP_VIEW = "rgb(52,104,168)";

const key = (cell) => cell.row * 100000 + cell.col;
const ease = (t) => 1 - (1 - t) * (1 - t);
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c, alpha = 1) => `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
export const hexColor = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];

/** The animations of the squares under the letters (CellAnimator). */
class CellAnimator {
  constructor(selectionColor) {
    this.selectionColor = selectionColor;
    this.looks = new Map();
    this.time = 0;
  }
  look(cell) {
    let look = this.looks.get(key(cell));
    if (!look) {
      look = { cell, select: 0, selected: false, found: false, from: null, to: null, start: 0 };
      this.looks.set(key(cell), look);
    }
    return look;
  }
  setSelected(cell, selected) {
    this.look(cell).selected = selected;
  }
  found(cells, color, instant = false) {
    cells.forEach((cell, i) => {
      const look = this.look(cell);
      look.from = instant ? color : look.found && look.select <= 0 ? look.to : this.selectionColor;
      look.to = color;
      look.found = true;
      look.start = instant ? -Infinity : this.time + (cells.length - 1 - i) * STAGGER;
      look.select = 0;
      look.selected = false;
    });
  }
  update(seconds) {
    this.time += seconds;
    const step = seconds / SELECT_TIME;
    for (const look of this.looks.values()) look.select = clamp(look.select + (look.selected ? step : -step), 0, 1);
  }
  get settled() {
    for (const look of this.looks.values()) {
      if (look.select > 0 && look.select < 1) return false;
      if (look.found && this.time < look.start + FOUND_TIME) return false;
    }
    return true;
  }
  marks() {
    const marks = [];
    for (const look of this.looks.values()) {
      if (!look.found) continue;
      const t = clamp((this.time - look.start) / FOUND_TIME, 0, 1);
      marks.push({ cell: look.cell, color: mix(look.from, look.to, ease(t)), reveal: 1, scale: 1 + BOUNCE * Math.sin(Math.PI * t), white: 1 });
    }
    for (const look of this.looks.values()) {
      if (look.select <= 0) continue;
      const reveal = ease(look.select);
      marks.push({ cell: look.cell, color: this.selectionColor, reveal, scale: 1, white: reveal });
    }
    return marks;
  }
}

export class BoardView {
  /**
   * options: { canvas, minimap (canvas or null), grid, kind (BoardKind), letterHeight, cellsAcross,
   * selectionColor [r,g,b], emojiAtlas (Image), emojiColumns, onTap(cell), onChange() }.
   */
  constructor(options) {
    Object.assign(this, options);
    this.ctx = this.canvas.getContext("2d");
    this.animator = new CellAnimator(this.selectionColor);
    this.view = { x: 0, y: 0, w: 1, h: 1 };
    this.position = { x: this.grid.width / 2, y: this.grid.height / 2 };
    this.zoom = 30;
    this.velocity = { x: 0, y: 0 };
    this.glide = null;
    this.pointers = new Map();
    this.samples = [];
    this.extraMarks = [];
    this.highlight = null;
    this.laidOut = false;
    this.dirty = true;
    this.charScale = this.kind === BoardKind.Symbols ? 1.3 : 1;
    this.farTexture = this.makeFarTexture();
    this.bindInput();
  }

  // ---- Camera ----

  get minZoom() {
    return Math.min(this.view.w / this.grid.width, this.view.h / this.grid.height) * 0.92;
  }
  get maxZoom() {
    return Math.max(MAX_ZOOM, this.minZoom);
  }

  /** Where the board is shown, in CSS pixels of the canvas. */
  setView(x, y, w, h) {
    const dpr = window.devicePixelRatio || 1;
    this.dpr = dpr;
    const cw = this.canvas.clientWidth, ch = this.canvas.clientHeight;
    if (this.canvas.width !== Math.round(cw * dpr) || this.canvas.height !== Math.round(ch * dpr)) {
      this.canvas.width = Math.round(cw * dpr);
      this.canvas.height = Math.round(ch * dpr);
    }
    this.view = { x, y, w: Math.max(1, w), h: Math.max(1, h) };
    if (!this.laidOut) {
      this.laidOut = true;
      this.reset();
    } else {
      this.zoom = clamp(this.zoom, this.minZoom, this.maxZoom);
      this.position = this.clampPosition(this.position);
    }
    this.dirty = true;
  }

  /** The starting view: centred, about cellsAcross cells across (a little bigger cells on wide screens). */
  reset() {
    const across = Math.min(this.view.w / this.cellsAcross, 52 * (11 / this.cellsAcross));
    this.zoom = clamp(across, this.minZoom, this.maxZoom);
    this.position = { x: this.grid.width / 2, y: this.grid.height / 2 };
    this.velocity = { x: 0, y: 0 };
  }

  show(position, zoom) {
    this.zoom = clamp(zoom, this.minZoom, this.maxZoom);
    this.position = this.clampPosition(position);
    this.velocity = { x: 0, y: 0 };
    this.dirty = true;
  }

  clampPosition(p, zoom = this.zoom) {
    const axis = (value, size, viewSize) => {
      const half = (viewSize / 2 - MARGIN) / zoom;
      if (size * zoom + 2 * MARGIN <= viewSize) return size / 2;
      return clamp(value, half, size - half);
    };
    return { x: axis(p.x, this.grid.width, this.view.w), y: axis(p.y, this.grid.height, this.view.h) };
  }

  toWorld(sx, sy) {
    return { x: this.position.x + (sx - this.view.x - this.view.w / 2) / this.zoom, y: this.position.y + (sy - this.view.y - this.view.h / 2) / this.zoom };
  }
  toScreen(wx, wy) {
    return { x: (wx - this.position.x) * this.zoom + this.view.x + this.view.w / 2, y: (wy - this.position.y) * this.zoom + this.view.y + this.view.h / 2 };
  }

  pan(dx, dy) {
    this.glide = null;
    this.position = this.clampPosition({ x: this.position.x - dx / this.zoom, y: this.position.y - dy / this.zoom });
    this.dirty = true;
  }

  zoomAt(sx, sy, factor) {
    this.glide = null;
    const focus = this.toWorld(sx, sy);
    this.zoom = clamp(this.zoom * factor, this.minZoom, this.maxZoom);
    this.position = this.clampPosition({
      x: focus.x - (sx - this.view.x - this.view.w / 2) / this.zoom,
      y: focus.y - (sy - this.view.y - this.view.h / 2) / this.zoom,
    });
    this.dirty = true;
  }

  /** Glides to a cell's centre, at least this zoom (a hint). */
  glideTo(cell, zoom) {
    const target = clamp(zoom, this.minZoom, this.maxZoom);
    this.glide = { position: this.clampPosition({ x: cell.col + 0.5, y: cell.row + 0.5 }, target), zoom: target };
    this.velocity = { x: 0, y: 0 };
  }

  /** The middle of the view, as a cell. */
  centerCell() {
    return { row: Math.floor(this.position.y), col: Math.floor(this.position.x) };
  }

  update(seconds) {
    this.animator.update(seconds);
    if (this.glide) {
      const t = 1 - Math.exp(-8 * seconds);
      this.position = { x: this.position.x + (this.glide.position.x - this.position.x) * t, y: this.position.y + (this.glide.position.y - this.position.y) * t };
      this.zoom += (this.glide.zoom - this.zoom) * t;
      if (Math.abs(this.glide.zoom - this.zoom) < 0.05 && Math.hypot(this.glide.position.x - this.position.x, this.glide.position.y - this.position.y) < 0.01) {
        this.position = this.glide.position;
        this.zoom = this.glide.zoom;
        this.glide = null;
      }
      this.dirty = true;
    } else if (this.pointers.size === 0 && (this.velocity.x || this.velocity.y)) {
      this.position = this.clampPosition({ x: this.position.x + this.velocity.x * seconds, y: this.position.y + this.velocity.y * seconds });
      const decay = Math.exp(-FRICTION * seconds);
      this.velocity = { x: this.velocity.x * decay, y: this.velocity.y * decay };
      if (Math.hypot(this.velocity.x, this.velocity.y) * this.zoom < 8) this.velocity = { x: 0, y: 0 };
      this.dirty = true;
    }
    if (!this.animator.settled || this.highlight) this.dirty = true;
  }

  // ---- Input: one pointer drags or taps, two pinch; the wheel zooms; the right or middle button drags ----

  bindInput() {
    const canvas = this.canvas;
    canvas.addEventListener("pointerdown", (e) => this.onDown(e));
    canvas.addEventListener("pointermove", (e) => this.onMove(e));
    canvas.addEventListener("pointerup", (e) => this.onUp(e, true));
    canvas.addEventListener("pointercancel", (e) => this.onUp(e, false));
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const lines = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
      const notches = (-e.deltaY * lines) / 100;
      const point = this.local(e);
      this.zoomAt(point.x, point.y, Math.pow(WHEEL_ZOOM, clamp(notches, -4, 4)));
      this.onChange?.("zoom");
    }, { passive: false });
  }

  local(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  onDown(e) {
    if (this.pointers.size >= 2) return;
    this.canvas.setPointerCapture(e.pointerId);
    const point = this.local(e);
    // A pointer left over from a pinch drags but never taps; so does the right or middle button.
    const canTap = this.pointers.size === 0 && e.button === 0;
    this.pointers.set(e.pointerId, { ...point, startX: point.x, startY: point.y, moved: !canTap, canTap });
    for (const other of this.pointers.values()) if (this.pointers.size > 1) other.canTap = false;
    this.velocity = { x: 0, y: 0 };
    this.glide = null;
    this.samples = [];
    this.pinch = this.pointers.size === 2 ? this.pinchInfo() : null;
  }

  pinchInfo() {
    const [a, b] = [...this.pointers.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
  }

  onMove(e) {
    const pointer = this.pointers.get(e.pointerId);
    if (!pointer) return;
    const point = this.local(e);
    const dx = point.x - pointer.x, dy = point.y - pointer.y;
    pointer.x = point.x;
    pointer.y = point.y;
    if (this.pointers.size >= 2) {
      const now = this.pinchInfo();
      this.pan(now.x - this.pinch.x, now.y - this.pinch.y);
      this.zoomAt(now.x, now.y, now.distance / this.pinch.distance);
      this.pinch = now;
      this.onChange?.("zoom");
      return;
    }
    if (!pointer.moved && Math.hypot(point.x - pointer.startX, point.y - pointer.startY) > TAP_SLOP) {
      pointer.moved = true;
      this.canvas.classList.add("panning");
      this.pan(point.x - pointer.startX - dx, point.y - pointer.startY - dy);
    }
    if (pointer.moved) {
      this.pan(dx, dy);
      this.samples.push({ t: performance.now(), dx, dy });
      this.onChange?.("pan");
    }
  }

  onUp(e, released) {
    const pointer = this.pointers.get(e.pointerId);
    if (!pointer) return;
    this.pointers.delete(e.pointerId);
    this.canvas.classList.remove("panning");
    if (this.pointers.size === 1) {
      // The finger left from a pinch carries on dragging from where it is.
      const left = [...this.pointers.values()][0];
      left.moved = true;
      left.canTap = false;
      this.pinch = null;
      this.samples = [];
      return;
    }
    if (released && pointer.canTap && !pointer.moved) {
      const world = this.toWorld(pointer.x, pointer.y);
      const cell = { row: Math.floor(world.y), col: Math.floor(world.x) };
      if (cell.row >= 0 && cell.row < this.grid.height && cell.col >= 0 && cell.col < this.grid.width) this.onTap?.(cell);
      return;
    }
    // Inertia from the last 80 ms of movement.
    const now = performance.now();
    const recent = this.samples.filter((s) => now - s.t < 80);
    if (recent.length > 1) {
      const span = Math.max(16, now - recent[0].t) / 1000;
      const sx = recent.reduce((sum, s) => sum + s.dx, 0), sy = recent.reduce((sum, s) => sum + s.dy, 0);
      this.velocity = { x: -sx / span / this.zoom, y: -sy / span / this.zoom };
    }
  }

  cancelPointers() {
    this.pointers.clear();
    this.canvas.classList.remove("panning");
  }

  // ---- Drawing ----

  makeFarTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = this.grid.width;
    canvas.height = this.grid.height;
    const ctx = canvas.getContext("2d");
    const image = ctx.createImageData(this.grid.width, this.grid.height);
    for (let i = 0; i < this.grid.letters.length; i++) {
      const c = mix(BOARD, LETTER, ink(this.grid.letters[i]));
      image.data.set([c[0], c[1], c[2], 255], i * 4);
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  }

  /** Draws the board if something changed: the squares (marks), the hint's band and the letters. */
  draw() {
    if (!this.dirty) return;
    this.dirty = false;
    const ctx = this.ctx, dpr = this.dpr || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const z = this.zoom;
    const origin = this.toScreen(0, 0);
    const W = this.grid.width, H = this.grid.height;

    ctx.fillStyle = BOARD_EDGE;
    ctx.fillRect(origin.x - EDGE * z, origin.y - EDGE * z, (W + 2 * EDGE) * z, (H + 2 * EDGE) * z);
    ctx.fillStyle = rgb(BOARD);
    ctx.fillRect(origin.x, origin.y, W * z, H * z);

    const opacity = clamp((z * dpr - LETTERS_FROM) / (LETTERS_FULL - LETTERS_FROM), 0, 1);
    if (opacity < 1) {
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = (1 - opacity) * (1 - opacity);
      ctx.drawImage(this.farTexture, origin.x, origin.y, W * z, H * z);
      ctx.globalAlpha = 1;
    }

    const marks = this.animator.marks().concat(this.extraMarks);
    const white = new Map();
    for (const mark of marks) {
      drawMark(ctx, mark, origin, z, 1);
      if (!mark.outline) white.set(key(mark.cell), Math.max(white.get(key(mark.cell)) || 0, mark.white));
    }
    if (this.highlight) {
      const { cell, color, width } = this.highlight;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(origin.x + (cell.col + 0.5) * z, origin.y + (cell.row + 0.5) * z, (width / 2) * z, 0, Math.PI * 2);
      ctx.fill();
    }

    if (opacity > 0) {
      const first = this.toWorld(this.view.x, this.view.y), last = this.toWorld(this.view.x + this.view.w, this.view.y + this.view.h);
      const firstRow = Math.max(0, Math.floor(first.y)), lastRow = Math.min(H - 1, Math.floor(last.y));
      const firstCol = Math.max(0, Math.floor(first.x)), lastCol = Math.min(W - 1, Math.floor(last.x));
      const size = this.letterHeight * this.charScale * z * 1.12;
      ctx.font = `${size}px ${this.kind === BoardKind.Symbols ? '"Noto Sans Symbols 2", ' : ""}"Ubuntu Mono", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const plain = rgb(LETTER, opacity);
      const emojiSide = this.letterHeight * z * 1.05;
      for (let row = firstRow; row <= lastRow; row++) {
        for (let col = firstCol; col <= lastCol; col++) {
          const letter = this.grid.at(row, col);
          const cx = origin.x + (col + 0.5) * z, cy = origin.y + (row + 0.5) * z;
          if (isEmoji(letter)) {
            if (!this.emojiAtlas) continue;
            const index = emojiIndex(letter), cell = this.emojiAtlas.width / this.emojiColumns;
            ctx.globalAlpha = opacity;
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(this.emojiAtlas, (index % this.emojiColumns) * cell, Math.floor(index / this.emojiColumns) * cell, cell, cell,
              cx - emojiSide / 2, cy - emojiSide / 2, emojiSide, emojiSide);
            ctx.globalAlpha = 1;
            continue;
          }
          const amount = white.get(row * 100000 + col);
          ctx.fillStyle = amount ? rgb(mix(LETTER, [255, 255, 255], amount), opacity) : plain;
          ctx.fillText(letter, cx, cy + size * 0.04);
        }
      }
    }
    this.drawMinimap(marks);
  }

  // ---- Minimap ----

  minimapScale() {
    const m = this.minimap;
    return Math.min((m.clientWidth - 8) / this.grid.width, (m.clientHeight - 8) / this.grid.height);
  }

  minimapToWorld(x, y) {
    const scale = this.minimapScale(), m = this.minimap;
    return { x: (x - (m.clientWidth - this.grid.width * scale) / 2) / scale, y: (y - (m.clientHeight - this.grid.height * scale) / 2) / scale };
  }

  /** Whether the minimap is wanted: not while the view is at the board's top-right corner (it would cover it). */
  minimapWanted() {
    if (this.minimapHeld) return true;
    const corner = this.toScreen(this.grid.width, 0);
    const slack = this.zoom / 2;
    return corner.x > this.view.x + this.view.w + slack || corner.y < this.view.y - slack;
  }

  drawMinimap(marks) {
    const m = this.minimap;
    if (!m) return;
    const dpr = this.dpr || 1, w = m.clientWidth, h = m.clientHeight;
    if (m.width !== Math.round(w * dpr)) {
      m.width = Math.round(w * dpr);
      m.height = Math.round(h * dpr);
    }
    const ctx = m.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = MINIMAP_FRAME;
    ctx.fillRect(0, 0, w, h);
    const scale = this.minimapScale();
    const origin = { x: (w - this.grid.width * scale) / 2, y: (h - this.grid.height * scale) / 2 };
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.farTexture, origin.x, origin.y, this.grid.width * scale, this.grid.height * scale);
    for (const mark of marks) {
      if (mark.outline) continue;
      drawMark(ctx, { ...mark, scale: 1, reveal: 1 }, origin, scale, 2.5);
    }
    const from = this.toWorld(this.view.x, this.view.y), to = this.toWorld(this.view.x + this.view.w, this.view.y + this.view.h);
    const fx = clamp(from.x, 0, this.grid.width), fy = clamp(from.y, 0, this.grid.height);
    const tx = clamp(to.x, 0, this.grid.width), ty = clamp(to.y, 0, this.grid.height);
    ctx.strokeStyle = MINIMAP_VIEW;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(origin.x + fx * scale, origin.y + fy * scale, (tx - fx) * scale, (ty - fy) * scale);
  }
}

/** A letter's square: a rounded square revealed from the centre as a growing circle, or only its edge. */
function drawMark(ctx, mark, origin, z, minSide) {
  const side = Math.max(SQUARE * mark.scale * z, minSide);
  const cx = origin.x + (mark.cell.col + 0.5) * z, cy = origin.y + (mark.cell.row + 0.5) * z;
  const x = cx - side / 2, y = cy - side / 2, radius = side * 0.22;
  ctx.beginPath();
  ctx.roundRect(x, y, side, side, radius);
  if (mark.outline) {
    ctx.strokeStyle = rgb(mark.color);
    ctx.lineWidth = Math.max(1, side * 0.08);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = rgb(mark.color);
  if (mark.reveal >= 1) {
    ctx.fill();
    return;
  }
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  ctx.arc(cx, cy, mark.reveal * side * 0.72, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Roughly how much of its cell a letter covers, for the far view.
function ink(letter) {
  if (isEmoji(letter)) return 0.45;
  if ("IJLTF".includes(letter)) return 0.2;
  if ("MWÑBGQ".includes(letter)) return 0.4;
  return 0.3;
}
