// The game's model and generator, ported from MegaWordSearch.Core (C#) so that the same spec and seed give the
// same board as the app: System.Random's seeded algorithm, the generator's every random call in the same order,
// and C#'s rounding. No DOM here (tests run it in a plain JS engine).

// ---- System.Random with a seed (.NET's Net5CompatSeedImpl: Knuth's subtractive generator) ----

const MBIG = 2147483647;
const MSEED = 161803398;

export class DotNetRandom {
  constructor(seed) {
    seed |= 0;
    const seedArray = new Array(56).fill(0);
    const subtraction = seed === -2147483648 ? MBIG : Math.abs(seed);
    let mj = MSEED - subtraction;
    seedArray[55] = mj;
    let mk = 1;
    let ii = 0;
    for (let i = 1; i < 55; i++) {
      if ((ii += 21) >= 55) ii -= 55;
      seedArray[ii] = mk;
      mk = mj - mk;
      if (mk < 0) mk += MBIG;
      mj = seedArray[ii];
    }
    for (let k = 1; k < 5; k++) {
      for (let i = 1; i < 56; i++) {
        let n = i + 30;
        if (n >= 55) n -= 55;
        seedArray[i] -= seedArray[1 + n];
        if (seedArray[i] < 0) seedArray[i] += MBIG;
      }
    }
    this.seedArray = seedArray;
    this.inext = 0;
    this.inextp = 21;
  }

  internalSample() {
    let next = this.inext, nextp = this.inextp;
    if (++next >= 56) next = 1;
    if (++nextp >= 56) nextp = 1;
    let value = this.seedArray[next] - this.seedArray[nextp];
    if (value === MBIG) value--;
    if (value < 0) value += MBIG;
    this.seedArray[next] = value;
    this.inext = next;
    this.inextp = nextp;
    return value;
  }

  sample() {
    return this.internalSample() * (1.0 / MBIG);
  }

  /** Next(max) with one argument, Next(min, max) with two: max excluded. */
  next(a, b) {
    if (b === undefined) return Math.trunc(this.sample() * a);
    return Math.trunc(this.sample() * (b - a)) + a;
  }

  nextDouble() {
    return this.sample();
  }
}

// C#'s Math.Round: halves go to the even neighbour.
export function roundHalfEven(x) {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// ---- Shapes ----

export const Shape = {
  None: 0,
  Horizontal: 1 << 0,
  HorizontalReverse: 1 << 1,
  Vertical: 1 << 2,
  VerticalReverse: 1 << 3,
  DiagonalDown: 1 << 4,
  DiagonalDownReverse: 1 << 5,
  DiagonalUp: 1 << 6,
  DiagonalUpReverse: 1 << 7,
  SnakeOrthogonal: 1 << 8,
  Snake: 1 << 9,
};
Shape.Straight = Shape.Horizontal | Shape.Vertical;
Shape.Diagonals = Shape.DiagonalDown | Shape.DiagonalUp;
Shape.Reversed = Shape.HorizontalReverse | Shape.VerticalReverse | Shape.DiagonalDownReverse | Shape.DiagonalUpReverse;
Shape.AllStraight = Shape.Straight | Shape.Diagonals | Shape.Reversed;
Shape.All = Shape.AllStraight | Shape.SnakeOrthogonal | Shape.Snake;

/** The step between letters of each straight shape [row, col], in the C# dictionary's order. */
export const STEPS = [
  [Shape.Horizontal, 0, 1],
  [Shape.HorizontalReverse, 0, -1],
  [Shape.Vertical, 1, 0],
  [Shape.VerticalReverse, -1, 0],
  [Shape.DiagonalDown, 1, 1],
  [Shape.DiagonalDownReverse, -1, -1],
  [Shape.DiagonalUp, -1, 1],
  [Shape.DiagonalUpReverse, 1, -1],
];

const ORTHOGONAL_STEPS = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const ALL_STEPS = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];

const isNeighbour = (a, b) => {
  const rows = Math.abs(a.row - b.row), cols = Math.abs(a.col - b.col);
  return rows <= 1 && cols <= 1 && rows + cols > 0;
};
const isOrthogonalNeighbour = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
const cellKey = (cell) => cell.row * 100000 + cell.col;

