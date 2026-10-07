import { Puzzle, State, Summary } from "./types";
import { EPOCH, MAP } from "./data";
export { validatePuzzle, validateAllPuzzles } from "./validation";

export function dayNumber(): number {
  const d = new Date();
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const epoch = new Date(EPOCH.getFullYear(), EPOCH.getMonth(), EPOCH.getDate());
  return Math.floor((today.getTime() - epoch.getTime()) / 86400000) + 1;
}

export function score(g: string, t: string): string[] {
  const out = Array(5).fill("b");
  const used = Array(5).fill(false);
  for (let i = 0; i < 5; i++) {
    if (g[i] === t[i]) {
      out[i] = "g";
      used[i] = true;
    }
  }
  for (let i = 0; i < 5; i++) {
    if (out[i] !== "g") {
      for (let j = 0; j < 5; j++) {
        if (!used[j] && g[i] === t[j]) {
          out[i] = "y";
          used[j] = true;
          break;
        }
      }
    }
  }
  return out;
}

export function stateAt(index: number, guesses: string[], answers: string[]): State {
  const green = Array.from({ length: 5 }, () => Array(5).fill(false));
  const yellow: string[][][] = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => [] as string[])
  );
  if (index < 0) return { green, yellow };
  for (let gi = 0; gi <= index; gi++) {
    // Per-cell yellow candidates with the word that produced each one.
    // A cell can hold up to two candidates (one per crossing word).
    const local: { letter: string; wi: number }[][][] = Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => [] as { letter: string; wi: number }[])
    );
    answers.forEach((word, wi) =>
      score(guesses[gi], word).forEach((mark, i) => {
        const [r, c] = MAP[wi][i];
        if (mark === "g") green[r][c] = true;
        else if (mark === "y" && !green[r][c]) local[r][c].push({ letter: guesses[gi][i], wi });
      })
    );
    if (gi === index) {
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (green[r][c]) continue;
          const seen = new Set<string>();
          for (const { letter, wi } of local[r][c]) {
            if (seen.has(letter)) continue;
            // Only suppress the hint when every occurrence of the letter in
            // the word that produced it is already revealed. A single green
            // elsewhere must not hide a genuine duplicate (e.g. "llama").
            const total = [...answers[wi]].filter(ch => ch === letter).length;
            const found = MAP[wi].filter(
              ([rr, cc], pos) => green[rr][cc] && answers[wi][pos] === letter
            ).length;
            if (found < total) {
              yellow[r][c].push(letter);
              seen.add(letter);
            }
          }
        }
      }
    }
  }
  return { green, yellow };
}

export function gridLetters(puzzle: Puzzle): string[][] {
  const g = Array.from({ length: 5 }, () => Array(5).fill(""));
  for (let i = 0; i < 5; i++) {
    g[0][i] = puzzle.h[0][i];
    g[2][i] = puzzle.h[1][i];
    g[4][i] = puzzle.h[2][i];
    g[i][0] = puzzle.v[0][i];
    g[i][2] = puzzle.v[1][i];
    g[i][4] = puzzle.v[2][i];
  }
  return g;
}

export function keyState(guesses: string[], answers: string[]): Record<string, string> {
  const s: Record<string, string> = {};
  for (const c of "abcdefghijklmnopqrstuvwxyz") s[c] = "";
  guesses.forEach(g =>
    answers.forEach(w =>
      score(g, w).forEach((m, i) => {
        const c = g[i];
        if (m === "g") s[c] = "green";
        else if (m === "y" && s[c] !== "green") s[c] = "yellow";
        else if (m === "b" && !s[c]) s[c] = "gray";
      })
    )
  );
  return s;
}

export function complete(s: State): boolean {
  return s.green.flat().filter(Boolean).length === 21;
}

export function summary(g: string, answers: string[]): Summary {
  let green = 0, yellow = 0;
  answers.forEach(w =>
    score(g, w).forEach(x => {
      if (x === "g") green++;
      if (x === "y") yellow++;
    })
  );
  return { green, yellow };
}

/**
 * Best possible score for a puzzle: the theoretical minimum guess count.
 * Uses the stored verified value when present (see scripts/compute-best.cjs);
 * otherwise falls back to the 64-orientation computation below, which is
 * proven equivalent to the exact real-word minimum on all rotation puzzles.
 *
 * Six shared cells sit at different positions in their horizontal vs vertical
 * words and may be completed through either orientation: 2^6 = 64 choices.
 * For each choice, count distinct letters demanded at each guess position;
 * best = min over choices of the max over positions.
 */
export function best(puzzle: Puzzle): number {
  if (puzzle.best !== undefined) return puzzle.best;
  return computeBest(puzzle);
}

function computeBest(puzzle: Puzzle): number {
  const words = [...puzzle.h, ...puzzle.v];
  const cells = new Map<string, { pos: number; letter: string }[]>();
  for (let wi = 0; wi < 6; wi++) {
    for (let i = 0; i < 5; i++) {
      const [r, c] = MAP[wi][i];
      const key = r + "," + c;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key)!.push({ pos: i, letter: words[wi][i] });
    }
  }
  const flex: { pos: number; letter: string }[][] = [];
  const fixed: { pos: number; letter: string }[] = [];
  for (const arr of cells.values()) {
    if (new Set(arr.map((x) => x.pos)).size > 1) flex.push(arr);
    else fixed.push(arr[0]);
  }
  let best = Infinity;
  for (let mask = 0; mask < 1 << flex.length; mask++) {
    const perPos = [new Set<string>(), new Set<string>(), new Set<string>(), new Set<string>(), new Set<string>()];
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
