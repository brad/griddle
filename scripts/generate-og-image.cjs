const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const GAP_POSITIONS = new Set(['1,1', '1,3', '3,1', '3,3']);

// Grid definition: 5x5
// type: 'green' | 'yellow' | 'dark' | 'gap'
const grid = [
  [
    { type: 'green', letter: 'G' },
    { type: 'green', letter: 'R' },
    { type: 'green', letter: 'I' },
    { type: 'green', letter: 'L' },
    { type: 'green', letter: 'L' },
  ],
  [
    { type: 'dark' },
    { type: 'gap' },
    { type: 'yellow', letter: 'R' },
    { type: 'gap' },
    { type: 'green', letter: 'L' },
  ],
  [
    { type: 'dark' },
    { type: 'dark' },
    { type: 'yellow', letter: 'O' },
    { type: 'dark' },
    { type: 'dark' },
  ],
  [
    { type: 'dark' },
    { type: 'gap' },
    { type: 'green', letter: 'U' },
    { type: 'gap' },
    { type: 'dark' },
  ],
  [
    { type: 'green', letter: 'E' },
    { type: 'green', letter: 'N' },
    { type: 'green', letter: 'D' },
    { type: 'green', letter: 'E' },
    { type: 'green', letter: 'D' },
  ],
];

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
    const key = `${r},${c}`;
    if (GAP_POSITIONS.has(key)) {
      continue; // Strictly skip gaps
    }
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
    console.log('Successfully generated og-image.png at', outputPath);
  })
  .catch((err) => {
    console.error('Error generating og-image.png:', err);
    process.exit(1);
  });
