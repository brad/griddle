import { describe, it, expect } from "vitest";
import { validatePuzzle, validateAllPuzzles } from "./validation";
import { PUZZLES, VALID, VALID_ANSWERS, EXCLUDED_ANSWERS } from "./data";
import { Puzzle } from "./types";

describe("puzzle validation", () => {
  it("validates all puzzles in PUZZLES array successfully", () => {
    expect(() => validateAllPuzzles(PUZZLES, VALID)).not.toThrow();
    PUZZLES.forEach(puzzle => {
      expect(validatePuzzle(puzzle, VALID)).toEqual([]);
    });
  });

  it("uses only curated answer words for puzzle answers", () => {
    // Answer-list policy: answers must be familiar (2,315 answers),
    // not merely guessable (12,972). Locks in the 2026-10-02 migration.
    PUZZLES.forEach(puzzle => {
      [...puzzle.h, ...puzzle.v].forEach(word => {
        expect(VALID_ANSWERS.has(word)).toBe(true);
      });
    });
  });

  it("excludes words removed from the upstream answer list", () => {
    // Mirrors the upstream policy (see EXCLUDED_ANSWERS in data.ts).
    PUZZLES.forEach(puzzle => {
      [...puzzle.h, ...puzzle.v].forEach(word => {
        expect(EXCLUDED_ANSWERS.has(word)).toBe(false);
      });
    });
  });

  it("detects grid intersection mismatches", () => {
    const invalidPuzzle: Puzzle = {
      h: ["share", "audio", "steel"],
      v: ["stars", "adult", "ember"],
      best: 6,
    };
    const errors = validatePuzzle(invalidPuzzle, VALID);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.includes("Mismatch at grid intersection"))).toBe(true);
  });

  it("detects words of invalid length", () => {
    const invalidPuzzle: Puzzle = {
      h: ["snake", "least", "every"],
      v: ["solve", "awar", "entry"],
      best: 6,
    };
    const errors = validatePuzzle(invalidPuzzle, VALID);
    expect(errors.some(e => e.includes("must be exactly 5 letters long"))).toBe(true);
  });

  it("detects words not in the valid dictionary", () => {
    const invalidPuzzle: Puzzle = {
      h: ["snake", "least", "every"],
      v: ["solve", "zzzzz", "entry"],
      best: 6,
    };
    const errors = validatePuzzle(invalidPuzzle, VALID);
    expect(errors.some(e => e.includes("is not in the valid dictionary"))).toBe(true);
  });

  it("detects duplicate words in a puzzle", () => {
    const invalidPuzzle: Puzzle = {
      h: ["snake", "least", "every"],
      v: ["snake", "aware", "entry"],
      best: 6,
    };
    const errors = validatePuzzle(invalidPuzzle, VALID);
    expect(errors).toContain("Puzzle contains duplicate words.");
  });

  it("detects invalid word counts", () => {
    const invalidPuzzle = {
      h: ["snake", "least"],
      v: ["solve", "aware", "entry"],
    } as Puzzle;
    const errors = validatePuzzle(invalidPuzzle, VALID);
    expect(errors).toContain("Horizontal word list must contain exactly 3 words.");
  });

  it("throws an error when validateAllPuzzles encounters an invalid puzzle", () => {
    const invalidPuzzles: Puzzle[] = [
      PUZZLES[0],
      {
        h: ["share", "audio", "steel"],
        v: ["stars", "adult", "ember"],
        best: 6,
      },
    ];
    expect(() => validateAllPuzzles(invalidPuzzles, VALID)).toThrow(/Puzzle 2 validation failed/);
  });
});