/** Every shape the path fits, read from its first cell to its last (see WordPath.Shapes). */
export function pathShapes(cells) {
  if (cells.length < 2) return Shape.None;
  const seen = new Set();
  let orthogonal = true, sameStep = true;
  const first = [cells[1].row - cells[0].row, cells[1].col - cells[0].col];
  for (let i = 0; i < cells.length; i++) {
    const key = cellKey(cells[i]);
    if (seen.has(key)) return Shape.None;
    seen.add(key);
    if (i === 0) continue;
    const previous = cells[i - 1];
    if (!isNeighbour(previous, cells[i])) return Shape.None;
    orthogonal = orthogonal && isOrthogonalNeighbour(previous, cells[i]);
    sameStep = sameStep && cells[i].row - previous.row === first[0] && cells[i].col - previous.col === first[1];
  }
  let shapes = Shape.Snake;
  if (orthogonal) shapes |= Shape.SnakeOrthogonal;
  if (sameStep) {
    for (const [shape, row, col] of STEPS) if (row === first[0] && col === first[1]) shapes |= shape;
  }
  return shapes;
}

// ---- Grid ----

export const EMPTY = "\0";

export class Grid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.letters = new Array(width * height).fill(EMPTY);
  }
  contains(cell) {
    return cell.row >= 0 && cell.row < this.height && cell.col >= 0 && cell.col < this.width;
  }
  get(cell) {
    return this.letters[cell.row * this.width + cell.col];
  }
  set(cell, letter) {
    this.letters[cell.row * this.width + cell.col] = letter;
  }
  at(row, col) {
    return this.letters[row * this.width + col];
  }
  read(cells) {
    return cells.map((cell) => this.get(cell)).join("");
  }
  toString() {
    const rows = [];
    for (let row = 0; row < this.height; row++) {
      rows.push(this.letters.slice(row * this.width, (row + 1) * this.width).map((c) => (c === EMPTY ? "." : c)).join(""));
    }
    return rows.join("\n");
  }
}

// ---- Words ----

export const INVENTED_CATEGORY = "inventadas";

/** "Nueva York" → "NUEVAYORK"; Ñ stays; in German Ä, Ö, Ü are AE, OE, UE and ß SS (see WordNormalizer). */
export function normalize(text, language = "es") {
  if (language === "de") {
    text = text.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue")
      .replace(/Ä/g, "AE").replace(/Ö/g, "OE").replace(/Ü/g, "UE").replace(/ß/g, "ss");
  }
  const decomposed = text.toUpperCase().replace(/Ñ/g, "\u0001").normalize("NFD");
  let result = "";
  for (const c of decomposed) {
    if (c === "\u0001") result += "Ñ";
    else if (c >= "A" && c <= "Z") result += c;
  }
  return result;
}

/** A word: as written (text), its category and as it goes on the board (letters). */
export function wordEntry(text, category, language) {
  return { text, category, letters: normalize(text, language) };
}

export function inventedWord(characters) {
  return { text: characters, category: INVENTED_CATEGORY, letters: characters };
}

/** A language's words: { language, categories: [{ id, name, hint, words: [entry] }] }, from words-<lang>.json. */
export function makeWordBank(data, hintFor) {
  const categories = data.categories.map((category) => ({
    id: category.id,
    name: category.name,
    hint: category.hint || hintFor(category.name),
    words: category.words.map((text) => wordEntry(text, category.id, data.language)),
  }));
  const byId = new Map(categories.map((category) => [category.id, category]));
  return {
    language: data.language,
    categories,
    contains: (id) => byId.has(id),
    get: (id) => byId.get(id),
    /** The words of several categories with different letters, each from the first category that has it. */
    wordsOf(ids) {
      const seen = new Set();
      const words = [];
      for (const id of ids) {
        for (const word of byId.get(id).words) {
          if (seen.has(word.letters)) continue;
          seen.add(word.letters);
          words.push(word);
        }
      }
      return words;
    },
  };
}

// ---- Boards (alphabets) ----

export const BoardKind = { Letters: "letters", FewLetters: "few", Symbols: "symbols", Emoji: "emoji", Numbers: "numbers" };

