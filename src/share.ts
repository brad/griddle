import { Puzzle } from './types';
import { gridLetters } from './game';
import { stateAt } from './game';

const GAP_POSITIONS = [[1,1], [1,3], [3,1], [3,3]] as const;

export function header(puzzleNumber: number, won: boolean, guessCount: number): string {
  // Guesses made, not remaining (a perfect game is 6/10).
  return "Griddle " + puzzleNumber + " " + (won ? guessCount : "X") + "/10";
}

function isGap(r: number, c: number): boolean {
  return GAP_POSITIONS.some(([gr, gc]) => gr === r && gc === c);
}

function gridStateEmoji(puzzle: Puzzle, guesses: string[], answers: string[]): string[] {
  const letters = gridLetters(puzzle);
  const finalState = stateAt(guesses.length - 1, guesses, answers);
  const remaining = Math.max(0, 10 - guesses.length);
  const starCount = Math.min(4, remaining);
  const rows: string[] = [];
  let starIndex = 0;
  for (let r = 0; r < 5; r++) {
    const cells: string[] = [];
    for (let c = 0; c < 5; c++) {
      if (!letters[r][c]) {
        if (isGap(r, c) && starIndex < starCount) {
          cells.push("⭐");
          starIndex++;
        } else {
          cells.push("⬜");
        }
      } else if (finalState.green[r][c]) {
        cells.push("🟩");
      } else if (finalState.yellow[r][c]) {
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