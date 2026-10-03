// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";

describe("game state & help modal persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <header>
        <span id="puzzleNumber"></span>
        <span id="guessCount">0</span>
      </header>
      <div class="board" id="board"></div>
      <div id="timelineLabel"></div>
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
  });

  it("should not show help modal if griddle_help_dismissed is true in localStorage", async () => {
    localStorage.setItem("griddle_help_dismissed", "true");
    await import("./main");

    const help = document.getElementById("help");
    expect(help?.classList.contains("show")).toBe(false);
  });

  it("migrates legacy weavle_* keys to griddle_* once", async () => {
    localStorage.setItem("weavle_game", JSON.stringify({ puzzleNumber: 1 }));
    localStorage.setItem("weavle_stats", JSON.stringify({ played: 5 }));
    localStorage.setItem("weavle_help_dismissed", "true");

    const { migrateStorageKeys } = await import("./main");
    migrateStorageKeys();

    expect(localStorage.getItem("griddle_game")).toContain("\"puzzleNumber\":1");
    expect(localStorage.getItem("griddle_stats")).toContain("\"played\":5");
    expect(localStorage.getItem("griddle_help_dismissed")).toBe("true");
    expect(localStorage.getItem("weavle_game")).toBeNull();
    expect(localStorage.getItem("weavle_stats")).toBeNull();
    expect(localStorage.getItem("weavle_help_dismissed")).toBeNull();

    // Second run is a no-op and never overwrites newer data.
    localStorage.setItem("griddle_stats", JSON.stringify({ played: 9 }));
    localStorage.setItem("weavle_stats", JSON.stringify({ played: 1 }));
    migrateStorageKeys();
    expect(localStorage.getItem("griddle_stats")).toContain("\"played\":9");
    expect(localStorage.getItem("weavle_stats")).toBeNull();
  });

  it("should persist game state and restore completed game state on reload", async () => {
    const { dayNumber } = await import("./game");
    const today = dayNumber();

    const mockGameState = {
      puzzleNumber: today,
      guesses: ["crane", "slate", "point"],
      selected: 2,
      input: "",
      over: true,
      won: true
    };

    localStorage.setItem("griddle_game", JSON.stringify(mockGameState));

    const stored = localStorage.getItem("griddle_game");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.over).toBe(true);
    expect(parsed.guesses).toHaveLength(3);
    expect(parsed.puzzleNumber).toBe(today);
  });
});