export const FEW_LETTER_SETS = ["LJT", "OQC", "MNW", "EFH", "BDP"];
export const NUMBER_SETS = ["147", "258", "369", "0123", "13579"];
export const SYMBOL_SETS = ["♠♥♦♣", "●■▲◆★", "○□△◇☆", "☀☁☂☃✿", "♠♥★●▲✿"];

export const LETTERS = { kind: BoardKind.Letters, characters: "" };

export const isInvented = (alphabet) => alphabet.kind !== BoardKind.Letters;
export const wordLengths = (alphabet) => (alphabet.characters.length <= 3 ? [4, 7] : [3, 6]);

// C#'s Math.Abs(seed % n): the remainder keeps the seed's sign.
const presetIndex = (seed, count) => Math.abs(seed % count);

/** A custom game's alphabet of a kind, chosen by the seed (BoardAlphabet.Preset). */
export function presetAlphabet(kind, seed, emoji) {
  switch (kind) {
    case BoardKind.FewLetters: return { kind, characters: FEW_LETTER_SETS[presetIndex(seed, FEW_LETTER_SETS.length)] };
    case BoardKind.Symbols: return { kind, characters: SYMBOL_SETS[presetIndex(seed, SYMBOL_SETS.length)] };
    case BoardKind.Numbers: return { kind, characters: NUMBER_SETS[presetIndex(seed, NUMBER_SETS.length)] };
    case BoardKind.Emoji: return emoji ? { kind, characters: emoji.themes[presetIndex(seed, emoji.themes.length)].characters } : LETTERS;
    default: return LETTERS;
  }
}

// ---- Emoji ----

export const EMOJI_FIRST = 0xe000;
export const isEmoji = (c) => c.charCodeAt(0) >= 0xe000 && c.charCodeAt(0) <= 0xf8ff;
export const emojiIndex = (c) => c.charCodeAt(0) - EMOJI_FIRST;

/** The emoji themes from emoji.json: each emoji is a private-use char, by its place in the atlas. */
export function makeEmojiCatalog(data) {
  let index = 0;
  const themes = data.themes.map((theme) => ({
    id: theme.id,
    name: theme.name,
    characters: theme.emoji.map(() => String.fromCharCode(EMOJI_FIRST + index++)).join(""),
  }));
  return { columns: data.columns, themes, get: (id) => themes.find((theme) => theme.id === id) };
}

// ---- Worlds ----

/** The worlds of worlds.json, with their stages' specs (see WorldsReader). */
export function makeWorlds(data, emoji) {
  return data.worlds.map((world) => ({
    id: world.id,
    name: world.name,
    rowsOf: world.rowsOf || 0,
    stages: world.stages.map((stage) => ({
      width: stage.width,
      height: stage.height,
      wordCount: stage.words,
      categories: stage.categories,
      shapes: stage.shapes.reduce((all, name) => all | Shape[name], 0),
      seed: stage.seed,
      timeLimit: stage.timeLimit || null,
      board: readBoard(stage.board, emoji),
    })),
  }));
}

function readBoard(board, emoji) {
  if (!board || board.type === "letters") return LETTERS;
  if (board.type === "emoji") return { kind: BoardKind.Emoji, characters: emoji.get(board.theme).characters };
  return { kind: board.type, characters: board.chars };
}

// ---- Generator (see PuzzleGenerator) ----

const ATTEMPTS_IN_REGION = 60;
const ATTEMPTS_ANYWHERE = 140;
const CHOICES = 6;
const CROSSING_CHANCE = 0.6;
const SECRET_SALT = 0x51c4e7;
const SNAKE_BUDGET = 300;

/**
 * spec: { width, height, wordCount, categories, shapes, alphabet, minLetters?, maxLetters?, secret? (a word entry) }.
 * Returns { spec, seed, grid, words: [{ word, cells }], secret: { word, cells } | null }.
 */
