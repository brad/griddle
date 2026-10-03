// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { dayNumber } from "./game";
import { buildAndShareGif } from "./gif";

vi.mock("./gif", () => ({
  buildAndShareGif: vi.fn(),
}));

function seedGame(over: boolean) {
  localStorage.setItem(
    "griddle_game",
    JSON.stringify({
      puzzleNumber: dayNumber(),
      guesses: ["grill", "amber", "alarm", "elect", "grade", "image", "limit"],
      selected: 6,
      input: "",
      over,
      won: over,
    })
  );
}

function baseDom() {
  document.body.innerHTML = `
    <header>
      <span id="puzzleNumber"></span>
      <span id="guessCount">0</span>
      <div class="actions">
        <button id="shareBtn" aria-label="Share results" hidden>📤</button>
      </div>
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
    <div class="overlay" id="results">
      <h2 id="resultTitle"></h2>
      <p id="resultMessage"></p>
      <p id="shareText"></p>
      <div class="split-btn">
        <button id="copyShare">Copy results</button>
        <button id="shareMenuBtn" aria-label="More share options" aria-haspopup="menu" aria-expanded="false">▾</button>
        <div class="share-menu" id="shareMenu" role="menu" hidden>
          <button id="shareTextOpt" role="menuitem">Copy as text</button>
          <button id="shareGifOpt" role="menuitem">Share as GIF</button>
        </div>
      </div>
      <button id="closeResults">Close</button>
    </div>
  `;
}

describe("header share button", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it("is hidden while the game is still in progress", async () => {
    seedGame(false);
    baseDom();
    await import("./main");
    expect(document.getElementById("shareBtn")?.hidden).toBe(true);
  });

  it("is visible when a finished game is restored", async () => {
    seedGame(true);
    baseDom();
    await import("./main");
    expect(document.getElementById("shareBtn")?.hidden).toBe(false);
  });

  it("reopens the results dialog after it was closed", async () => {
    vi.useFakeTimers();
    try {
      seedGame(true);
      baseDom();
      await import("./main");
      vi.advanceTimersByTime(300); // pickDaily's deferred showResults()
      const results = document.getElementById("results")!;
      expect(results.classList.contains("show")).toBe(true);
      // Simulate the user closing the dialog.
      results.classList.remove("show");
      (document.getElementById("shareBtn") as HTMLButtonElement).click();
      expect(results.classList.contains("show")).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("GIF share spinner", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    vi.mocked(buildAndShareGif).mockReset();
  });

  it("shows a spinner in the menu option while the GIF builds", async () => {
    let resolveGif!: (v: "shared" | "downloaded") => void;
    vi.mocked(buildAndShareGif).mockReturnValue(
      new Promise<"shared" | "downloaded">((r) => (resolveGif = r))
    );
    seedGame(true);
    baseDom();
    await import("./main");
    const opt = document.getElementById("shareGifOpt") as HTMLButtonElement;
    opt.click();
    // The 30ms paint yield, then the mocked (still pending) build.
    await new Promise((r) => setTimeout(r, 80));
    expect(opt.innerHTML).toContain("spinner");
    expect(opt.innerHTML).toContain("Making GIF");
    expect(opt.disabled).toBe(true);
    resolveGif("downloaded");
    await new Promise((r) => setTimeout(r, 20));
    expect(opt.innerHTML).not.toContain("spinner");
    expect(opt.disabled).toBe(false);
  });
});
