#!/usr/bin/env node
/**
 * Puzzle generator for Griddle - Target diversity in first horizontal word with randomization
 * Keeps searching until target count is reached (no overlap with existing OR new puzzles)
 *
 * Deterministic mode: pass --seed <int> to reproduce a run exactly (same seed =>
 * same puzzles, assuming same words.ts and puzzles.ts inputs). Without --seed, a
 * seed is drawn from Date.now() and logged, so the run can still be reproduced.
 *
 * Each candidate's best (theoretical minimum guess count) is computed
 * and logged: best-relative star scoring keeps every puzzle's stars honest.
 *
 * Usage: node scripts/generate-h0-diverse.cjs [count] [--seed N]
 */

const fs = require('fs');

// ---------- CLI args ----------
const argv = process.argv.slice(2);
let targetCount = 20;
let seed = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--seed' && i + 1 < argv.length) seed = parseInt(argv[++i], 10);
  else if (!a.startsWith('--') && /^\d+$/.test(a)) targetCount = parseInt(a, 10);
  else throw new Error(`Unknown argument: ${a}`);
}
if (seed === null || Number.isNaN(seed)) {
  seed = (Date.now() % 4294967296) >>> 0;
  console.log(`No --seed given; using seed=${seed} (pass --seed ${seed} to reproduce this run)`);
} else {
  console.log(`Using seed=${seed}`);
}

// ---------- Seeded PRNG (mulberry32) + Fisher-Yates shuffle ----------
// All randomness in this script flows through `rand`, so a fixed seed makes
// the entire run reproducible. (Replaces the old sort(() => Math.random()-0.5)
// idiom, which was both unseeded and a biased shuffle.)
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(seed);
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- Minimum-guess computation ----------
// Cell map: 6 words (h0,h1,h2,v0,v1,v2) x 5 letter positions -> [row, col]
const CELL_MAP = [
  [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], // h0
  [[2, 0], [2, 1], [2, 2], [2, 3], [2, 4]], // h1
  [[4, 0], [4, 1], [4, 2], [4, 3], [4, 4]], // h2
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], // v0
  [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]], // v1
  [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4]], // v2
];

/**
 * Best (theoretical minimum guess count) for a puzzle.
 * Six shared cells sit at different positions in their horizontal vs vertical
 * words and may be completed through either orientation: 2^6 = 64 choices.
 * For each choice, count distinct letters demanded at each guess position;
 * best = min over choices of the max over positions.
 * Verified against the exact real-word set cover on all rotation puzzles
 * (scripts/compute-best.cjs): 0 diffs.
 */
