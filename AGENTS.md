# Griddle Agent Guide

## Project Overview

Griddle is a daily word puzzle game where players find six overlapping 5-letter words (3 horizontal, 3 vertical) in a 5x5 waffle grid. Players have 12 guesses (MAX_GUESSES in src/data.ts) to solve all 6 words.

## Architecture

- **src/main.ts** - Main game logic, UI rendering, event handling
- **src/game.ts** - Core game logic: scoring, state tracking, grid letters
- **src/share.ts** - Share format generation (Waffle-style with emoji grid)
- **src/validation.ts** - Puzzle validation (structure, dictionary, no-repeat rule)
- **src/data.ts** - Constants, word list, keyboard layout
- **src/puzzles.ts** - Puzzle definitions (separate file for maintainability)
- **src/words.ts** - Auto-generated word lists (MIT, see THIRD-PARTY-NOTICES.md): `WORDS` (12,972 guessable words) and `ANSWERS` (2,315 answer words)
- **src/types.ts** - TypeScript interfaces
- **src/index.html** - HTML structure with embedded CSS

## Key Concepts

### Grid Structure

```
Row 0: h[0][0] h[0][1] h[0][2] h[0][3] h[0][4]
Row 1: v[0][1]  GAP   v[1][1]  GAP   v[2][1]
Row 2: h[1][0] h[1][1] h[1][2] h[1][3] h[1][4]
Row 3: v[0][3]  GAP   v[1][3]  GAP   v[2][3]
Row 4: h[2][0] h[2][1] h[2][2] h[2][3] h[2][4]
```

Intersections (must match):
- (0,0): h[0][0] = v[0][0]
- (0,2): h[0][2] = v[1][0]
- (0,4): h[0][4] = v[2][0]
- (2,0): h[1][0] = v[0][2]
- (2,2): h[1][2] = v[1][2]
- (2,4): h[1][4] = v[2][2]
- (4,0): h[2][0] = v[0][4]
- (4,2): h[2][2] = v[1][4]
- (4,4): h[2][4] = v[2][4]

Gap positions (always empty): (1,1), (1,3), (3,1), (3,3)

### Scoring

Each guess is scored against all 6 answer words simultaneously, using standard 5-letter word-game scoring:
- **Green (🟩)**: Letter correct in that exact position
- **Yellow (🟨)**: Letter exists in word but different position
- **Gray (⬛)**: Letter not in word

Duplicate letters: each target word's letter can only be matched once.

### Daily Puzzle Selection

Puzzle number = days since epoch (2026-01-01). Cycles through PUZZLES array.

## Adding New Puzzles

### Requirements

1. **Valid Structure**: 3 horizontal + 3 vertical 5-letter words with matching intersections
2. **Dictionary Words**: All 6 words must exist in `ANSWERS` (the 2,315 curated answer words — the familiarity policy; guesses may use the full `VALID` list)
3. **Unique Words**: No duplicates within a puzzle
4. **No Recent Repeats**: Words cannot appear in previous 30 puzzles (180 words)

### Process

1. **Find valid puzzle** - Use the pattern matching approach:
   - Pick 3 vertical words (v0, v1, v2)
   - Derive required horizontal patterns:
     - h0: v0[0] + v1[0] + ? + v2[0] + ?
     - h1: v0[2] + v1[2] + ? + v2[2] + ?
     - h2: v0[4] + v1[4] + ? + v2[4] + ?
   - Find matching horizontal words from dictionary

2. **Verify no word overlap** with recent puzzles (check last 30 puzzles in PUZZLES array)

3. **Add to PUZZLES array** in src/data.ts

4. **Run validation**: `npm run test` - validates all puzzles

### Example Script

```bash
# Find valid puzzle patterns
node -e "
const fs = require('fs');
const words = fs.readFileSync('src/words.ts', 'utf8')
  .match(/'([a-z]{5})'/g).map(w => w.slice(1, -1));

const byPattern = new Map();
for (const w of words) {
  const key = w[0] + ',' + w[2] + ',' + w[4];
  if (!byPattern.has(key)) byPattern.set(key, []);
  byPattern.get(key).push(w);
}

// Try vertical words
const v0 = 'crane', v1 = 'apple', v2 = 'toast';
const h0s = byPattern.get(v0[0]+','+v1[0]+','+v2[0]) || [];
const h1s = byPattern.get(v0[2]+','+v1[2]+','+v2[2]) || [];
const h2s = byPattern.get(v0[4]+','+v1[4]+','+v2[4]) || [];
console.log('h0:', h0s);
console.log('h1:', h1s);
console.log('h2:', h2s);
"
```

