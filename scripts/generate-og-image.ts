// Generates src/public/og-image.png from a REAL game state.
//
// The demo board is not hand-designed: two real guesses ("glare", "alert")
// are run through the actual game code (stateAt / gridLetters from
// src/game.ts) against a real mini-puzzle (GRILL / ALARM / ELECT across,
// GRADE / IMAGE / LIMIT down). Tile colors and letters are rendered exactly
// like the live game does in src/main.ts:
//   green tile -> confirmed letter (true letter)
//   yellow tile -> the guessed letter that scored yellow
//   dark tile  -> still unknown (empty)
// Run with: npx vite-node scripts/generate-og-image.ts
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import { stateAt, gridLetters, validatePuzzle } from '../src/game';
import { WORDS } from '../src/words';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GAP_POSITIONS = new Set(['1,1', '1,3', '3,1', '3,3']);

// Demo puzzle: six real words, intersections match (validated below).
const puzzle = { h: ['grill', 'alarm', 'elect'], v: ['grade', 'image', 'limit'] };
// Demo play: two real guesses, scored by the real game code.
const guesses = ['grill', 'amber'];

const errors = validatePuzzle(puzzle);
if (errors.length > 0) throw new Error('demo puzzle invalid: ' + errors.join('; '));
for (const g of guesses) {
  if (!WORDS.includes(g)) throw new Error(`demo guess not in word list: ${g}`);
}

const answers = [...puzzle.h, ...puzzle.v];
const letters = gridLetters(puzzle);
const state = stateAt(guesses.length - 1, guesses, answers);

// Build the grid exactly as the live game renders it (see src/main.ts):
// green -> true letter, yellow -> guessed letter, dark -> empty.
type Cell = { type: 'green' | 'yellow' | 'dark' | 'gap'; letter: string };
const grid: Cell[][] = [];
for (let r = 0; r < 5; r++) {
  grid[r] = [];
  for (let c = 0; c < 5; c++) {
    if (GAP_POSITIONS.has(`${r},${c}`)) {
      grid[r][c] = { type: 'gap', letter: '' };
      continue;
    }
    if (state.green[r][c]) grid[r][c] = { type: 'green', letter: letters[r][c].toUpperCase() };
    else if (state.yellow[r][c]) grid[r][c] = { type: 'yellow', letter: state.yellow[r][c].toUpperCase() };
    else grid[r][c] = { type: 'dark', letter: '' };
  }
}

const styles = {
  green: { bg: '#3aa35a', border: '#2e8a4c', text: '#ffffff' },
  yellow: { bg: '#c9a227', border: '#a78316', text: '#211900' },
  dark: { bg: '#243044', border: '#718098', text: '#e8eef7' },
};

const cellSize = 76;
const cellGap = 12;
const gridStartX = 690;
const gridStartY = 101;

let gridSvg = '';

for (let r = 0; r < 5; r++) {
  for (let c = 0; c < 5; c++) {
    const cell = grid[r][c];
    if (cell.type === 'gap') continue;

    const x = gridStartX + c * (cellSize + cellGap);
    const y = gridStartY + r * (cellSize + cellGap);
    const style = styles[cell.type];

    gridSvg += `
      <g transform="translate(${x}, ${y})">
        <rect width="${cellSize}" height="${cellSize}" rx="12" fill="${style.bg}" stroke="${style.border}" stroke-width="3"/>
        ${cell.letter ? `<text x="${cellSize / 2}" y="${cellSize / 2 + 14}" font-family="system-ui, -apple-system, sans-serif" font-size="40" font-weight="800" fill="${style.text}" text-anchor="middle">${cell.letter}</text>` : ''}
      </g>
    `;
  }
}

const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="-10%" r="1100" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#1c2a40"/>
      <stop offset="100%" stop-color="#0f1419"/>
    </radialGradient>
    <style>
      .title-kicker { font-family: system-ui, -apple-system, sans-serif; font-size: 20px; font-weight: 800; fill: #6cb6ff; letter-spacing: 3px; }
      .title-main { font-family: system-ui, -apple-system, sans-serif; font-size: 72px; font-weight: 900; fill: #ffffff; letter-spacing: 4px; }
      .desc { font-family: system-ui, -apple-system, sans-serif; font-size: 22px; fill: #8b9bb4; line-height: 1.5; }
      .badge-text { font-family: system-ui, -apple-system, sans-serif; font-size: 16px; font-weight: 700; fill: #e8eef7; }
    </style>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Left Side: Header & Meta -->
  <g transform="translate(80, 110)">
    <text x="0" y="30" class="title-kicker">DAILY WORD PUZZLE</text>
    <text x="0" y="105" class="title-main">GRIDDLE</text>

    <text x="0" y="175" class="desc">Find 6 interlocking words in a 5×5 grid weave.</text>
    <text x="0" y="210" class="desc">Solve the daily puzzle in 10 guesses or fewer!</text>

    <!-- Badges -->
    <g transform="translate(0, 270)">
      <!-- Badge 1: 🧩 6 Words -->
      <g transform="translate(0, 0)">
        <rect x="0" y="0" width="130" height="42" rx="21" fill="#1a2332" stroke="#52627a" stroke-width="1.5"/>
        <text x="65" y="26" class="badge-text" text-anchor="middle">🧩 6 Words</text>
      </g>
      <!-- Badge 2: 🎯 10 Guesses -->
      <g transform="translate(142, 0)">
        <rect x="0" y="0" width="145" height="42" rx="21" fill="#1a2332" stroke="#52627a" stroke-width="1.5"/>
        <text x="72.5" y="26" class="badge-text" text-anchor="middle">🎯 10 Guesses</text>
      </g>
      <!-- Badge 3: 📅 Daily Challenge -->
      <g transform="translate(299, 0)">
        <rect x="0" y="0" width="175" height="42" rx="21" fill="#1a2332" stroke="#52627a" stroke-width="1.5"/>
        <text x="87.5" y="26" class="badge-text" text-anchor="middle">📅 Daily Challenge</text>
      </g>
    </g>
  </g>

  <!-- Right Side: 5x5 Grid -->
  ${gridSvg}
</svg>
`;

const outputPath = path.resolve(__dirname, '../src/public/og-image.png');

sharp(Buffer.from(svg))
  .png()
  .toFile(outputPath)
  .then(() => {
    console.log(`og-image.png generated from guesses: ${guesses.join(' -> ')}`);
  })
  .catch((err) => {
    console.error('Error generating og-image.png:', err);
    process.exit(1);
  });
