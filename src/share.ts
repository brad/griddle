import { Puzzle } from './types';
import { gridLetters } from './game';
import { stateAt } from './game';
import { best } from './game';
import { MAX_GUESSES } from './data';

const GAP_POSITIONS = [[1,1], [1,3], [3,1], [3,3]] as const;

export function header(puzzleNumber: number, won: boolean, guessCount: number, bestScore: number): string {
  // Guesses made, not remaining. Best is the lowest anyone can score.
  return "Griddle " + puzzleNumber + " " + (won ? guessCount : "X") + "/" + MAX_GUESSES + " · best " + bestScore;
}

// Gap cells that earn a star, in fill order. Mirrors the share-text grid:
// stars are best-relative: 4 at best or better, one fewer per guess over
// best, floored at 0. Exported so the finished board can show the same stars
// the share text does.
export function starCount(guessCount: number, bestScore: number): number {
  return Math.min(4, Math.max(0, 4 - (guessCount - bestScore)));
}

export function starPositions(guessCount: number, bestScore: number): [number, number][] {
  return GAP_POSITIONS.slice(0, starCount(guessCount, bestScore)).map(([r, c]) => [r, c] as [number, number]);
}

function gridStateEmoji(puzzle: Puzzle, guesses: string[], answers: string[], bestScore: number): string[] {
  const letters = gridLetters(puzzle);
  const finalState = stateAt(guesses.length - 1, guesses, answers);
  const stars = new Set(starPositions(guesses.length, bestScore).map(([r, c]) => r * 5 + c));
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
  const b = best(puzzle);
  const hdr = header(puzzleNumber, won, guesses.length, b);
  const grid = gridStateEmoji(puzzle, guesses, answers, b).join("\n");
  return hdr + "\n" + grid;
}