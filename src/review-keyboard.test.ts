// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { dayNumber } from "./game";

describe("keyboard follows the viewed guess", () => {
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
      <div class="guesses">
        <div class="guess-entry">
          <div class="typed" id="typed"></div>
          <button class="submit-guess" id="submit">Guess</button>
        </div>
        <div class="msg" id="msg"></div>
      </div>
      <div class="keyboard" id="keyboard"></div>
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
    // Mid-game: 3 guesses in, viewing the latest.
    localStorage.setItem(
      "griddle_game",
      JSON.stringify({
        puzzleNumber: dayNumber(),
        guesses: ["abcde", "fghij", "klmno"],
        selected: 2,
        input: "",
        over: false,
        won: false,
      })
    );
  });

  function keyMap(): Map<string, HTMLButtonElement> {
    const m = new Map<string, HTMLButtonElement>();
    document.querySelectorAll<HTMLButtonElement>("#keyboard .key").forEach((k) => {
      m.set(k.textContent || "", k);
    });
    return m;
  }

  it("enables the keyboard on the latest guess", async () => {
    await import("./main");
    const keys = keyMap();
    expect(keys.size).toBeGreaterThan(0);
    for (const k of keys.values()) expect(k.disabled).toBe(false);
    expect((document.getElementById("submit") as HTMLButtonElement).disabled).toBe(false);
  });

  it("dims the keyboard and shows earlier colors when reviewing an old guess", async () => {
    vi.useFakeTimers();
    try {
      await import("./main");
      const latestHtml = document.getElementById("keyboard")?.innerHTML;
      // 'f' is only in guess 2: untouched on tab 1, marked on the latest tab.
      expect(keyMap().get("F")?.className).not.toBe("key");

      const tabs = document.querySelectorAll<HTMLButtonElement>("#guessTabs button");
      tabs[0].click(); // back to guess 1
      await vi.advanceTimersByTimeAsync(300);

      const keys = keyMap();
      for (const k of keys.values()) expect(k.disabled).toBe(true);
      expect((document.getElementById("submit") as HTMLButtonElement).disabled).toBe(true);
      expect(keys.get("F")?.className).toBe("key");
      expect(document.getElementById("keyboard")?.innerHTML).not.toBe(latestHtml);

      tabs[2].click(); // forward to latest: everything back
      await vi.advanceTimersByTimeAsync(300);
      for (const k of keyMap().values()) expect(k.disabled).toBe(false);
      expect((document.getElementById("submit") as HTMLButtonElement).disabled).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