function computeBest(puzzle) {
  const words = [...puzzle.h, ...puzzle.v];
  const cells = new Map(); // "r,c" -> [{pos, letter}]
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

// ---------- Word pool ----------
const wordsContent = fs.readFileSync('src/words.ts', 'utf8');
// Build puzzles from the ANSWERS pool (curated answer words) so generated
// puzzles use fair, familiar words; the full WORDS list is for guess validation.
const answersMatch = wordsContent.match(/export const ANSWERS: string\[\] = \[([\s\S]*?)\];/);
if (!answersMatch) throw new Error('Could not parse ANSWERS from src/words.ts');
// Six words removed from the upstream answer list after its acquisition
// (obscure: agora, pupal, fibre; insensitive: lynch, slave, wench).
// They remain valid guesses.
const EXCLUDED = new Set(['agora', 'pupal', 'lynch', 'fibre', 'slave', 'wench']);
const words = answersMatch[1].match(/'([a-z]{5})'/g).map((w) => w.slice(1, -1)).filter((w) => !EXCLUDED.has(w));

const byPattern = new Map();
for (const w of words) {
  const key = w[0] + ',' + w[2] + ',' + w[4];
  if (!byPattern.has(key)) byPattern.set(key, []);
  byPattern.get(key).push(w);
}

// Load existing puzzles
let existingPuzzles = [];
try {
  const dataContent = fs.readFileSync('src/puzzles.ts', 'utf8');
  const match = dataContent.match(/export const PUZZLES: Puzzle\[\] = (\[[\s\S]*?\]);/);
  if (match) existingPuzzles = eval('(' + match[1] + ')');
} catch (e) {
  console.log('Could not load existing:', e.message);
}

const used = new Set();
for (const p of existingPuzzles) {
  [...p.h, ...p.v].forEach((w) => used.add(w));
}

console.log(`Existing: ${existingPuzzles.length} puzzles, ${used.size} words used`);

// Track first letter of h[0] (first horizontal word)
const h0FirstCounts = {};
for (const p of existingPuzzles) {
  h0FirstCounts[p.h[0][0]] = (h0FirstCounts[p.h[0][0]] || 0) + 1;
}
console.log('\nCurrent h[0] first letter distribution:');
for (const [l, c] of Object.entries(h0FirstCounts).sort()) {
  console.log(`  ${l}: ${c}`);
}

// Find ONE puzzle where h[0] starts with target letter
// batchUsed: words already selected in this batch (to avoid intra-batch overlap)
// best is computed and logged as the puzzle's best score, but does not filter.
function findPuzzleForH0Letter(targetLetter, batchUsed) {
  // Shuffle word arrays (seeded)
  const shuffledV0 = shuffle(words.filter((w) => w[0] === targetLetter));
  const shuffledV1 = shuffle([...words]);
  const shuffledV2 = shuffle([...words]);

  for (const v0 of shuffledV0) {
    for (const v1 of shuffledV1) {
      for (const v2 of shuffledV2) {
        const h0Key = v0[0] + ',' + v1[0] + ',' + v2[0];
        const h1Key = v0[2] + ',' + v1[2] + ',' + v2[2];
        const h2Key = v0[4] + ',' + v1[4] + ',' + v2[4];

        const h0s = byPattern.get(h0Key) || [];
        const h1s = byPattern.get(h1Key) || [];
        const h2s = byPattern.get(h2Key) || [];

        if (h0s.length === 0 || h1s.length === 0 || h2s.length === 0) continue;

        // Shuffle h candidates too (seeded)
        const shuffledH0 = shuffle([...h0s]);
        const shuffledH1 = shuffle([...h1s]);
        const shuffledH2 = shuffle([...h2s]);

        for (const h0 of shuffledH0) {
          if (h0[0] !== targetLetter) continue;

          for (const h1 of shuffledH1) {
            for (const h2 of shuffledH2) {
              const allWords = [h0, h1, h2, v0, v1, v2];
              const unique = new Set(allWords);
              if (unique.size !== 6) continue;
              // Check against both existing used words AND batch-used words
              if (allWords.some((w) => used.has(w) || batchUsed.has(w))) continue;

              const puzzle = { h: [h0, h1, h2], v: [v0, v1, v2] };
              puzzle.best = computeBest(puzzle);
              return puzzle;
            }
          }
        }
      }
    }
  }
  return null;
}

// Find puzzles for randomized target letters - keep cycling until target reached
const newPuzzles = [];

// All letters, shuffled (seeded)
let letters = shuffle('abcdefghijklmnopqrstuvwxyz'.split(''));
let letterIndex = 0;

// Track words used within this batch to avoid intra-batch overlap
const batchUsed = new Set();

// Safety guard: stop rather than loop forever if letters stop yielding puzzles.
let consecutiveMisses = 0;
const maxConsecutiveMisses = 130; // 5 full alphabet cycles

while (newPuzzles.length < targetCount && consecutiveMisses < maxConsecutiveMisses) {
  const letter = letters[letterIndex];
  letterIndex++;

  // Reshuffle letters if we've exhausted all 26
  if (letterIndex >= letters.length) {
    letters = shuffle('abcdefghijklmnopqrstuvwxyz'.split(''));
    letterIndex = 0;
  }

  const p = findPuzzleForH0Letter(letter, batchUsed);
  if (!p) {
    console.log(`  No puzzles found for h[0]='${letter}', trying next letter...`);
    consecutiveMisses++;
    continue;
  }

  consecutiveMisses = 0;
  newPuzzles.push(p);
  [...p.h, ...p.v].forEach((w) => {
    used.add(w);
    batchUsed.add(w);
  });
  console.log(`Added for h[0]='${letter}' (best=${p.best}): h=[${p.h.join(', ')}] v=[${p.v.join(', ')}]`);
}

if (consecutiveMisses >= maxConsecutiveMisses) {
  console.log(`\nStopped early: ${maxConsecutiveMisses} consecutive letters yielded no puzzle.`);
}

console.log(`\nFound ${newPuzzles.length} new diverse puzzles:`);
for (let i = 0; i < newPuzzles.length; i++) {
  const p = newPuzzles[i];
  console.log(`  { h: [${p.h.map((w) => `"${w}"`).join(', ')}], v: [${p.v.map((w) => `"${w}"`).join(', ')}], best: ${p.best} },`);
}

const allPuzzles = [...existingPuzzles, ...newPuzzles.map(({ best, ...rest }) => rest)];
const allWords = new Set(allPuzzles.flatMap((p) => [...p.h, ...p.v]));

const finalH0Dist = {};
for (const p of allPuzzles) {
  finalH0Dist[p.h[0][0]] = (finalH0Dist[p.h[0][0]] || 0) + 1;
}

console.log(`\nTotal: ${allPuzzles.length} puzzles, ${allWords.size} unique words`);
console.log('\nFinal h[0] first letter distribution:');
for (const l of 'abcdefghijklmnopqrstuvwxyz'.split('')) {
  if (finalH0Dist[l]) console.log(`  ${l}: ${finalH0Dist[l]}`);
}