export function generate(spec, bank, seed) {
  const random = new DotNetRandom(seed);
  const grid = new Grid(spec.width, spec.height);

  const pool = isInvented(spec.alphabet) ? invent(spec, random) : candidates(spec, bank);
  shuffle(pool, random);
  const take = Math.min(spec.wordCount, pool.length);
  // Longest first; Array.sort is stable, like LINQ's OrderByDescending.
  const queue = pool.slice(0, take).sort((a, b) => b.letters.length - a.letters.length);
  let spare = take;

  const regions = makeRegions(spec.width, spec.height, spec.wordCount, random);
  const placed = [];
  for (let i = 0; i < queue.length && placed.length < spec.wordCount; i++) {
    const word = queue[i];
    const region = regions[placed.length % regions.length];
    const cells = place(grid, word.letters, spec.shapes, region, random);
    if (cells === null) {
      if (spare < pool.length) queue.push(pool[spare++]);
      continue;
    }
    for (let letter = 0; letter < cells.length; letter++) grid.set(cells[letter], word.letters[letter]);
    placed.push({ word, cells });
  }

  let secret = null;
  if (spec.secret) {
    const secretRandom = new DotNetRandom(seed ^ SECRET_SALT);
    const cells = place(grid, spec.secret.letters, spec.shapes, { row: 0, col: 0, rows: grid.height, cols: grid.width }, secretRandom);
    if (cells !== null) {
      for (let letter = 0; letter < cells.length; letter++) grid.set(cells[letter], spec.secret.letters[letter]);
      secret = { word: spec.secret, cells };
    }
  }

  fill(grid, spec.alphabet, random, bank.language);
  return { spec, seed, grid, words: placed, secret };
}

function candidates(spec, bank) {
  const categories = spec.categories.length > 0 ? spec.categories : bank.categories.map((category) => category.id);
  const longest = Math.min(spec.maxLetters ?? Infinity, longestFit(spec));
  const min = spec.minLetters ?? 3;
  return bank.wordsOf(categories).filter((word) => word.letters.length >= min && word.letters.length <= longest);
}

function invent(spec, random) {
  const characters = spec.alphabet.characters;
  let [min, max] = wordLengths(spec.alphabet);
  max = Math.min(max, longestFit(spec));
  min = Math.min(min, max);
  const words = [];
  const taken = new Set();
  const wanted = spec.wordCount * 2;
  for (let attempt = 0; attempt < wanted * 50 && words.length < wanted; attempt++) {
    const length = random.next(min, max + 1);
    let word = "";
    for (let i = 0; i < length; i++) word += characters[random.next(characters.length)];
    const reversed = word.split("").reverse().join("");
    if (new Set(word).size < 2 || taken.has(word) || taken.has(reversed)) continue;
    taken.add(word);
    words.push(inventedWord(word));
  }
  return words;
}

function longestFit(spec) {
  if (spec.shapes & (Shape.Snake | Shape.SnakeOrthogonal)) return spec.width * spec.height;
  let longest = 0;
  for (const [shape, row, col] of STEPS) {
    if (!(spec.shapes & shape)) continue;
    const rows = row === 0 ? Infinity : spec.height;
    const cols = col === 0 ? Infinity : spec.width;
    longest = Math.max(longest, Math.min(rows, cols));
  }
  return longest;
}

function makeRegions(width, height, count, random) {
  const cols = clamp(roundHalfEven(Math.sqrt((count * width) / height)), 1, width);
  const rows = clamp(Math.ceil(count / cols), 1, height);
  const regions = [];
  for (let r = 0; r < rows; r++) {
    const top = Math.trunc((r * height) / rows), bottom = Math.trunc(((r + 1) * height) / rows);
    for (let c = 0; c < cols; c++) {
      const left = Math.trunc((c * width) / cols), right = Math.trunc(((c + 1) * width) / cols);
      regions.push({ row: top, col: left, rows: bottom - top, cols: right - left });
    }
  }
  shuffle(regions, random);
  return regions;
}

function place(grid, letters, shapes, region, random) {
  const straight = STEPS.filter(([shape]) => shapes & shape);
  const snakes = []; // true: orthogonal
  if (shapes & Shape.SnakeOrthogonal) snakes.push(true);
  if (shapes & Shape.Snake) snakes.push(false);

  const found = [];
  for (let attempt = 0; attempt < ATTEMPTS_IN_REGION + ATTEMPTS_ANYWHERE; attempt++) {
    if (attempt === ATTEMPTS_IN_REGION && found.length > 0) break;
    const area = attempt < ATTEMPTS_IN_REGION ? region : { row: 0, col: 0, rows: grid.height, cols: grid.width };

    const snake = snakes.length > 0 && (straight.length === 0 || random.next(2) === 0);
    let cells;
    if (snake) {
      // Argument order as in C#: the start cell, then the kind of snake.
      const start = randomCell(area, random);
      cells = snakeWalk(grid, letters, start, snakes[random.next(snakes.length)], random);
    } else {
      cells = straightLine(grid, letters, straight[random.next(straight.length)], area, random);
    }
    if (cells === null) continue;

    const crossings = cells.filter((cell) => grid.get(cell) !== EMPTY).length;
    if (crossings === cells.length) continue;
    found.push({ cells, crossings });
    if (found.length === CHOICES) break;
  }
  if (found.length === 0) return null;
  if (random.nextDouble() < CROSSING_CHANCE) {
    let best = found[0];
    for (const placement of found) if (placement.crossings > best.crossings) best = placement;
    return best.cells;
  }
  return found[0].cells;
}

