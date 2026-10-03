import { Puzzle } from './types';
import { gridLetters } from './game';
import { stateAt } from './game';

const GAP_POSITIONS = [[1,1], [1,3], [3,1], [3,3]] as const;

export function header(puzzleNumber: number, won: boolean, guessCount: number): string {
  // Guesses made, not remaining (a perfect game is 6/10).
  return "Griddle " + puzzleNumber + " " + (won ? guessCount : "X") + "/10";
}

// Gap cells that earn a star, in fill order. Mirrors the share-text grid:
// one star per remaining guess, up to 4. Exported so the finished board
// can show the same stars the share text does.
export function starPositions(guessCount: number): [number, number][] {
  const remaining = Math.max(0, 10 - guessCount);
  const starCount = Math.min(4, remaining);
  return GAP_POSITIONS.slice(0, starCount).map(([r, c]) => [r, c] as [number, number]);
}

function gridStateEmoji(puzzle: Puzzle, guesses: string[], answers: string[]): string[] {
  const letters = gridLetters(puzzle);
  const finalState = stateAt(guesses.length - 1, guesses, answers);
  const stars = new Set(starPositions(guesses.length).map(([r, c]) => r * 5 + c));
  const rows: string[] = [];
  for (let r = 0; r < 5; r++) {
    const cells: string[] = [];
    for (let c = 0; c < 5; c++) {
      if (!letters[r][c]) {
        cells.push(stars.has(r * 5 + c) ? "⭐" : "⬜");
      } else if (finalState.green[r][c]) {
        cells.push("🟩");
      } else if (finalState.yellow[r][c].length) {
        cells.push("🟨");
      } else {
        cells.push("⬛");
      }
    }
    rows.push(cells.join(" "));
  }
  return rows;
}

export function share(puzzleNumber: number, won: boolean, guesses: string[], answers: string[], puzzle: Puzzle): string {
  const hdr = header(puzzleNumber, won, guesses.length);
  const grid = gridStateEmoji(puzzle, guesses, answers).join("\n");
  return hdr + "\n" + grid;
}