### Puzzle Generation Scripts

```bash
# Generate diverse puzzles by searching for valid puzzles with each possible
# starting letter of h[0] (first horizontal word) in random order
node scripts/generate-h0-diverse.cjs [count]

# Example: generate 20 new diverse puzzles
node scripts/generate-h0-diverse.cjs 20
```

This script:
1. Loads existing puzzles from `src/puzzles.ts` and tracks current h[0] first letter distribution
2. Iterates through all letters a-z in random order (cycling until target reached)
3. For each letter, searches for valid 6-word waffle puzzles where h[0] starts with that letter
4. Only accepts puzzles with zero word overlap with existing puzzles AND zero overlap within the generated batch
5. Outputs new puzzles ready to add to `src/puzzles.ts`
6. Reports final h[0] first letter distribution

### Adding New Puzzles (Workflow)

```bash
# 1. Generate new diverse puzzles (e.g., 10)
node scripts/generate-h0-diverse.cjs 10

# 2. Copy the output puzzles (from "Found X new diverse puzzles:" section,
#    now emitted as { h: [...], v: [...], best: N } lines ready to paste)
#    and append them to src/puzzles.ts array (no blank lines, no comments)

# 3. Verify the best values with the exact real-word set-cover solver
node scripts/compute-best.cjs --all

# 4. Run validation to ensure no word overlap and all constraints pass
npm run test
```

Example output to copy:
```
  1: h=[halls, nudge, sieve] v=[hands, ladle, siege]
  2: h=[magic, loose, needs] v=[melon, globe, crews]
  ...
```

Append to `src/puzzles.ts`:
```typescript
  { h: ["halls", "nudge", "sieve"], v: ["hands", "ladle", "siege"] },
  { h: ["magic", "loose", "needs"], v: ["melon", "globe", "crews"] },
];
```

### Updating Word List

```bash
npm run update-words
# Fetches the allowed-guesses + answers lists from
# https://github.com/erikolsson/wordle-clone (MIT, see THIRD-PARTY-NOTICES.md)
# Updates src/words.ts (WORDS = 12,972 guessable words, ANSWERS = 2,315 answer words)
```

Puzzle generation (`scripts/generate-h0-diverse.cjs`) draws from `ANSWERS` so new
puzzles use fair, familiar answer words; guess validation uses the full `WORDS` list.

## Validation Rules (src/validation.ts)

- Exactly 3 horizontal and 3 vertical words
- All words exactly 5 letters
- All words in ANSWERS dictionary (answer-list policy; enforced by test)
- No duplicate words within puzzle
- All 9 grid intersections match
- No word used in previous 30 puzzles (180-word window)

## Share Format

```
Griddle 123 6/12 · best 6
🟩 🟩 🟩 🟩 🟩
🟩 ⭐ 🟩 ⭐ 🟩
🟩 🟩 🟩 🟩 🟩
🟩 ⭐ 🟩 ⭐ 🟩
🟩 🟩 🟩 🟩 🟩
```

- Header: "Griddle {number} {guesses made}/{MAX_GUESSES} · best {best}" (best is
  the puzzle's theoretical minimum guess count; a perfect game matches best)
- Grid: 5x5 emoji grid showing final state, squares space-separated
  - 🟩 = green (solved)
  - 🟨 = yellow (hint)
  - ⬛ = gray (wrong)
  - ⬜ = gap (empty)
  - ⭐ = stars in gap positions (up to 4, best-relative: 4 at best or better,
    one fewer per guess over best, floored at 0)

## Development

```bash
npm run dev      # Start Vite dev server
npm run build    # TypeScript compile + Vite build
npm run test     # Run vitest tests
npm run update-words  # Refresh word list
```

## Testing

- `validation.test.ts` - Puzzle validation logic
- `share.test.ts` - Share format generation

Run with: `npm run test`

## Deployment

GitHub Actions CI (`.github/workflows/ci.yml`):
1. Runs tests on every PR/push
2. Builds on merge to main
3. Deploys to GitHub Pages

## Key Constants (src/data.ts)

- `EPOCH`: 2026-01-01 (day 1)
- `KEY_ROWS`: Keyboard layout (capitalized, with Enter/Delete symbols)
- `MAP`: Grid coordinate mappings for 6 words
- `VALID`: Set of 12,972 allowed guess words