function straightLine(grid, letters, [, stepRow, stepCol], area, random) {
  const rows = startRange(grid.height, stepRow, letters.length);
  const cols = startRange(grid.width, stepCol, letters.length);
  if (rows[0] > rows[1] || cols[0] > cols[1]) return null;
  const row = pickInRange(rows, area.row, area.rows, random);
  const col = pickInRange(cols, area.col, area.cols, random);
  const cells = [];
  let cell = { row, col };
  for (let i = 0; i < letters.length; i++) {
    if (!accepts(grid, cell, letters[i])) return null;
    cells.push(cell);
    cell = { row: cell.row + stepRow, col: cell.col + stepCol };
  }
  return cells;
}

function startRange(size, step, length) {
  if (step > 0) return [0, size - length];
  if (step < 0) return [length - 1, size - 1];
  return [0, size - 1];
}

function pickInRange(range, areaStart, areaSize, random) {
  let min = Math.max(range[0], areaStart), max = Math.min(range[1], areaStart + areaSize - 1);
  if (min > max) [min, max] = range;
  return random.next(min, max + 1);
}

function randomCell(area, random) {
  const row = area.row + random.next(area.rows);
  return { row, col: area.col + random.next(area.cols) };
}

function snakeWalk(grid, letters, start, orthogonal, random) {
  if (!accepts(grid, start, letters[0])) return null;
  const path = [start];
  const inPath = new Set([cellKey(start)]);
  const budget = { left: SNAKE_BUDGET };
  return extend(grid, letters, path, inPath, orthogonal ? ORTHOGONAL_STEPS : ALL_STEPS, random, budget) ? path : null;
}

function extend(grid, letters, path, inPath, steps, random, budget) {
  if (path.length === letters.length) return true;
  if (--budget.left < 0) return false;
  const order = steps.slice();
  shuffle(order, random);
  for (const [stepRow, stepCol] of order) {
    const last = path[path.length - 1];
    const next = { row: last.row + stepRow, col: last.col + stepCol };
    if (!grid.contains(next) || inPath.has(cellKey(next)) || !accepts(grid, next, letters[path.length])) continue;
    path.push(next);
    inPath.add(cellKey(next));
    if (extend(grid, letters, path, inPath, steps, random, budget)) return true;
    path.pop();
    inPath.delete(cellKey(next));
  }
  return false;
}

function accepts(grid, cell, letter) {
  if (!grid.contains(cell)) return false;
  const current = grid.get(cell);
  return current === EMPTY || current === letter;
}

// Letter frequencies (per cent) of each language, to fill the cells no word uses (see LetterFrequencies).
const FREQUENCIES = {
  es: table("EAOSRNIDLCTUMPBGVYQHFZJÑXKW", [13.68, 12.53, 8.68, 7.98, 6.87, 6.71, 6.25, 5.86, 4.97, 4.68, 4.63, 3.93, 3.15, 2.51,
    1.42, 1.01, 0.90, 0.90, 0.88, 0.70, 0.69, 0.52, 0.44, 0.31, 0.22, 0.02, 0.01]),
  en: table("ETAOINSHRDLCUMWFGYPBVKJXQZ", [12.70, 9.06, 8.17, 7.51, 6.97, 6.75, 6.33, 6.09, 5.99, 4.25, 4.03, 2.78, 2.76,
    2.41, 2.36, 2.23, 2.02, 1.97, 1.93, 1.29, 0.98, 0.77, 0.15, 0.15, 0.10, 0.07]),
  de: table("ENSRIATDHULCGMOBWFKZVPJYXQ", [16.40, 9.78, 7.27, 7.00, 6.55, 6.51, 6.15, 5.08, 4.76, 4.35, 3.44, 3.06, 3.01,
    2.53, 2.51, 1.89, 1.89, 1.66, 1.21, 1.13, 0.85, 0.79, 0.27, 0.04, 0.03, 0.02]),
};

