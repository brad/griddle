// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import {
  chooseDirection,
  readLocalPayload,
  touchUpdatedAt,
  writeLocalPayload,
  type SyncPayload,
} from "./sync";

function payload(updatedAt: number): SyncPayload {
  return {
    stats: {
      played: 3,
      wins: 2,
      currentStreak: 1,
      maxStreak: 2,
      guessDist: [0, 1, 1, 0, 0],
      starDist: [0, 0, 1, 1, 0],
      lastPlayed: 42,
    },
    game: null,
    updatedAt,
  };
}

describe("chooseDirection", () => {
  it("does nothing when both sides are empty", () => {
    expect(chooseDirection(null, null)).toBe("none");
  });

  it("pushes when there is no remote copy", () => {
    expect(chooseDirection(payload(100), null)).toBe("push");
  });

  it("pulls when there is no local copy", () => {
    expect(chooseDirection(null, payload(100))).toBe("pull");
  });

  it("pulls when the remote copy is newer", () => {
    expect(chooseDirection(payload(100), payload(200))).toBe("pull");
  });

  it("pushes when the local copy is newer", () => {
    expect(chooseDirection(payload(200), payload(100))).toBe("push");
  });

  it("does nothing when both copies match", () => {
    expect(chooseDirection(payload(100), payload(100))).toBe("none");
  });
});

describe("local payload storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing is stored", () => {
    expect(readLocalPayload()).toBeNull();
  });

  it("round-trips through writeLocalPayload", () => {
    writeLocalPayload(payload(123));
    const back = readLocalPayload();
    expect(back?.stats?.played).toBe(3);
    expect(back?.updatedAt).toBe(123);
  });

  it("touchUpdatedAt stamps the current time", () => {
    const before = Date.now();
    touchUpdatedAt();
    const stamped = Number(localStorage.getItem("griddle_updated_at"));
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).toBeLessThanOrEqual(Date.now());
  });
});
