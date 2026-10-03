import { describe, it, expect } from "vitest";
import { stateAt } from "./game";

// Regression tests for the yellow-highlight "consumed" logic in stateAt().
// A yellow hint for letter L in a word must only be suppressed when EVERY
// occurrence of L in that word is already revealed (green). Suppressing it
// merely because L is green *somewhere* hides genuine duplicate letters.

describe("yellow highlight false negatives", () => {
  it("shows yellow for a duplicate letter found misplaced in the same guess", () => {
    // "llama" has two L's. Guessing "level" greens L at pos 0 and correctly
    // spots the second L misplaced at pos 4 -> yellow 'l' at (0,4).
    const answers = ["llama", "bcdef", "ghijk", "lmnop", "qrstu", "vwxyz"];
    const s = stateAt(0, ["level"], answers);
    expect(s.green[0][0]).toBe(true);
    expect(s.yellow[0][4]).toEqual(["l"]);
  });

  it("shows yellow for a duplicate letter across guesses", () => {
    // "eerie" has three E's. "eaten" greens E at pos 0, "beefy" greens E at
    // pos 1 and spots a third E misplaced at pos 2 -> yellow 'e' at (0,2).
    const answers = ["eerie", "bcdef", "ghijk", "lmnop", "qrstu", "vwxyz"];
    const s = stateAt(1, ["eaten", "beefy"], answers);
    expect(s.green[0][0]).toBe(true);
    expect(s.green[0][1]).toBe(true);
    expect(s.yellow[0][2]).toEqual(["e"]);
  });

  it("still suppresses yellow when the only occurrence is already found", () => {
    // "spine" has a single E, found at pos 4 by "erase". A later "elves"
    // scores E yellow at pos 0, but the hint is stale -> no yellow at (0,0).
    // The legitimate S yellow at (0,4) must still show.
    const answers = ["spine", "bcdef", "ghijk", "lmnop", "qrstu", "vwxyz"];
    const s = stateAt(1, ["erase", "elves"], answers);
    expect(s.green[0][4]).toBe(true);
    expect(s.yellow[0][0]).toEqual([]);
    // (0,4) is already green, so no yellow there either — the cell is solved.
    expect(s.yellow[0][4]).toEqual([]);
  });

  it("shows both letters when two crossing words hint at the same square", () => {
    // (0,2) is h0[2] = v1[0] = 'c'. Guessing "yqaqq" yellows 'a' in h0
    // ("abcde") and 'y' in v1 ("cxyzw") — row hint on top, column below.
    const answers = ["abcde", "zzzzz", "zzzzz", "zzzzz", "cxyzw", "zzzzz"];
    const s = stateAt(0, ["yqaqq"], answers);
    expect(s.yellow[0][2]).toEqual(["a", "y"]);
  });

  it("dedupes the same letter hinted by both crossing words", () => {
    // (0,0) is h0[0] = v0[0] = 'e'. Guessing "aqqqq" yellows 'a' in h0
    // ("eaxxx") and in v0 ("eayyy") — the same letter must appear only once.
    const answers = ["eaxxx", "zzzzz", "zzzzz", "eayyy", "zzzzz", "zzzzz"];
    const s = stateAt(0, ["aqqqq"], answers);
    expect(s.yellow[0][0]).toEqual(["a"]);
  });
});
