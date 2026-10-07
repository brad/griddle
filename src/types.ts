export interface Puzzle {
  h: string[];
  v: string[];
  // Verified real-word minimum guess count (see scripts/compute-best.cjs).
  // Present on all rotation puzzles; computed on the fly when absent.
  best?: number;
}

export interface State {
  green: boolean[][];
  yellow: string[][][];
}

export interface Summary {
  green: number;
  yellow: number;
}

export type ShareStyle = 'waffle';
