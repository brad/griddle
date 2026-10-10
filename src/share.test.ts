// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { header, share, starCount, starPositions } from './share';
import { best } from './game';
import { MAX_GUESSES } from './data';
import { PUZZLES } from './data';

describe('share formatting', () => {
  it('formats header correctly', () => {
    // Guesses made, with best. A perfect game matches best.
    expect(header(1, true, 6, 6)).toBe(`Griddle 1 6/${MAX_GUESSES} · best 6`);
    expect(header(1, true, 10, 6)).toBe(`Griddle 1 10/${MAX_GUESSES} · best 6`);
    expect(header(2, false, 12, 4)).toBe(`Griddle 2 X/${MAX_GUESSES} · best 4`);
  });

  it('generates share text with grid emojis and stars', () => {
    const puzzle = PUZZLES[0];
    const answers = [...puzzle.h, ...puzzle.v];
    // 12 guesses on a best-6 = 0 stars, so gaps show ⬜
    const guesses = ['abuse', 'abyss', 'ached', 'acids', 'acorn', 'acres', 'award', 'avail', 'kites', 'aback', 'abaft', 'abandon'];
    const result = share(1, false, guesses, answers, puzzle);
    expect(result).toContain(`Griddle 1 X/${MAX_GUESSES} · best 6`);
    expect(result).toContain('🟩');
    expect(result).toContain('⬛'); // gray squares
    // With 0 stars (12 guesses, 6 over best), gaps should show ⬜
    expect(result).toContain('⬜');
    // Squares are space-separated for readability
    expect(result).toContain('🟩 🟩');
  });

  it('shows up to 4 stars, best-relative', () => {
    const puzzle = PUZZLES[0];
    const guesses = ['award', 'avail', 'kites', 'aback', 'abaft'];
    const answers = [...puzzle.h, ...puzzle.v];
    const result = share(1, true, guesses, answers, puzzle);
    const starCount = (result.match(/⭐/g) || []).length;
    expect(starCount).toBeLessThanOrEqual(4);
  });

  it('share text puts 4 stars in the gaps after a best win', () => {
    const puzzle = PUZZLES[0]; // best 6
    const answers = [...puzzle.h, ...puzzle.v];
    const guesses = ['aaaaa', 'bbbbb', 'ccccc', 'ddddd', 'eeeee', 'fffff'];
    const result = share(1, true, guesses, answers, puzzle);
    expect((result.match(/⭐/g) || []).length).toBe(4);
  });

  it('starPositions is best-relative, capped at 4, floored at 0', () => {
    // At best or better: 4 stars
    expect(starPositions(6, 6)).toEqual([[1, 1], [1, 3], [3, 1], [3, 3]]);
    expect(starPositions(4, 4)).toEqual([[1, 1], [1, 3], [3, 1], [3, 3]]);
    expect(starPositions(1, 6)).toEqual([[1, 1], [1, 3], [3, 1], [3, 3]]);
    // Over best: one fewer star per guess
    expect(starPositions(7, 6)).toEqual([[1, 1], [1, 3], [3, 1]]);
    expect(starPositions(9, 6)).toEqual([[1, 1]]);
    expect(starPositions(6, 4)).toEqual([[1, 1], [1, 3]]);
    // 4+ over best: no stars
    expect(starPositions(10, 6)).toEqual([]);
    expect(starPositions(12, 6)).toEqual([]);
    expect(starPositions(8, 4)).toEqual([]);
  });

  it('starCount is best-relative, capped at 4, floored at 0', () => {
    expect(starCount(6, 6)).toBe(4);
    expect(starCount(4, 6)).toBe(4);
    expect(starCount(7, 6)).toBe(3);
    expect(starCount(9, 6)).toBe(1);
    expect(starCount(10, 6)).toBe(0);
    expect(starCount(12, 6)).toBe(0);
    expect(starCount(3, 3)).toBe(4);
  });

  it('best() matches the generator k_min on rotation puzzles', () => {
    // PUZZLES[0] computed as k_min=6 by scripts/generate-h0-diverse.cjs
    expect(best(PUZZLES[0])).toBe(6);
  });
});
