// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { header, share } from './share';
import { PUZZLES } from './data';

describe('share formatting', () => {
  it('formats header correctly', () => {
    // Guesses made. A perfect game is the minimum 6 guesses.
    expect(header(1, true, 6)).toBe('Griddle 1 6/10');
    expect(header(1, true, 10)).toBe('Griddle 1 10/10');
    expect(header(2, false, 10)).toBe('Griddle 2 X/10');
  });

  it('generates share text with grid emojis and stars', () => {
    const puzzle = PUZZLES[0];
    const answers = [...puzzle.h, ...puzzle.v];
    // Use wrong guesses first to get gray squares, then some correct
    // 10 guesses total = 0 stars, so gaps show ⬜
    const guesses = ['abuse', 'abyss', 'ached', 'acids', 'acorn', 'acres', 'award', 'avail', 'kites', 'aback'];
    const result = share(1, false, guesses, answers, puzzle);
    expect(result).toContain('Griddle 1 X/10');
    expect(result).toContain('🟩');
    expect(result).toContain('⬛'); // gray squares
    // With 0 stars remaining (10 guesses), gaps should show ⬜
    expect(result).toContain('⬜');
    // Squares are space-separated for readability
    expect(result).toContain('🟩 🟩');
  });

  it('shows up to 4 stars for remaining guesses', () => {
    const puzzle = PUZZLES[0];
    const guesses = ['award', 'avail', 'kites', 'aback', 'abaft'];
    const answers = [...puzzle.h, ...puzzle.v];
    const result = share(1, true, guesses, answers, puzzle);
    const starCount = (result.match(/⭐/g) || []).length;
    expect(starCount).toBeLessThanOrEqual(4);
  });
});