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
    // Int32 arithmetic, wrapping as C#'s does (a seed over MSEED makes mj negative).
    let mj = (MSEED - subtraction) | 0;
    seedArray[55] = mj;
    let mk = 1;
    let ii = 0;
    for (let i = 1; i < 55; i++) {
      if ((ii += 21) >= 55) ii -= 55;
      seedArray[ii] = mk;
      mk = (mj - mk) | 0;
      if (mk < 0) mk += MBIG;
      mj = seedArray[ii];
    }
    for (let k = 1; k < 5; k++) {
      for (let i = 1; i < 56; i++) {
        let n = i + 30;
        if (n >= 55) n -= 55;
        seedArray[i] = (seedArray[i] - seedArray[1 + n]) | 0;
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

  /** Next() with no argument (0 to int.MaxValue, excluded), Next(max) with one, Next(min, max) with two: max excluded. */
  next(a, b) {
    if (a === undefined) return this.internalSample();
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

/**
 * The word some of the tapped cells spell (in some order) among `pending`, with its cells first to last; null if none.
 * Letters tapped by mistake do not get in the way.
 */
export function matchSelection(grid, selected, pending, allowed) {
  if (selected.length < 2 || selected.some((cell) => !grid.contains(cell))) return null;
  for (const word of pending) {
    if (word.letters.length > selected.length) continue;
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

// ---- «Beat the kitten» (see KittenLevels, KittenSearch, KittenMatch, KittenProgress, KittenShop, KittenBadges) ----

/** How a kitten goes over the board looking for a word (KittenStrategy). */
export const KittenStrategy = { Rows: 0, Columns: 1, Jumps: 2, Spiral: 3, RareLetter: 4 };

export const KITTEN_WORDS = 5;
export const KITTEN_POINTS_PER_WORD = 20;
export const KITTEN_POINTS_PER_LEVEL = KITTEN_POINTS_PER_WORD * KITTEN_WORDS;
const KITTEN_RECENT_WORDS = 200;
const KITTEN_RECENT_CATEGORIES = 3;
/** A board won is worth this many times the coins its words gave (KittenCoins); each word, one coin. */
export const KITTEN_BOARD_WON_FACTOR = 2;
export const kittenCoinsPerWord = () => 1;

/** The drawings beyond the cats theme's stickers (0-29), each atlas with its range of numbers (KittenPictures). */
export const KITTEN_SHEETS = [
  { first: 100, name: "angry", columns: 6, count: 36 },
  { first: 200, name: "costumes", columns: 6, count: 30 },
  { first: 300, name: "space", columns: 6, count: 30 },
  { first: 400, name: "bosses", columns: 4, count: 12 },
  { first: 500, name: "badges", columns: 4, count: 8 },
];
const ANGRY = 100, COSTUMES = 200, SPACE = 300, BOSSES = 400, BADGES = 500;

const LEVELS_PER_SIZE = 20;
const FIRST_SIZE = 8;
const MAX_SIZE = 11;
const KITTEN_MIN_LETTERS = 4;
const KITTEN_SEED_ATTEMPTS = 20;
const ORDER_SALT = 0x6a77;
const FRESH_TRIES = 60;
const LAST_LEVEL = 30;
export const KITTEN_BOARD_LEVELS = 101;
export const KITTEN_MAX_LEVEL = 120;
export const KITTEN_BOSS_EVERY = 10;
const STRETCH = 27;

const S = Shape;
// The shapes by level, as the last level of each.
const SHAPES_BY_LEVEL = [
  [10, S.Horizontal | S.Vertical],
  [20, S.Horizontal | S.Vertical | S.DiagonalDown],
  [30, S.Straight | S.Diagonals],
  [40, S.Straight | S.Diagonals | S.HorizontalReverse],
  [50, S.Straight | S.Diagonals | S.HorizontalReverse | S.VerticalReverse],
  [60, S.Straight | S.Diagonals | S.HorizontalReverse | S.VerticalReverse | S.DiagonalDownReverse],
  [KITTEN_BOARD_LEVELS, S.AllStraight],
];

const rival = (sticker, name, boss = false) => ({ sticker, name, boss });
const plain = (pairs) => pairs.map(([sticker, name]) => rival(sticker, name));
const sheet = (first, pairs) => pairs.map(([drawing, name]) => rival(first + drawing, name));

/** The kittens of the levels between bosses: 27 for each stretch of 30 levels. */
export const KITTENS = [
  ...plain([[3, "Mimi"], [1, "Sushi"], [13, "Nube"], [4, "Coco"], [14, "Bolita"], [8, "Kiwi"], [12, "Flor"], [15, "Pipo"],
    [10, "Canela"], [16, "Yoyo"], [17, "Brote"], [5, "Bruno"], [18, "Lola"], [19, "Gabi"], [21, "Chispa"], [25, "Oliva"],
    [26, "Mochi"], [7, "Suki"], [24, "Noel"], [27, "Oreo"], [28, "Toby"], [22, "Bongo"], [11, "Tofu"], [9, "Einstein"],
    [20, "Rocky"], [29, "Merlín"], [2, "Leo"]]),
  ...sheet(ANGRY, [[0, "Bigotes"], [1, "Zarpa"], [3, "Perla"], [4, "Moca"], [5, "Capucha"], [7, "Siam"], [8, "Pecas"], [9, "Profe"],
    [10, "Tigre"], [12, "Violeta"], [13, "Tizón"], [15, "Rapero"], [17, "Musgo"], [18, "Pirata"], [20, "Puchero"], [21, "Escarcha"],
    [22, "Remix"], [24, "Copito"], [26, "Algodón"], [28, "Turbo"], [29, "Hechizo"], [30, "Corazón"], [31, "Ceniza"], [32, "Brisa"],
    [33, "Llama"], [34, "Duquesa"], [35, "Ninja"]]),
  ...sheet(COSTUMES, [[0, "Punk"], [1, "Bandana"], [2, "Hueso"], [3, "Rosita"], [4, "Barón"], [5, "Tiburón"], [6, "Gamer"], [7, "Monje"],
    [8, "Galán"], [9, "Sabio"], [10, "Majestad"], [11, "Estrella"], [12, "Celeste"], [13, "Capa"], [14, "Merengue"], [15, "Skater"],
    [16, "Shinobi"], [17, "Hiedra"], [18, "Cascabel"], [19, "Querubín"], [20, "Picante"], [21, "Cyborg"], [22, "Voltio"],
    [23, "Bombón"], [25, "Explorador"], [27, "Volcán"], [29, "Hechicero"]]),
  ...sheet(SPACE, [[0, "Astro"], [1, "Marciano"], [2, "Vórtice"], [3, "Visor"], [4, "Trióculo"], [5, "Ovni"], [6, "Capitán"], [7, "Cíclope"],
    [8, "Lila"], [9, "Antenita"], [10, "Corsario"], [11, "Estela"], [12, "Glaciar"], [13, "Amatista"], [14, "Jade"], [15, "Platillo"],
    [16, "Magma"], [17, "Mecha"], [18, "Cobre"], [20, "Umbra"], [21, "Plasma"], [22, "Órbita"], [23, "Kraken"], [25, "Gamma"],
    [26, "Sputnik"], [27, "Eclipse"], [29, "Saturno"]]),
];

/** The bosses of levels 10, 20… 120. */
export const KITTEN_BOSSES = [[2, "Sakura"], [3, "Druida"], [0, "Escarlata"], [1, "Abismo"], [4, "Brasa"], [5, "Lavanda"],
  [10, "Shuriken"], [8, "Glacius"], [7, "Mago Sombra"], [6, "Emperador"], [11, "Noctis"], [9, "Draco"]]
  .map(([drawing, name]) => rival(BOSSES + drawing, name, true));

const boardLevel = (level) => clamp(level, 1, KITTEN_BOARD_LEVELS);

export const kittenSize = (level) => Math.min(MAX_SIZE, FIRST_SIZE + Math.floor((boardLevel(level) - 1) / LEVELS_PER_SIZE));

export const kittenShapes = (level) => SHAPES_BY_LEVEL.find(([last]) => boardLevel(level) <= last)[1];

/** The shapes a level adds to the one before. */
export const kittenNewShapes = (level) => (level <= 1 ? Shape.None : kittenShapes(level) & ~kittenShapes(level - 1));

export const isKittenBoss = (level) => level >= KITTEN_BOSS_EVERY && level % KITTEN_BOSS_EVERY === 0;

/** The kitten of a level: a new one each level up to the 120th, a boss every ten; then the last stretch's and the bosses take turns. */
export function kittenRival(level) {
  level = Math.max(1, level);
  if (isKittenBoss(level)) return KITTEN_BOSSES[(level / KITTEN_BOSS_EVERY - 1) % KITTEN_BOSSES.length];
  let index = level - 1 - Math.floor(level / KITTEN_BOSS_EVERY);
  if (index >= KITTENS.length) index = KITTENS.length - STRETCH + ((index - KITTENS.length) % STRETCH);
  return KITTENS[index];
}

/** The points a word lost takes: a word's, or more against a boss. */
export function kittenPenalty(level) {
  if (!isKittenBoss(level)) return KITTEN_POINTS_PER_WORD;
  return level <= 30 ? 40 : level <= 90 ? 60 : 80;
}

// Seconds per look by level (KittenLevels.LookSeconds).
const LOOK_SECONDS = [
  0.333, 0.323, 0.311, 0.298, 0.284, 0.242, 0.242, 0.239, 0.236, 0.239,
  0.232, 0.228, 0.225, 0.221, 0.222, 0.222, 0.223, 0.224, 0.225, 0.226,
  0.204, 0.205, 0.205, 0.206, 0.207, 0.207, 0.208, 0.208, 0.209, 0.21,
  ...new Array(10).fill(0.247), ...new Array(10).fill(0.223), ...new Array(10).fill(0.222),
  ...new Array(30).fill(0.188), ...new Array(11).fill(0.186),
].map(Math.fround);
const FIRST_SELECT = Math.fround(0.32), LAST_SELECT = Math.fround(0.18);
const MISSES = [[1, 0.25], [5, 0.2], [14, 0.12]];

export function kittenMissChance(level) {
  level = Math.max(1, level);
  const last = MISSES[MISSES.length - 1];
  if (level > last[0]) return level <= 30 ? 0.12 : level <= 40 ? 0.1 : level <= 60 ? 0.09 : level <= 90 ? 0.08 : 0.07;
  for (let i = 1; i < MISSES.length; i++) {
    if (level > MISSES[i][0]) continue;
    const [from, fromMiss] = MISSES[i - 1], [to, toMiss] = MISSES[i];
    return fromMiss + ((toMiss - fromMiss) * (level - from)) / (to - from);
  }
  return last[1];
}

/** How the kitten plays at a level: { lookSeconds, missChance, strategies, selectSeconds }. */
export function kittenDifficulty(level) {
  const lookSeconds = LOOK_SECONDS[boardLevel(level) - 1];
  const missChance = kittenMissChance(level);
  level = clamp(level, 1, LAST_LEVEL);
  const part = Math.fround((level - 1) / (LAST_LEVEL - 1));
  const strategies = [KittenStrategy.Rows, KittenStrategy.Columns, KittenStrategy.Jumps];
  if (level >= 6) strategies.push(KittenStrategy.Spiral);
  if (level >= 10) strategies.push(KittenStrategy.RareLetter);
  const selectSeconds = Math.fround(FIRST_SELECT + Math.fround((LAST_SELECT - FIRST_SELECT) * part));
  return { lookSeconds, missChance, strategies, selectSeconds };
}

/** The spec of a board of a level: its size and shapes, and one category chosen with the seed. */
export function kittenSpec(level, seed, bank) {
  const random = new DotNetRandom(seed);
  const category = bank.categories[random.next(bank.categories.length)];
  const size = kittenSize(level);
  return {
    width: size, height: size, wordCount: KITTEN_WORDS, categories: [category.id], shapes: kittenShapes(level),
    alphabet: LETTERS, minLetters: KITTEN_MIN_LETTERS, maxLetters: size,
  };
}

/** The board of a level and seed: the first of the seeds from it on that places every word. */
export function kittenBoard(level, seed, bank) {
  let puzzle = null;
  for (let attempt = 0; attempt < KITTEN_SEED_ATTEMPTS; attempt++) {
    puzzle = generate(kittenSpec(level, seed, bank), bank, (seed + attempt) | 0);
    if (puzzle.words.length === puzzle.spec.wordCount) return puzzle;
  }
  return puzzle;
}

/**
 * A seed for a new board of a level whose words are none of the recent ones and whose category is none of the recent
 * ones: the first of some seeds from nextSeed() that does, or the one closest to it.
 */
export function kittenFreshSeed(level, nextSeed, bank, recentWords, recentCategories) {
  const words = new Set(recentWords);
  let best = 0, bestScore = Infinity;
  for (let i = 0; i < FRESH_TRIES && bestScore > 0; i++) {
    const seed = nextSeed();
    const puzzle = kittenBoard(level, seed, bank);
    const repeated = puzzle.words.filter((placed) => words.has(placed.word.letters)).length;
    const oldCategory = puzzle.words.length > 0 && recentCategories.includes(puzzle.words[0].word.category);
    const score = repeated * 2 + (oldCategory ? 1 : 0);
    if (score < bestScore) {
      best = seed;
      bestScore = score;
    }
  }
  return best;
}

/**
 * LINQ's OrderBy (then ThenBy) on keys: each key function called for every item in order, then a stable sort. With one
 * item or none .NET calls no key function.
 */
function orderBy(items, ...keyFunctions) {
  if (items.length <= 1) return items.slice();
  const keys = keyFunctions.map((keyOf) => items.map((item) => keyOf(item)));
  return items.map((_, i) => i).sort((a, b) => {
    for (const k of keys) if (k[a] !== k[b]) return k[a] < k[b] ? -1 : 1;
    return a - b;
  }).map((i) => items[i]);
}

/** The order the words of a board are asked for, chosen with its seed. */
export function kittenOrder(puzzle) {
  const random = new DotNetRandom(puzzle.seed ^ ORDER_SALT);
  return orderBy(puzzle.words, () => random.next());
}

// ---- The kitten looking for a word, one cell at a time (KittenSearch) ----

const CHECK_FACTOR = Math.fround(0.8);
const JITTER = Math.fround(0.3);
export const KITTEN_TRAIL = 6;
const MAX_PASSES = 40;
const sameStep = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];

export class KittenSearch {
  constructor(grid, word, shapes, strategy, difficulty, random) {
    this.grid = grid;
    this.word = word;
    this.difficulty = difficulty;
    this.random = random;
    this.strategy = strategy;
    this.steps = STEPS.filter(([shape]) => shapes & shape).map(([, row, col]) => [row, col]);
    this.trail = [];
    this.matchedByIndex = new Map();
    this.selected = [];
    /** The look now: { cell, checking, selecting }, or null once done. */
    this.look = null;
    this.found = null;
    this.looks = 0;
    this.elapsed = 0;
    this.lookTime = 0;
    this.iterator = this.run();
    this.next();
  }

  get isDone() { return this.look === null; }
  get isSelecting() { return !!this.look && this.look.selecting; }
  /** While checking a direction, the cells that fit so far, in the word's order. */
  get matched() { return [...this.matchedByIndex.entries()].sort((a, b) => a[0] - b[0]).map(([, cell]) => cell); }
  /** How far into the look now, from 0 to 1. */
  get lookProgress() { return this.look === null ? 1 : clamp(this.elapsed / this.lookTime, 0, 1); }

  advance(seconds) {
    this.elapsed += seconds;
    while (this.look !== null && this.elapsed >= this.lookTime) {
      this.elapsed -= this.lookTime;
      this.next();
    }
  }

  next() {
    const previous = this.look;
    if (previous) {
      if (previous.selecting) this.selected.push(previous.cell);
      else {
        this.trail.push(previous.cell);
        if (this.trail.length > KITTEN_TRAIL) this.trail.shift();
      }
    }
    const step = this.iterator.next();
    if (step.done) {
      this.look = null;
      return;
    }
    this.look = step.value;
    this.looks++;
    if (this.look.selecting) {
      this.lookTime = this.difficulty.selectSeconds;
      return;
    }
    const jitter = Math.fround(1 + JITTER * Math.fround(this.random.nextDouble() * 2 - 1));
    this.lookTime = Math.fround(this.difficulty.lookSeconds * jitter * (this.look.checking ? CHECK_FACTOR : 1));
  }

  *run() {
    const grid = this.grid, letters = this.word.letters, random = this.random;
    const anchor = this.strategy === KittenStrategy.RareLetter ? this.rarestLetter(letters) : 0;
    for (let pass = 0; pass < MAX_PASSES; pass++) {
      const order = pass === 0 ? this.strategy : KittenStrategy.Jumps;
      let previous = null;
      for (const cell of this.order(order)) {
        yield { cell, checking: false, selecting: false };
        const line = scanLine(order, previous, cell);
        previous = cell;
        if (grid.get(cell) !== letters[anchor]) continue;
        // The word along the line the kitten goes over: it reads it, so it does not overlook it.
        let read = null;
        if (line) {
          read = [line, [-line[0], -line[1]]].find((step) => this.steps.some((s) => sameStep(s, step)) && this.spells(cell, step, anchor, letters)) ?? null;
        }
        if (read === null && random.nextDouble() < this.difficulty.missChance) continue;
        const fitting = this.steps.filter((step) => this.fits(cell, step, anchor, letters.length));
        for (const step of orderBy(fitting, (step) => (sameStep(step, read) ? 0 : 1), () => random.next())) {
          this.matchedByIndex.clear();
          this.matchedByIndex.set(anchor, cell);
          let fits = true;
          for (const index of checkOrder(anchor, letters.length)) {
            const next = at(cell, step, index - anchor);
            yield { cell: next, checking: true, selecting: false };
            if (grid.get(next) !== letters[index]) {
              fits = false;
              break;
            }
            this.matchedByIndex.set(index, next);
          }
          if (fits) {
            const spotted = { word: this.word, cells: [...letters].map((_, index) => at(cell, step, index - anchor)) };
            this.matchedByIndex.clear();
            this.trail.length = 0;
            for (const letter of spotted.cells) yield { cell: letter, checking: false, selecting: true };
            this.found = spotted;
            return;
          }
        }
        this.matchedByIndex.clear();
      }
    }
  }

  spells(cell, step, anchor, letters) {
    if (!this.fits(cell, step, anchor, letters.length)) return false;
    for (let index = 0; index < letters.length; index++) if (this.grid.get(at(cell, step, index - anchor)) !== letters[index]) return false;
    return true;
  }

  fits(cell, step, anchor, length) {
    return this.grid.contains(at(cell, step, -anchor)) && this.grid.contains(at(cell, step, length - 1 - anchor));
  }

  /** The word's letter least often on the board (the first of them on a tie). */
  rarestLetter(letters) {
    const counts = new Map();
    for (const letter of this.grid.letters) counts.set(letter, (counts.get(letter) || 0) + 1);
    let best = 0;
    for (let i = 1; i < letters.length; i++) if ((counts.get(letters[i]) || 0) < (counts.get(letters[best]) || 0)) best = i;
    return best;
  }

  *order(strategy) {
    const width = this.grid.width, height = this.grid.height;
    if (strategy === KittenStrategy.Columns) {
      for (let col = 0; col < width; col++) for (let row = 0; row < height; row++) yield { row, col };
    } else if (strategy === KittenStrategy.Jumps) {
      const cells = [];
      for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) cells.push({ row, col });
      for (let i = cells.length - 1; i > 0; i--) {
        const j = this.random.next(i + 1);
        [cells[i], cells[j]] = [cells[j], cells[i]];
      }
      yield* cells;
    } else if (strategy === KittenStrategy.Spiral) {
      yield* kittenSpiral(width, height);
    } else {
      for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) yield { row, col };
    }
  }
}

const at = (cell, step, times) => ({ row: cell.row + step[0] * times, col: cell.col + step[1] * times });

function* checkOrder(anchor, length) {
  for (let index = anchor + 1; index < length; index++) yield index;
  for (let index = anchor - 1; index >= 0; index--) yield index;
}

/** The direction the kitten goes over the board in at a cell: along the rows or the columns, or the spiral's. */
function scanLine(order, previous, cell) {
  switch (order) {
    case KittenStrategy.Rows:
    case KittenStrategy.RareLetter:
      return [0, 1];
    case KittenStrategy.Columns:
      return [1, 0];
    case KittenStrategy.Spiral: {
      if (!previous) return null;
      const row = cell.row - previous.row, col = cell.col - previous.col;
      return Math.abs(row) + Math.abs(col) === 1 ? [row, col] : null;
    }
    default:
      return null;
  }
}

/** From the middle outwards: right 1, down 1, left 2, up 2, right 3… leaving out the cells off the board. */
export function* kittenSpiral(width, height) {
  let cell = { row: Math.floor((height - 1) / 2), col: Math.floor((width - 1) / 2) };
  let left = width * height;
  const turns = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  yield cell;
  left--;
  for (let run = 1, turn = 0; left > 0; turn++) {
    const step = turns[turn % 4];
    for (let i = 0; i < run && left > 0; i++) {
      cell = { row: cell.row + step[0], col: cell.col + step[1] };
      if (cell.row < 0 || cell.row >= height || cell.col < 0 || cell.col >= width) continue;
      yield cell;
      left--;
    }
    if (turn % 2 === 1) run++;
  }
}

// ---- The player's progress (KittenProgress), as localStorage keeps it ----

export function newKittenProgress() {
  return {
    points: 0, wins: 0, losses: 0, coins: 0, shields: 0, boosterMultiplier: 1, boosterWins: 0,
    board: null, recentWords: [], recentCategories: [],
  };
}

/** A progress read back, with anything missing or wrong put right. */
export function readKittenProgress(data) {
  const p = newKittenProgress();
  if (!data || typeof data !== "object") return p;
  const count = (value) => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
  p.points = count(data.points);
  p.wins = count(data.wins);
  p.losses = count(data.losses);
  p.coins = count(data.coins);
  p.shields = count(data.shields);
  p.boosterWins = data.boosterMultiplier > 1 ? count(data.boosterWins) : 0;
  p.boosterMultiplier = p.boosterWins > 0 ? Math.floor(data.boosterMultiplier) : 1;
  const board = data.board;
  if (board && Number.isInteger(board.seed) && Number.isInteger(board.level) && board.level >= 1 && Array.isArray(board.results)) {
    p.board = { seed: board.seed, level: board.level, results: board.results.map(Boolean).slice(0, KITTEN_WORDS) };
  }
  if (Array.isArray(data.recentWords)) p.recentWords = data.recentWords.filter((w) => typeof w === "string").slice(-KITTEN_RECENT_WORDS);
  if (Array.isArray(data.recentCategories)) p.recentCategories = data.recentCategories.filter((c) => typeof c === "string").slice(-KITTEN_RECENT_CATEGORIES);
  return p;
}

export const kittenLevelOf = (points) => Math.floor(points / KITTEN_POINTS_PER_LEVEL) + 1;
export const kittenLevel = (progress) => kittenLevelOf(progress.points);
export const kittenLevelPoints = (progress) => progress.points % KITTEN_POINTS_PER_LEVEL;
export const hasBooster = (progress) => progress.boosterWins > 0;

/** A new board's words and category, for the next boards to keep clear of them. */
export function rememberKittenWords(progress, words) {
  for (const word of words) {
    const at = progress.recentWords.indexOf(word.letters);
    if (at >= 0) progress.recentWords.splice(at, 1);
    progress.recentWords.push(word.letters);
  }
  const category = words.length > 0 ? words[0].category : null;
  if (category !== null) {
    const at = progress.recentCategories.indexOf(category);
    if (at >= 0) progress.recentCategories.splice(at, 1);
    progress.recentCategories.push(category);
  }
  if (progress.recentWords.length > KITTEN_RECENT_WORDS) progress.recentWords.splice(0, progress.recentWords.length - KITTEN_RECENT_WORDS);
  if (progress.recentCategories.length > KITTEN_RECENT_CATEGORIES) progress.recentCategories.splice(0, progress.recentCategories.length - KITTEN_RECENT_CATEGORIES);
}

/** A round won: its points (multiplied by the booster), and true if they open the next level. */
export function kittenWin(progress) {
  const level = kittenLevel(progress);
  const booster = hasBooster(progress);
  progress.points += KITTEN_POINTS_PER_WORD * (booster ? progress.boosterMultiplier : 1);
  if (booster && --progress.boosterWins === 0) progress.boosterMultiplier = 1;
  progress.wins++;
  return kittenLevel(progress) > level;
}

/** A round lost: the points go, down to the start of the level at most; or a shield's charge. Whether a shield saved them. */
export function kittenLose(progress, points = KITTEN_POINTS_PER_WORD) {
  progress.losses++;
  if (progress.shields > 0) {
    progress.shields--;
    return true;
  }
  progress.points = Math.max((kittenLevel(progress) - 1) * KITTEN_POINTS_PER_LEVEL, progress.points - points);
  return false;
}

// ---- The shop (KittenShop) and the badges (KittenBadges) ----

export const KITTEN_ITEMS = [
  { name: "Escudo de madera", kind: "shield", price: 45, amount: 3, multiplier: 1 },
  { name: "Escudo de hierro", kind: "shield", price: 85, amount: 6, multiplier: 1 },
  { name: "Escudo de oro", kind: "shield", price: 150, amount: 12, multiplier: 1 },
  { name: "Potenciador ×2", kind: "booster", price: 70, amount: 5, multiplier: 2 },
  { name: "Potenciador ×3", kind: "booster", price: 120, amount: 5, multiplier: 3 },
  { name: "Gran potenciador ×2", kind: "booster", price: 180, amount: 15, multiplier: 2 },
];

export const canBuyKittenItem = (progress, item) =>
  progress.coins >= item.price && (item.kind === "shield" || !hasBooster(progress) || progress.boosterMultiplier === item.multiplier);

export const waitsForBooster = (progress, item) =>
  item.kind === "booster" && hasBooster(progress) && progress.boosterMultiplier !== item.multiplier;

export function buyKittenItem(progress, item) {
  if (!canBuyKittenItem(progress, item)) return false;
  progress.coins -= item.price;
  if (item.kind === "shield") progress.shields += item.amount;
  else {
    if (!hasBooster(progress)) progress.boosterMultiplier = item.multiplier;
    progress.boosterWins += item.amount;
  }
  return true;
}

export const KITTEN_BADGE_EVERY = 15;
export const KITTEN_BADGES = 8;
export const kittenBadgeLevel = (index) => (index + 1) * KITTEN_BADGE_EVERY;
export const kittenBadgeSticker = (index) => BADGES + index;
/** The badge reaching a level gives, or -1. */
export const kittenBadgeEarnedAt = (level) =>
  level % KITTEN_BADGE_EVERY === 0 && level / KITTEN_BADGE_EVERY <= KITTEN_BADGES ? level / KITTEN_BADGE_EVERY - 1 : -1;

// ---- A board played against a kitten (KittenMatch) ----

export const KittenPhase = { Countdown: "countdown", Playing: "playing", RoundOver: "roundOver", BoardOver: "boardOver" };
export const KITTEN_COUNTDOWN = 3;
export const KITTEN_SHAPES_TIME = 2;
const ROUND_OVER_TIME = Math.fround(2.2);
const KITTEN_SALT = 0x3c47;

export class KittenMatch {
  /** The board halfway in the progress, or a new one of the player's level that keeps clear of the last boards' words. */
  static start(progress, bank, nextSeed) {
    if (progress.board) return new KittenMatch(progress, kittenBoard(progress.board.level, progress.board.seed, bank));
    const level = kittenLevel(progress);
    const seed = kittenFreshSeed(level, nextSeed, bank, progress.recentWords, progress.recentCategories);
    progress.board = { seed, level, results: [] };
    const puzzle = kittenBoard(level, seed, bank);
    rememberKittenWords(progress, puzzle.words.map((placed) => placed.word));
    return new KittenMatch(progress, puzzle);
  }

  constructor(progress, puzzle) {
    this.progress = progress;
    this.puzzle = puzzle;
    this.board = progress.board;
    this.level = this.board.level;
    this.rival = kittenRival(this.level);
    this.difficulty = kittenDifficulty(this.level);
    this.order = kittenOrder(puzzle);
    /** The rounds played: { placed, playerWon }. */
    this.rounds = [];
    for (let i = 0; i < this.board.results.length && i < this.order.length; i++) this.rounds.push({ placed: this.order[i], playerWon: this.board.results[i] });
    this.round = this.rounds.length;
    this.showsShapes = true;
    this.leveledUp = false;
    this.roundShielded = false;
    this.roundCoins = 0;
    this.boardBonus = 0;
    this.onRoundEnded = null;
    this.startRound();
  }

  get shapes() { return this.puzzle.spec.shapes; }
  get target() { return this.order[Math.min(this.round, this.order.length - 1)]; }
  get playerWins() { return this.rounds.filter((r) => r.playerWon).length; }
  get kittenWins() { return this.rounds.filter((r) => !r.playerWon).length; }
  get boardCoins() { return this.playerWins * kittenCoinsPerWord(this.level); }
  get boardWon() { return this.playerWins > this.kittenWins || this.leveledUp; }
  get countdownLength() { return KITTEN_COUNTDOWN + (this.showsShapes ? KITTEN_SHAPES_TIME : 0); }

  /** The number of the countdown to show (3, 2, 1), or 0 before it starts (the shapes) and after. */
  get countdownNumber() {
    if (this.phase !== KittenPhase.Countdown) return 0;
    const left = this.countdownLength - this.phaseTime;
    return left > KITTEN_COUNTDOWN ? 0 : Math.max(1, Math.ceil(left));
  }

  startRound() {
    this.phase = KittenPhase.Countdown;
    this.phaseTime = 0;
    const random = new DotNetRandom(this.board.seed ^ KITTEN_SALT ^ Math.imul(this.round, 7919));
    const strategy = this.difficulty.strategies[random.next(this.difficulty.strategies.length)];
    this.kitten = new KittenSearch(this.puzzle.grid, this.target.word, this.shapes, strategy, this.difficulty, random);
  }

  update(seconds) {
    this.phaseTime += seconds;
    switch (this.phase) {
      case KittenPhase.Countdown:
        if (this.phaseTime < this.countdownLength) return;
        seconds = this.phaseTime - this.countdownLength;
        this.phase = KittenPhase.Playing;
        this.phaseTime = seconds;
        this.kitten.advance(seconds);
        break;
      case KittenPhase.Playing:
        this.kitten.advance(seconds);
        break;
      case KittenPhase.RoundOver:
        if (this.phaseTime < ROUND_OVER_TIME) return;
        if (this.rounds.length >= this.order.length || this.leveledUp) {
          this.phase = KittenPhase.BoardOver;
          this.phaseTime = 0;
          return;
        }
        this.round = this.rounds.length;
        this.showsShapes = false;
        this.startRound();
        return;
      default:
        return;
    }
    if (this.kitten.found) this.endRound({ placed: this.kitten.found, playerWon: false });
  }

  /** The letters the player has selected: the round's word if some of them spell it (any other does not count). */
  tryPlayer(cells) {
    if (this.phase !== KittenPhase.Playing) return null;
    const placed = matchSelection(this.puzzle.grid, cells, [this.target.word], this.shapes);
    if (placed) this.endRound({ placed, playerWon: true });
    return placed;
  }

  endRound(round) {
    const progress = this.progress;
    this.rounds.push(round);
    this.roundShielded = false;
    if (round.playerWon) this.leveledUp = kittenWin(progress) || this.leveledUp;
    else this.roundShielded = kittenLose(progress, kittenPenalty(this.level));
    this.roundCoins = round.playerWon ? kittenCoinsPerWord(this.level) : 0;
    progress.coins += this.roundCoins;
    this.board = { ...this.board, results: [...this.board.results, round.playerWon] };
    // A level up ends the board: the next one is of the new level.
    progress.board = this.rounds.length < this.order.length && !this.leveledUp ? this.board : null;
    if (progress.board === null && this.boardWon) {
      this.boardBonus = this.boardCoins * (KITTEN_BOARD_WON_FACTOR - 1);
      progress.coins += this.boardBonus;
    }
    this.phase = KittenPhase.RoundOver;
    this.phaseTime = 0;
    this.onRoundEnded?.(round);
  }
}
