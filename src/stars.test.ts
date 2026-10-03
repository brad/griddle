// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { dayNumber } from "./game";

describe("earned stars on the finished board", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    document.body.innerHTML = `
      <header>
        <span id="puzzleNumber"></span>
        <span id="guessCount">0</span>
      </header>
      <div class="board-wrapper" id="boardWrapper">
        <div class="board-track" id="boardTrack">
          <div class="board" id="board1"></div>
          <div class="board" id="board2"></div>
        </div>
      </div>
      <p id="timelineLabel"></p>
      <div id="guessTabs"></div>
      <div id="typed"></div>
      <div id="msg"></div>
      <div id="keyboard"></div>
      <div class="overlay" id="help">
        <button id="closeHelp">Play</button>
      </div>
      <div class="overlay" id="results">
        <h2 id="resultTitle"></h2>
        <p id="resultMessage"></p>
        <p id="shareText"></p>
        <button id="closeResults">Close</button>
      </div>
      <div class="overlay" id="stats">
        <div id="statsContent"></div>
        <button id="closeStats">Close</button>
      </div>
    `;
    // Seed a finished game: 7 guesses, won, viewing the final guess.
    localStorage.setItem(
      "griddle_game",
      JSON.stringify({
        puzzleNumber: dayNumber(),
        guesses: ["grill", "amber", "alarm", "elect", "grade", "image", "limit"],
        selected: 6,
        input: "",
        over: true,
        won: true,
      })
    );
  });

  it("shows earned stars when viewing the final guess", async () => {
    await import("./main");
    // 7 guesses -> 3 unused -> 3 stars.
    expect(document.querySelectorAll("#board1 .cell.star").length).toBe(3);
  });

  it("hides stars when flipping back to an earlier guess, restores on the last", async () => {
    vi.useFakeTimers();
    try {
      await import("./main");
      const tabs = document.querySelectorAll<HTMLButtonElement>("#guessTabs button");
      expect(tabs.length).toBe(7);

      tabs[2].click(); // flip back to guess 3
      await vi.advanceTimersByTimeAsync(300); // let the slide finish
      expect(document.querySelectorAll("#board1 .cell.star").length).toBe(0);

      tabs[6].click(); // forward to the final guess
      await vi.advanceTimersByTimeAsync(300);
      expect(document.querySelectorAll("#board1 .cell.star").length).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
