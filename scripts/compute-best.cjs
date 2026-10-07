#!/usr/bin/env node
/**
 * Compute the real-word best (minimum) guess count for each Griddle puzzle.
 *
 * This is a minimum set cover over the 21 letter cells: each allowed guess
 * word covers the cells where it has the right letter in the right position
 * (greens only). The minimum set cover = the fewest real-word guesses that
 * could solve the puzzle (perfect-information/clairvoyant optimum).
 *
 * Deterministic, exact, no AI: 21-bit masks + iterative-deepening DFS with
 * branch and bound. The arbitrary-string k_min is used as the lower bound.
 *
 * Usage: node scripts/compute-best.cjs [--puzzle N] [--all]
 *   --puzzle N : compute for PUZZLES[N] only (0-based)
 *   --all      : compute for all puzzles, emit JSON {index: best}
 */

const fs = require('fs');

// ---------- Load data ----------
const CELL_MAP = [
  [[0,0],[0,1],[0,2],[0,3],[0,4]],
  [[2,0],[2,1],[2,2],[2,3],[2,4]],
  [[4,0],[4,1],[4,2],[4,3],[4,4]],
  [[0,0],[1,0],[2,0],[3,0],[4,0]],
  [[0,2],[1,2],[2,2],[3,2],[4,2]],
  [[0,4],[1,4],[2,4],[3,4],[4,4]]
];

// cell key -> bit index (21 letter cells)
const cellBit = new Map();
let bitIdx = 0;
for (let wi = 0; wi < 6; wi++) {
  for (let i = 0; i < 5; i++) {
    const [r, c] = CELL_MAP[wi][i];
    const key = r + ',' + c;
    if (!cellBit.has(key)) cellBit.set(key, bitIdx++);
  }
}
const NCELLS = bitIdx; // 21
const FULL = (1 << NCELLS) - 1;

const wordsContent = fs.readFileSync('src/words.ts', 'utf8');
const wordsMatch = wordsContent.match(/export const WORDS: string\[\] = \[([\s\S]*?)\];/);
if (!wordsMatch) throw new Error('Could not parse WORDS from src/words.ts');
const WORDS = wordsMatch[1].match(/'([a-z]{5})'/g).map((w) => w.slice(1, -1));
console.log(`Loaded ${WORDS.length} guess words`);

const puzzlesContent = fs.readFileSync('src/puzzles.ts', 'utf8');
const puzzlesMatch = puzzlesContent.match(/export const PUZZLES: [A-Za-z]+\[\] = (\[[\s\S]*?\]);/);
if (!puzzlesMatch) throw new Error('Could not parse PUZZLES from src/puzzles.ts');
const PUZZLES = eval('(' + puzzlesMatch[1] + ')');
console.log(`Loaded ${PUZZLES.length} puzzles`);

// ---------- Arbitrary-string k_min (lower bound) ----------
function arbitraryKMin(puzzle) {
  const words = [...puzzle.h, ...puzzle.v];
  const cells = new Map();
  for (let wi = 0; wi < 6; wi++) {
    for (let i = 0; i < 5; i++) {
      const [r, c] = CELL_MAP[wi][i];
      const key = r + ',' + c;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push({ pos: i, letter: words[wi][i] });
    }
  }
  const flex = [];
  const fixed = [];
  for (const arr of cells.values()) {
    if (new Set(arr.map((x) => x.pos)).size > 1) flex.push(arr);
    else fixed.push(arr[0]);
  }
  let best = Infinity;
  for (let mask = 0; mask < 1 << flex.length; mask++) {
    const perPos = [new Set(), new Set(), new Set(), new Set(), new Set()];
    for (const { pos, letter } of fixed) perPos[pos].add(letter);
    for (let k = 0; k < flex.length; k++) {
      const { pos, letter } = flex[k][(mask >> k) & 1];
      perPos[pos].add(letter);
    }
    let m = 0;
    for (const s of perPos) m = Math.max(m, s.size);
    if (m < best) best = m;
  }
  return best;
}

