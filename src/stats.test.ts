// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import {
  DIST_BUCKET_COUNT,
  DIST_MIN_GUESSES,
  STAR_BUCKETS,
  defaultStats,
  normalizeGuessDist,
  normalizeStarDist,
} from "./stats";

describe("guess distribution", () => {
  it("covers guess counts 2..12", () => {
    expect(DIST_MIN_GUESSES).toBe(2);
    expect(DIST_BUCKET_COUNT).toBe(11);
    expect(defaultStats().guessDist).toHaveLength(11);
  });

  it("keeps a current-shape distribution, sanitizing entries", () => {
    const dist = normalizeGuessDist([0, 1, "x", 3, 0, 0, 0, 0, 0, 0, 0]);
    expect(dist).toEqual([0, 1, 0, 3, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("migrates the legacy 5-bucket shape (guess counts 6..10)", () => {
    // Old bucket i counted wins in (i + 6) guesses; new bucket j counts (j + 2).
    const dist = normalizeGuessDist([1, 2, 3, 4, 5]);
    expect(dist).toEqual([0, 0, 0, 0, 1, 2, 3, 4, 5, 0, 0]);
  });

  it("returns a fresh distribution for garbage input", () => {
    expect(normalizeGuessDist(null)).toEqual(new Array(11).fill(0));
    expect(normalizeGuessDist([1, 2, 3])).toEqual(new Array(11).fill(0));
    expect(normalizeGuessDist("nope")).toEqual(new Array(11).fill(0));
  });
});

describe("star distribution", () => {
  it("has one bucket per star level (0..4)", () => {
    expect(STAR_BUCKETS).toBe(5);
    expect(defaultStats().starDist).toEqual([0, 0, 0, 0, 0]);
  });

  it("keeps a current-shape distribution, sanitizing entries", () => {
    expect(normalizeStarDist([1, 2, "x", 0, 3])).toEqual([1, 2, 0, 0, 3]);
  });

  it("starts fresh when missing or misshapen", () => {
    expect(normalizeStarDist(undefined)).toEqual([0, 0, 0, 0, 0]);
    expect(normalizeStarDist([1, 2])).toEqual([0, 0, 0, 0, 0]);
  });
});
