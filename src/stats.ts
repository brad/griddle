import type { Stats } from "./types";

// Guess distribution covers winning guess counts 2..12. Best varies per
// puzzle, so the range stays fixed and stats accumulate across puzzles.
export const DIST_MIN_GUESSES = 2;
export const DIST_BUCKET_COUNT = 11;

// Star distribution: index is stars earned (0..4). Recorded for every
// completed game; busts land at 0 since the formula bottoms out there.
export const STAR_BUCKETS = 5;

export function defaultStats(): Stats {
  return {
    played: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    guessDist: new Array(DIST_BUCKET_COUNT).fill(0),
    starDist: new Array(STAR_BUCKETS).fill(0),
    lastPlayed: 0,
  };
}

export function normalizeGuessDist(dist: unknown): number[] {
  const fresh = new Array(DIST_BUCKET_COUNT).fill(0);
  if (!Array.isArray(dist)) return fresh;
  if (dist.length === DIST_BUCKET_COUNT) {
    return dist.map((n) => (typeof n === "number" ? n : 0));
  }
  // Legacy shape: 5 buckets covering guess counts 6..10.
  if (dist.length === 5) {
    dist.forEach((n, i) => {
      if (typeof n === "number") fresh[i + 4] += n;
    });
  }
  return fresh;
}

export function normalizeStarDist(dist: unknown): number[] {
  const fresh = new Array(STAR_BUCKETS).fill(0);
  if (Array.isArray(dist) && dist.length === STAR_BUCKETS) {
    return dist.map((n) => (typeof n === "number" ? n : 0));
  }
  return fresh;
}
