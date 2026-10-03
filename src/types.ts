export interface Puzzle {
  h: string[];
  v: string[];
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
