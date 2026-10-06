// Generates src/public/og-image.gif — an animated full-game replay.
//
// Seven real guesses (grill -> amber -> alarm -> elect -> grade -> image ->
// limit) are played through the actual game code (stateAt / gridLetters from
// src/game.ts) against a real mini-puzzle (GRILL / ALARM / ELECT across,
// GRADE / IMAGE / LIMIT down). Every frame renders tiles exactly like the
// live game does in src/cell.ts: green = confirmed letter, yellow = hint
// letter(s), dark = unknown. Tiles that change between guesses flip
// over, then the final solved board holds before the loop restarts.
//
// Note: most link-preview crawlers (X, Facebook, iMessage) show only the
// GIF's first frame as a static image; Discord animates it. The first frame
// is the guess-1 board (GRILL solved), so the static fallback still looks
// like a real game.
//
// Run with: npx vite-node scripts/generate-og-image.ts
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { stateAt, gridLetters, validatePuzzle, best } from '../src/game';
import { WORDS } from '../src/words';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const W = 1200;
const H = 630;
const GAP_POSITIONS = new Set(['1,1', '1,3', '3,1', '3,3']);

// Demo puzzle: six real words, intersections match (validated below).
const puzzle = { h: ['grill', 'alarm', 'elect'], v: ['grade', 'image', 'limit'] };
// Demo game: a full solve, played for real by the game code.
const guesses = ['grill', 'amber', 'alarm', 'elect', 'grade', 'image', 'limit'];

const errors = validatePuzzle(puzzle);
if (errors.length > 0) throw new Error('demo puzzle invalid: ' + errors.join('; '));
for (const g of guesses) {
  if (!WORDS.includes(g)) throw new Error(`demo guess not in word list: ${g}`);
}

const answers = [...puzzle.h, ...puzzle.v];
const letters = gridLetters(puzzle);

type TileType = 'green' | 'yellow' | 'dark';
interface Tile {
  type: TileType;
  letters: string[]; // green -> [true letter], yellow -> hint letters (1-2), dark -> []
}

// Tiles exactly as the live game renders them (see src/cell.ts):
// green -> true letter, yellow -> hint letter(s), dark -> empty.
function tilesFor(stage: number): (Tile | null)[][] {
  const st = stateAt(stage, guesses, answers);
  const out: (Tile | null)[][] = [];
  for (let r = 0; r < 5; r++) {
    out[r] = [];
    for (let c = 0; c < 5; c++) {
      if (GAP_POSITIONS.has(`${r},${c}`)) {
        out[r][c] = null;
        continue;
      }
      if (st.green[r][c]) out[r][c] = { type: 'green', letters: [letters[r][c].toUpperCase()] };
      else if (st.yellow[r][c].length > 0)
        out[r][c] = { type: 'yellow', letters: st.yellow[r][c].map(h => h.toUpperCase()) };
      else out[r][c] = { type: 'dark', letters: [] };
    }
  }
  return out;
}

const styles: Record<TileType, { bg: string; border: string; text: string }> = {
  green: { bg: '#3aa35a', border: '#2e8a4c', text: '#ffffff' },
  yellow: { bg: '#c9a227', border: '#a78316', text: '#211900' },
  dark: { bg: '#243044', border: '#718098', text: '#e8eef7' },
};

const cellSize = 76;
const cellGap = 12;
const gridStartX = 690;
const gridStartY = 101;

// Stars earned, exactly like share.ts: best-relative, 4 at best or better,
// one fewer per guess over best, floored at 0.
const starCount = Math.min(4, Math.max(0, 4 - (guesses.length - best(puzzle))));
const starPositions: [number, number][] = [[1, 1], [1, 3], [3, 1], [3, 3]].slice(0, starCount);