function table(letters, weights) {
  const cumulative = [];
  let total = 0;
  for (const weight of weights) {
    total += weight;
    cumulative.push(total);
  }
  return { letters, cumulative };
}

function frequentLetter(random, language) {
  const { letters, cumulative } = FREQUENCIES[language] || FREQUENCIES.es;
  const value = random.nextDouble() * cumulative[cumulative.length - 1];
  // Array.BinarySearch: the exact match, or the first larger element.
  let low = 0, high = cumulative.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (cumulative[middle] < value) low = middle + 1;
    else high = middle;
  }
  return letters[Math.min(low, letters.length - 1)];
}

function fill(grid, alphabet, random, language) {
  for (let row = 0; row < grid.height; row++) {
    for (let col = 0; col < grid.width; col++) {
      const cell = { row, col };
      if (grid.get(cell) !== EMPTY) continue;
      grid.set(cell, isInvented(alphabet) ? alphabet.characters[random.next(alphabet.characters.length)] : frequentLetter(random, language));
    }
  }
}

function shuffle(items, random) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = random.next(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
}

// ---- Finding words ----

/** The word the tapped cells spell (in some order) among `pending`, with its cells first to last; null if none. */
export function matchSelection(grid, selected, pending, allowed) {
  if (selected.length < 2 || selected.some((cell) => !grid.contains(cell))) return null;
  for (const word of pending) {
    if (word.letters.length !== selected.length) continue;
    for (const first of selected) {
      if (grid.get(first) !== word.letters[0]) continue;
      const path = [first];
      const available = selected.filter((cell) => cell !== first);
      if (extendMatch(grid, word.letters, path, available, allowed)) return { word, cells: path };
    }
  }
  return null;
}

function extendMatch(grid, letters, path, available, allowed) {
  if (path.length === letters.length) return (pathShapes(path) & allowed) !== 0;
  const last = path[path.length - 1];
  for (const next of available) {
    if (!isNeighbour(last, next) || grid.get(next) !== letters[path.length]) continue;
    path.push(next);
    if (extendMatch(grid, letters, path, available.filter((cell) => cell !== next), allowed)) return true;
    path.pop();
  }
  return false;
}

/** The word the cells spell in order (either way), as saved games keep them; null if none (see SelectionValidator). */
export function validatePath(grid, cells, pending, allowed) {
  if (cells.length < 2 || cells.some((cell) => !grid.contains(cell))) return null;
  const forward = grid.read(cells);
  const reversedCells = cells.slice().reverse();
  const backward = grid.read(reversedCells);
  for (const word of pending) {
    if (word.letters === forward && (pathShapes(cells) & allowed)) return { word, cells: cells.slice() };
    if (word.letters === backward && (pathShapes(reversedCells) & allowed)) return { word, cells: reversedCells };
  }
  return null;
}

// ---- Wordittos (see Wordittos.cs) ----

export const WORDITTO_PICTURES = 105;
const WORDITTO_SALT = 0x5ec2e7;
const WORDITTO_MIN = 4;
const WORDITTO_MAX = 9;

/** A stage's Worditto: { word, hint }. */
export function wordittoFor(stage, bank) {
  const random = new DotNetRandom(stage.seed ^ WORDITTO_SALT);
  if (isInvented(stage.board)) {
    const characters = stage.board.characters;
    const length = Math.min(wordLengths(stage.board)[1] + 1, Math.min(stage.width, stage.height));
    let word;
    do {
      word = "";
      for (let i = 0; i < length; i++) word += characters[random.next(characters.length)];
    } while (new Set(word).size < 2);
    return { word: inventedWord(word), hint: maskWord(word) };
  }
  let others = bank.categories.filter((category) => !stage.categories.includes(category.id));
  if (others.length === 0) others = bank.categories.slice();
  const category = others[random.next(others.length)];
  const longest = Math.min(WORDITTO_MAX, Math.min(stage.width, stage.height));
  const words = category.words.filter((word) => word.letters.length >= WORDITTO_MIN && word.letters.length <= longest);
  return { word: words[random.next(words.length)], hint: category.hint };
}

