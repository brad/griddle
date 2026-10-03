import { PUZZLES } from "./puzzles";
import { WORDS, ANSWERS } from "./words";

export { PUZZLES };

export const VALID: Set<string> = new Set(WORDS);

// Answer-list policy: daily puzzle answers must come from the 2,315-word
// curated answer list (guessable words in VALID may be obscure; answers must be familiar).
export const VALID_ANSWERS: Set<string> = new Set(ANSWERS);

// Six words removed from the upstream answer list after its acquisition
// (obscure: agora, pupal, fibre; insensitive: lynch, slave, wench).
// They remain valid guesses. Keep in sync with scripts/generate-h0-diverse.cjs.
export const EXCLUDED_ANSWERS: Set<string> = new Set(
  ["agora", "pupal", "lynch", "fibre", "slave", "wench"]
);

export const MAP: number[][][] = [
  [[0,0],[0,1],[0,2],[0,3],[0,4]],
  [[2,0],[2,1],[2,2],[2,3],[2,4]],
  [[4,0],[4,1],[4,2],[4,3],[4,4]],
  [[0,0],[1,0],[2,0],[3,0],[4,0]],
  [[0,2],[1,2],[2,2],[3,2],[4,2]],
  [[0,4],[1,4],[2,4],[3,4],[4,4]]
];

export const KEY_ROWS: string[][] = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["↵","Z","X","C","V","B","N","M","⌫"]
];

export const EPOCH: Date = new Date(2026, 8, 17);