function starPoints(r: number): string {
  const pts: string[] = [];
  for (let k = 0; k < 10; k++) {
    const rad = k % 2 === 0 ? r : r * 0.42;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    pts.push(`${(rad * Math.cos(a)).toFixed(1)},${(rad * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

function starsSvg(scale: number): string {
  if (scale <= 0 || starPositions.length === 0) return '';
  let s = '';
  for (const [r, c] of starPositions) {
    const cx = gridStartX + c * (cellSize + cellGap) + cellSize / 2;
    const cy = gridStartY + r * (cellSize + cellGap) + cellSize / 2;
    s += `<g transform="translate(${cx},${cy}) scale(${scale.toFixed(3)})">` +
      `<polygon points="${starPoints(24)}" fill="#ffd54a"/></g>`;
  }
  return s;
}

function tileLetters(tile: Tile): string {
  const style = styles[tile.type];
  const font = 'font-family="system-ui, -apple-system, sans-serif" font-weight="800" text-anchor="middle"';
  if (tile.letters.length === 2) {
    // Two stacked hints, like the live game's .hint2 cells.
    return tile.letters
      .map(
        (L, i) =>
          `<text x="${cellSize / 2}" y="${i === 0 ? 32 : 60}" ${font} font-size="22" fill="${style.text}">${L}</text>`
      )
      .join('');
  }
  if (tile.letters.length === 1) {
    return `<text x="${cellSize / 2}" y="${cellSize / 2 + 14}" ${font} font-size="40" fill="${style.text}">${tile.letters[0]}</text>`;
  }
  return '';
}

function tileSvg(r: number, c: number, tile: Tile, flipSy?: number): string {
  const x = gridStartX + c * (cellSize + cellGap);
  const y = gridStartY + r * (cellSize + cellGap);
  const style = styles[tile.type];
  const inner = `
        <rect width="${cellSize}" height="${cellSize}" rx="12" fill="${style.bg}" stroke="${style.border}" stroke-width="3"/>
        ${tileLetters(tile)}`;
  const flip =
    flipSy === undefined
      ? inner
      : `<g transform="translate(${cellSize / 2},0) scale(1,${flipSy.toFixed(3)}) translate(${-cellSize / 2},0)">${inner}</g>`;
  return `
      <g transform="translate(${x}, ${y})">
        ${flip}
      </g>`;
}

function sceneSvg(grid: string, overlay = ''): string {
  return `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
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
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- Left Side: Header & Meta -->
  <g transform="translate(80, 110)">
    <text x="0" y="30" class="title-kicker">DAILY WORD PUZZLE</text>
    <text x="0" y="105" class="title-main">GRIDDLE</text>

    <text x="0" y="175" class="desc">Untangle six interlocking five-letter words in a 5×5 grid.</text>
    <text x="0" y="210" class="desc">Solve the daily puzzle in 10 guesses or fewer!</text>

    <!-- Badges -->
    <g transform="translate(0, 270)">
      <g transform="translate(0, 0)">
        <rect x="0" y="0" width="130" height="42" rx="21" fill="#1a2332" stroke="#52627a" stroke-width="1.5"/>
        <text x="65" y="26" class="badge-text" text-anchor="middle">🧩 6 Words</text>
      </g>
      <g transform="translate(142, 0)">
        <rect x="0" y="0" width="145" height="42" rx="21" fill="#1a2332" stroke="#52627a" stroke-width="1.5"/>
        <text x="72.5" y="26" class="badge-text" text-anchor="middle">🎯 10 Guesses</text>
      </g>
      <g transform="translate(299, 0)">
        <rect x="0" y="0" width="175" height="42" rx="21" fill="#1a2332" stroke="#52627a" stroke-width="1.5"/>
        <text x="87.5" y="26" class="badge-text" text-anchor="middle">📅 Daily Challenge</text>
      </g>
    </g>
  </g>

  <!-- Right Side: 5x5 Grid -->
  ${grid}
  ${overlay}
</svg>`;
}

function gridSvg(tiles: (Tile | null)[][], flips?: Map<string, { tile: Tile; sy: number }>): string {
  let out = '';
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const tile = tiles[r][c];
      if (!tile) continue;
      const flip = flips?.get(`${r},${c}`);
      out += tileSvg(r, c, flip ? flip.tile : tile, flip ? Math.max(flip.sy, 0.02) : undefined);
    }
  }
  return out;
}

interface Frame {
  svg: string;
  delayMs: number;
}

const HOLD_MS = 800;
const FINAL_HOLD_MS = 1600;
const FLIP_FRAMES = 6;
const FLIP_DELAY_MS = 70;

function sameTile(a: Tile, b: Tile): boolean {
  return a.type === b.type && a.letters.join() === b.letters.join();
}

function buildFrames(): Frame[] {
  const stages = guesses.map((_, i) => tilesFor(i));
  const frames: Frame[] = [];
  const pushBoard = (stage: number, delayMs: number, starScale: number) =>
    frames.push({ svg: sceneSvg(gridSvg(stages[stage]), starsSvg(starScale)), delayMs });

  for (let i = 0; i < stages.length; i++) {
    pushBoard(i, i === stages.length - 1 ? 700 : HOLD_MS, 0);
    if (i === stages.length - 1) break;
    // Tiles that change between this stage and the next, row-major.
    const changed: { r: number; c: number; from: Tile; to: Tile }[] = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const from = stages[i][r][c];
        const to = stages[i + 1][r][c];
        if (from && to && !sameTile(from, to)) changed.push({ r, c, from, to });
      }
    }
    for (let k = 0; k < FLIP_FRAMES; k++) {
      const t = k / (FLIP_FRAMES - 1);
      const flips = new Map<string, { tile: Tile; sy: number }>();
      changed.forEach(({ r, c, from, to }, idx) => {
        // Slight stagger across tiles so the flip ripples.
        const stagger = changed.length > 1 ? (idx / (changed.length - 1)) * 0.35 : 0;
        const local = Math.min(Math.max((t - stagger) / (1 - 0.35), 0), 1);
        const face = local < 0.5 ? from : to;
        const sy = Math.abs(Math.cos(Math.PI * local));
        flips.set(`${r},${c}`, { tile: face, sy });
      });
      frames.push({ svg: sceneSvg(gridSvg(stages[i], flips)), delayMs: FLIP_DELAY_MS });
    }
  }
  // Win: stars pop into the gaps, then hold on the finished board.
  for (const s of [0.3, 1.15, 1]) pushBoard(stages.length - 1, 90, s);
  pushBoard(stages.length - 1, FINAL_HOLD_MS, 1);
  return frames;
}

async function rasterize(svg: string): Promise<Uint8ClampedArray> {
  const { data, info } = await sharp(Buffer.from(svg))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== W || info.height !== H) throw new Error(`unexpected frame size ${info.width}x${info.height}`);
  return new Uint8ClampedArray(data.buffer, data.byteOffset, data.length);
}

async function main() {
  const frames = buildFrames();
  console.log(`rendering ${frames.length} frames...`);
  const gif = GIFEncoder();
  let palette: number[][] | undefined;
  for (let i = 0; i < frames.length; i++) {
    const rgba = await rasterize(frames[i].svg);
    if (i === 0) palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette!);
    gif.writeFrame(index, W, H, {
      palette,
      delay: frames[i].delayMs,
      repeat: i === 0 ? 0 : undefined,
    });
    if ((i + 1) % 10 === 0 || i === frames.length - 1) console.log(`  frame ${i + 1}/${frames.length}`);
  }
  gif.finish();
  const out = path.resolve(__dirname, '../src/public/og-image.gif');
  writeFileSync(out, gif.bytes());
  const kb = Math.round(gif.bytes().length / 1024);
  console.log(`og-image.gif written (${kb} KB), game: ${guesses.join(' -> ')}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