/** The picture of a stage's Worditto: the stages in order. */
export function wordittoPicture(worlds, world, stage) {
  let before = 0;
  for (let i = 0; i < world; i++) before += worlds[i].stages.length;
  return (before + stage) % WORDITTO_PICTURES;
}

/** Every second character hidden: "L?T?J". */
export function maskWord(word) {
  return word.split("").map((c, i) => (i % 2 === 1 ? "?" : c)).join("");
}

/** The spec a stage is played with, hiding its Worditto. */
export function stageSpec(stage, bank) {
  return {
    width: stage.width,
    height: stage.height,
    wordCount: stage.wordCount,
    categories: stage.categories,
    shapes: stage.shapes,
    alphabet: stage.board,
    secret: wordittoFor(stage, bank).word,
  };
}

// ---- Custom games (see CustomGameSettings) ----

export const CUSTOM_SIZES = [20, 40, 60, 80];
const NORMAL_WORDS = [12, 30, 50, 70];
// Math.fround: the factors are floats in C#.
export const AMOUNT_FACTORS = [Math.fround(0.6), 1, Math.fround(1.4)];
export const TIME_LIMITS = [0, 10, 25, 50, 100];

export function defaultCustom() {
  return {
    board: BoardKind.Letters,
    categories: [],
    size: 1,
    amount: 1,
    horizontal: true,
    vertical: true,
    diagonal: false,
    reversed: false,
    snakeOrthogonal: false,
    snake: false,
    timeLimit: 0,
  };
}

export function customShapes(custom) {
  let shapes = 0;
  if (custom.horizontal) shapes |= Shape.Horizontal | (custom.reversed ? Shape.HorizontalReverse : 0);
  if (custom.vertical) shapes |= Shape.Vertical | (custom.reversed ? Shape.VerticalReverse : 0);
  if (custom.diagonal) shapes |= Shape.Diagonals | (custom.reversed ? Shape.DiagonalDownReverse | Shape.DiagonalUpReverse : 0);
  if (custom.snakeOrthogonal) shapes |= Shape.SnakeOrthogonal;
  if (custom.snake) shapes |= Shape.Snake;
  return shapes;
}

const randomWords = (custom) => custom.categories.length === 0 && custom.board === BoardKind.Letters;

export function customWordCount(custom, bank, amount = custom.amount) {
  const normal = NORMAL_WORDS[clamp(custom.size, 0, NORMAL_WORDS.length - 1)];
  const count = Math.max(3, roundHalfEven(Math.fround(normal * AMOUNT_FACTORS[clamp(amount, 0, AMOUNT_FACTORS.length - 1)])));
  if (custom.board !== BoardKind.Letters) return count;
  const ids = randomWords(custom) ? bank.categories.map((category) => category.id) : custom.categories;
  return Math.min(count, bank.wordsOf(ids).length);
}

export function customSpec(custom, bank, seed, emoji) {
  const side = CUSTOM_SIZES[clamp(custom.size, 0, CUSTOM_SIZES.length - 1)];
  return {
    width: side,
    height: side,
    wordCount: customWordCount(custom, bank),
    categories: custom.board === BoardKind.Letters ? custom.categories.slice() : [],
    shapes: customShapes(custom),
    alphabet: presetAlphabet(custom.board, seed, emoji),
  };
}

export function customTimeLimit(custom) {
  const minutes = TIME_LIMITS[clamp(custom.timeLimit, 0, TIME_LIMITS.length - 1)];
  return minutes > 0 ? minutes * 60 : null;
}

// ---- Progress (see Progress.cs) ----

export const progressKey = (worldId, stage) => `${worldId}/${stage + 1}`;

export function completedCount(progress, world) {
  let count = 0;
  for (let stage = 0; stage < world.stages.length; stage++) if (progressKey(world.id, stage) in progress.bestTimes) count++;
  return count;
}

export const isWorldCompleted = (progress, world) => completedCount(progress, world) === world.stages.length;

