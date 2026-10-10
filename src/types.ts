export interface Puzzle {
  h: string[];
  v: string[];
  // Verified real-word minimum guess count (see scripts/compute-best.cjs).
  best: number;
}

export interface Stats {
  played: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  guessDist: number[];
  starDist: number[];
  lastPlayed: number;
}

export interface GameState {
  puzzleNumber: number;
  guesses: string[];
  selected: number;
  input: string;
  over: boolean;
  won: boolean;
}

export interface State {
  green: boolean[][];
  yellow: string[][][];
}

export interface Summary {
  green: number;
  yellow: number;
}

export type ShareStyle = "waffle";
