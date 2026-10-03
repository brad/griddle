#!/usr/bin/env node
/**
 * Puzzle generator for Weavle - Target diversity in first horizontal word with randomization
 * Keeps searching until target count is reached (no overlap with existing OR new puzzles)
 */

const fs = require('fs');

const wordsContent = fs.readFileSync('src/words.ts', 'utf8');
// Build puzzles from the ANSWERS pool (curated answer words) so generated
// puzzles use fair, familiar words; the full WORDS list is for guess validation.
const answersMatch = wordsContent.match(/export const ANSWERS: string\[\] = \[([\s\S]*?)\];/);
if (!answersMatch) throw new Error('Could not parse ANSWERS from src/words.ts');
// Six words removed from the upstream answer list after its acquisition
// (obscure: agora, pupal, fibre; insensitive: lynch, slave, wench).
// They remain valid guesses.
const EXCLUDED = new Set(['agora', 'pupal', 'lynch', 'fibre', 'slave', 'wench']);
const words = answersMatch[1].match(/'([a-z]{5})'/g).map(w => w.slice(1, -1)).filter(w => !EXCLUDED.has(w));

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
} catch (e) { console.log('Could not load existing:', e.message); }

const used = new Set();
for (const p of existingPuzzles) {
  [...p.h, ...p.v].forEach(w => used.add(w));
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
function findPuzzleForH0Letter(targetLetter, batchUsed) {
  // Shuffle word arrays for randomization
  const shuffledV0 = words.filter(w => w[0] === targetLetter).sort(() => Math.random() - 0.5);
  const shuffledV1 = [...words].sort(() => Math.random() - 0.5);
  const shuffledV2 = [...words].sort(() => Math.random() - 0.5);
  
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
        
        // Shuffle h candidates too
        const shuffledH0 = [...h0s].sort(() => Math.random() - 0.5);
        const shuffledH1 = [...h1s].sort(() => Math.random() - 0.5);
        const shuffledH2 = [...h2s].sort(() => Math.random() - 0.5);
        
        for (const h0 of shuffledH0) {
          if (h0[0] !== targetLetter) continue;
          
          for (const h1 of shuffledH1) {
            for (const h2 of shuffledH2) {
              const allWords = [h0, h1, h2, v0, v1, v2];
              const unique = new Set(allWords);
              if (unique.size !== 6) continue;
              // Check against both existing used words AND batch-used words
              if (allWords.some(w => used.has(w) || batchUsed.has(w))) continue;
              
              return { h: [h0, h1, h2], v: [v0, v1, v2] };
            }
          }
        }
      }
    }
  }
  return null;
}

// Find puzzles for randomized target letters - keep cycling until target reached
const targetCount = parseInt(process.argv[2]) || 20;
const newPuzzles = [];

// All letters, shuffled
let letters = 'abcdefghijklmnopqrstuvwxyz'.split('').sort(() => Math.random() - 0.5);
let letterIndex = 0;

// Track words used within this batch to avoid intra-batch overlap
const batchUsed = new Set();

while (newPuzzles.length < targetCount) {
  const letter = letters[letterIndex];
  letterIndex++;
  
  // Reshuffle letters if we've exhausted all 26
  if (letterIndex >= letters.length) {
    letters = 'abcdefghijklmnopqrstuvwxyz'.split('').sort(() => Math.random() - 0.5);
    letterIndex = 0;
  }
  
  const p = findPuzzleForH0Letter(letter, batchUsed);
  if (!p) {
    console.log(`  No puzzles found for h[0]='${letter}', trying next letter...`);
    continue;
  }
  
  newPuzzles.push(p);
  [...p.h, ...p.v].forEach(w => {
    used.add(w);
    batchUsed.add(w);
  });
  console.log(`Added for h[0]='${letter}': h=[${p.h.join(', ')}] v=[${p.v.join(', ')}]`);
}

console.log(`\nFound ${newPuzzles.length} new diverse puzzles:`);
for (let i = 0; i < newPuzzles.length; i++) {
  const p = newPuzzles[i];
  console.log(`  ${i + 1}: h=[${p.h.join(', ')}] v=[${p.v.join(', ')}]`);
}

const allPuzzles = [...existingPuzzles, ...newPuzzles];
const allWords = new Set(allPuzzles.flatMap(p => [...p.h, ...p.v]));

const finalH0Dist = {};
for (const p of allPuzzles) {
  finalH0Dist[p.h[0][0]] = (finalH0Dist[p.h[0][0]] || 0) + 1;
}

console.log(`\nTotal: ${allPuzzles.length} puzzles, ${allWords.size} unique words`);
console.log('\nFinal h[0] first letter distribution:');
for (const l of 'abcdefghijklmnopqrstuvwxyz'.split('')) {
  if (finalH0Dist[l]) console.log(`  ${l}: ${finalH0Dist[l]}`);
}