// ---------- Coverage masks ----------
function coverageMask(guess, answers) {
  let mask = 0;
  for (let wi = 0; wi < 6; wi++) {
    for (let i = 0; i < 5; i++) {
      if (guess[i] === answers[wi][i]) {
        const [r, c] = CELL_MAP[wi][i];
        mask |= 1 << cellBit.get(r + ',' + c);
      }
    }
  }
  return mask;
}

function popcount(n) {
  let c = 0;
  while (n) { c += n & 1; n >>>= 1; }
  return c;
}

// ---------- Minimum set cover via IDDFS ----------
function minRealWordGuesses(puzzle) {
  const answers = [...puzzle.h, ...puzzle.v];
  const lower = arbitraryKMin(puzzle);

  // Build unique coverage masks
  const maskSet = new Set();
  for (const w of WORDS) {
    const m = coverageMask(w, answers);
    if (m !== 0) maskSet.add(m);
  }
  let masks = [...maskSet];
  // Drop strictly dominated masks (subset of another)
  masks.sort((a, b) => popcount(b) - popcount(a));
  const kept = [];
  for (const m of masks) {
    if (!kept.some((k) => (m | k) === k)) kept.push(m);
  }
  masks = kept;

  const maxBits = Math.max(...masks.map(popcount));

  // For each cell bit, list of mask indices covering it (for branching)
  const byCell = Array.from({ length: NCELLS }, () => []);
  masks.forEach((m, idx) => {
    for (let b = 0; b < NCELLS; b++) {
      if (m & (1 << b)) byCell[b].push(idx);
    }
  });
  // Try high-coverage masks first
  for (const list of byCell) {
    list.sort((a, b) => popcount(masks[b]) - popcount(masks[a]));
  }

  const memo = new Map();
  function dfs(remaining, depth) {
    if (remaining === 0) return true;
    if (depth === 0) return false;
    // Lower bound prune
    if (Math.ceil(popcount(remaining) / maxBits) > depth) return false;
    const key = remaining * 8 + depth;
    if (memo.has(key)) return memo.get(key);
    // Branch on first uncovered cell
    let bit = 0;
    while (!(remaining & (1 << bit))) bit++;
    for (const idx of byCell[bit]) {
      if (dfs(remaining & ~masks[idx], depth - 1)) {
        memo.set(key, true);
        return true;
      }
    }
    memo.set(key, false);
    return false;
  }

  for (let k = lower; k <= 6; k++) {
    memo.clear();
    if (dfs(FULL, k)) return k;
  }
  return 6; // fallback: guessing the 6 answers always works
}

// ---------- CLI ----------
const argv = process.argv.slice(2);
let onlyIdx = -1;
let all = false;
for (const a of argv) {
  if (a === '--all') all = true;
  else if (a === '--puzzle' && argv[argv.indexOf(a) + 1]) {
    onlyIdx = parseInt(argv[argv.indexOf(a) + 1], 10);
  }
}

if (onlyIdx >= 0) {
  const t0 = Date.now();
  const b = minRealWordGuesses(PUZZLES[onlyIdx]);
  console.log(`Puzzle ${onlyIdx}: best=${b} (${Date.now() - t0}ms)`);
} else if (all) {
  const out = {};
  const t0 = Date.now();
  for (let i = 0; i < PUZZLES.length; i++) {
    const p0 = Date.now();
    out[i] = minRealWordGuesses(PUZZLES[i]);
    console.log(`  puzzle ${i}: best=${out[i]} (${Date.now() - p0}ms)`);
  }
  console.log(JSON.stringify(out));
  console.log(`Total: ${Date.now() - t0}ms`);
} else {
  console.log('Usage: node scripts/compute-best.cjs [--puzzle N | --all]');
}