export function isWorldUnlocked(progress, worlds, index) {
  if (index === 0 || worlds[index].rowsOf > 0) return true;
  for (let before = index - 1; before >= 0; before--) {
    if (!worlds[before].rowsOf) return isWorldCompleted(progress, worlds[before]);
  }
  return true;
}

export function completedInOrderedWorlds(progress, worlds) {
  return worlds.filter((world) => !world.rowsOf).reduce((sum, world) => sum + completedCount(progress, world), 0);
}

export function stagesToOpenRow(worlds, world, row) {
  const rows = Math.ceil(worlds[world].stages.length / worlds[world].rowsOf);
  if (row <= 0 || rows <= 1) return 0;
  const total = worlds.filter((w) => !w.rowsOf).reduce((sum, w) => sum + w.stages.length, 0);
  // MidpointRounding.AwayFromZero, for positive numbers.
  return Math.floor((total * row) / (rows - 1) + 0.5);
}

export function isStageUnlocked(progress, worlds, world, stage) {
  if (worlds[world].rowsOf) {
    return completedInOrderedWorlds(progress, worlds) >= stagesToOpenRow(worlds, world, Math.floor(stage / worlds[world].rowsOf));
  }
  return isWorldUnlocked(progress, worlds, world) && (stage === 0 || progressKey(worlds[world].id, stage - 1) in progress.bestTimes);
}

// ---- A puzzle being played (see PuzzleState) ----

export const MAX_HINTS = 3;

export class PuzzleState {
  /** timeLimit in seconds, or null for no limit (the time is still measured). */
  constructor(puzzle, timeLimit = null) {
    this.puzzle = puzzle;
    this.timeLimit = timeLimit;
    this.elapsed = 0;
    this.found = [];
    this.foundWords = new Set();
    this.hintsUsed = 0;
    this.secretFound = false;
  }

  get wordCount() { return this.puzzle.words.length; }
  get remaining() { return this.timeLimit === null ? null : this.timeLimit - this.elapsed; }
  get isComplete() { return this.found.length === this.wordCount; }
  get isTimeUp() { return this.timeLimit !== null && this.elapsed >= this.timeLimit && !this.isComplete; }
  get isOver() { return this.isComplete || this.isTimeUp; }
  get hintsLeft() { return MAX_HINTS - this.hintsUsed; }
  get pending() { return this.puzzle.words.map((placed) => placed.word).filter((word) => !this.foundWords.has(word)); }

  isFound(word) { return this.foundWords.has(word); }

  resume(elapsed) {
    this.elapsed = this.timeLimit !== null && elapsed > this.timeLimit ? this.timeLimit : elapsed;
  }

  tick(seconds) {
    if (this.isOver) return;
    this.elapsed += seconds;
    if (this.timeLimit !== null && this.elapsed > this.timeLimit) this.elapsed = this.timeLimit;
  }

  /** The word still to find whose first letter is nearest to `near`; null without hints left. */
  useHint(near) {
    if (this.isOver || this.hintsLeft <= 0) return null;
    let nearest = null, best = Infinity;
    for (const placed of this.puzzle.words) {
      if (this.foundWords.has(placed.word)) continue;
      const first = placed.cells[0];
      const distance = (first.row - near.row) ** 2 + (first.col - near.col) ** 2;
      if (distance < best) {
        best = distance;
        nearest = placed;
      }
    }
    if (nearest) this.hintsUsed++;
    return nearest;
  }

  tryFindTapped(cells) {
    if (this.isOver) return null;
    const placed = matchSelection(this.puzzle.grid, cells, this.pending, this.puzzle.spec.shapes);
    if (placed) this.add(placed);
    return placed;
  }

  tryFindSecret(cells) {
    if (!this.puzzle.secret || this.secretFound) return null;
    const placed = matchSelection(this.puzzle.grid, cells, [this.puzzle.secret.word], this.puzzle.spec.shapes);
    if (placed) this.secretFound = true;
    return placed;
  }

  /** Cells in order, as saved games keep found words. */
  tryFind(cells) {
    if (this.isOver) return null;
    const placed = validatePath(this.puzzle.grid, cells, this.pending, this.puzzle.spec.shapes);
    if (placed) this.add(placed);
    return placed;
  }

  add(placed) {
    this.found.push(placed);
    this.foundWords.add(placed.word);
  }
}
