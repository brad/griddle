// Guess distribution covers winning guess counts 2..12. Best varies per
// puzzle, so the range stays fixed and stats accumulate across puzzles.
export const DIST_MIN_GUESSES = 2;
export const DIST_BUCKET_COUNT = 11;

// Star distribution: index is stars earned (0..4). Recorded for every
// completed game; busts land at 0 since the formula bottoms out there.
export const STAR_BUCKETS = 5;

export interface StatsShape {
  played: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  guessDist: number[];
  starDist: number[];
  lastPlayed: number;
}

export function defaultStats(): StatsShape {
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

// One-time backfill: wins of 10+ guesses always earn 0 stars (best tops out
// at 6), so the old "10+" guess buckets map exactly onto starDist[0]. Runs
// only while starDist is still empty, so games recorded under the new system
// are never double-counted.
export function backfillZeroStars(stats: StatsShape): void {
  let tenPlus = 0;
  for (let g = 10; g < DIST_MIN_GUESSES + DIST_BUCKET_COUNT; g++) {
    tenPlus += stats.guessDist[g - DIST_MIN_GUESSES];
  }
  if (tenPlus === 0) return;
  for (const c of stats.starDist) {
    if (c !== 0) return; // already tracking stars; don't double-count
  }
  stats.starDist[0] = tenPlus;
}
