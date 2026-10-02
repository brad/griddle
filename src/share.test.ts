// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { header, share, starPositions } from './share';
import { PUZZLES } from './data';

describe('share formatting', () => {
  it('formats header correctly', () => {
    expect(header(1, true, 4)).toBe('Weavle 1 4/10');
    expect(header(1, true, 10)).toBe('Weavle 1 10/10');
    expect(header(2, false, 10)).toBe('Weavle 2 X/10');
  });

  it('generates share text with grid emojis and stars', () => {
    const puzzle = PUZZLES[0];
    const answers = [...puzzle.h, ...puzzle.v];
    // Use wrong guesses first to get gray squares, then some correct
    // 10 guesses total = 0 stars, so gaps show ⬜
    const guesses = ['abuse', 'abyss', 'ached', 'acids', 'acorn', 'acres', 'award', 'avail', 'kites', 'aback'];
    const result = share(1, false, guesses, answers, puzzle);
    expect(result).toContain('Weavle 1 X/10');
    expect(result).toContain('🟩');
    expect(result).toContain('⬛'); // gray squares
    // With 0 stars remaining (10 guesses), gaps should show ⬜
    expect(result).toContain('⬜');
  });

  it('shows up to 4 stars for remaining guesses', () => {
    const puzzle = PUZZLES[0];
    const guesses = ['award', 'avail', 'kites', 'aback', 'abaft'];
    const answers = [...puzzle.h, ...puzzle.v];
    const result = share(1, true, guesses, answers, puzzle);
    const starCount = (result.match(/⭐/g) || []).length;
    expect(starCount).toBeLessThanOrEqual(4);
  });

  it('share text puts 4 stars in the gaps after a 6-guess win', () => {
    const puzzle = PUZZLES[0];
    const answers = [...puzzle.h, ...puzzle.v];
    const guesses = ['aaaaa', 'bbbbb', 'ccccc', 'ddddd', 'eeeee', 'fffff'];
    const result = share(1, true, guesses, answers, puzzle);
    expect((result.match(/⭐/g) || []).length).toBe(4);
  });

  it('starPositions fills gaps in order, capped at 4', () => {
    expect(starPositions(6)).toEqual([[1, 1], [1, 3], [3, 1], [3, 3]]);
    expect(starPositions(9)).toEqual([[1, 1]]);
    expect(starPositions(10)).toEqual([]);
    expect(starPositions(1)).toEqual([[1, 1], [1, 3], [3, 1], [3, 3]]);
  });
});