// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { renderDemoBoard, initDemo, stopDemoLoop, resetDemoState } from "./demo";

describe("demo board", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="demo-title" id="demoTitle"></div>
      <div class="demo-board-wrapper" id="demoBoardWrapper">
        <div class="demo-board-track" id="demoBoardTrack">
          <div class="demo-board" id="demoBoard1"></div>
          <div class="demo-board" id="demoBoard2"></div>
        </div>
      </div>
      <p id="demoTimelineLabel"></p>
      <div class="guess-tabs demo-tabs" id="demoTabs"></div>
      <div class="demo-keyboard" id="demoKeyboard"></div>
    `;
    resetDemoState();
  });

  it("renders 25 cells for 5x5 demo grid", () => {
    renderDemoBoard(0, false);
    const board = document.getElementById("demoBoard1");
    expect(board?.children.length).toBe(25);
  });

  it("highlights green and yellow cells for guess 1", () => {
    resetDemoState();
    renderDemoBoard(0, false);
    const revealedCells = document.querySelectorAll("#demoBoard1 .cell.revealed");
    expect(revealedCells.length).toBeGreaterThan(0);
  });

  it("shows row 2 completely green for guess 2 ('least')", () => {
    resetDemoState();
    renderDemoBoard(0, false);
    renderDemoBoard(1, false);
    const cells = document.querySelectorAll("#demoBoard1 .cell");
    // Row 2 is indices 10, 11, 12, 13, 14
    expect(cells[10].classList.contains("revealed")).toBe(true);
    expect(cells[11].classList.contains("revealed")).toBe(true);
    expect(cells[12].classList.contains("revealed")).toBe(true);
    expect(cells[13].classList.contains("revealed")).toBe(true);
    expect(cells[14].classList.contains("revealed")).toBe(true);
    expect(cells[10].textContent).toBe("l");
    expect(cells[11].textContent).toBe("e");
    expect(cells[12].textContent).toBe("a");
    expect(cells[13].textContent).toBe("s");
    expect(cells[14].textContent).toBe("t");
  });

  it("shows both hint letters where two words cross for guess 1 ('acres')", () => {
    resetDemoState();
    renderDemoBoard(0, false);
    // (2,4) is row 2, column 4 -> cell index 14: 's' from "least", 'r' from "entry"
    const cells = document.querySelectorAll("#demoBoard1 .cell");
    const dual = cells[14];
    expect(dual.classList.contains("hint2")).toBe(true);
    expect(dual.children.length).toBe(2);
    expect(dual.children[0].textContent).toBe("s");
    expect(dual.children[1].textContent).toBe("r");
  });

  it("generates one tab per demo guess", () => {
    resetDemoState();
    initDemo();
    const tabs = document.querySelectorAll("#demoTabs .demo-tab");
    expect(tabs.length).toBe(4);
    expect(tabs[0].textContent).toBe("1");
    expect(tabs[3].textContent).toBe("4");
    stopDemoLoop();
  });

  it("allows switching tabs manually", () => {
    resetDemoState();
    initDemo();
    const tab2 = document.getElementById("demoTab2") as HTMLButtonElement;
    tab2.click();
    expect(tab2.classList.contains("current")).toBe(true);
    stopDemoLoop();
  });

  it("updates the title per tab", () => {
    resetDemoState();
    renderDemoBoard(0, false);
    const title = document.getElementById("demoTitle");
    expect(title?.textContent).toContain("two");
    renderDemoBoard(2, false);
    expect(title?.textContent).toContain("two E's");
  });

  it("renders a non-interactive keyboard with cumulative colors", () => {
    resetDemoState();
    renderDemoBoard(0, false);
    const keys = document.querySelectorAll<HTMLElement>("#demoKeyboard .demo-key");
    expect(keys.length).toBe(26);
    const byLetter = new Map<string, HTMLElement>();
    keys.forEach((k) => byLetter.set(k.textContent || "", k));
    // 'a' locked green by "acres", 'r' yellow (in a word, unplaced)
    expect(byLetter.get("A")?.classList.contains("green")).toBe(true);
    expect(byLetter.get("R")?.classList.contains("yellow")).toBe(true);
    // non-interactive: spans, not buttons
    expect(byLetter.get("A")?.tagName).toBe("SPAN");
  });

  it("follows the viewed tab and dims while reviewing, like the real game", () => {
    resetDemoState();
    renderDemoBoard(0, false);
    const kb = document.getElementById("demoKeyboard");
    const keyOn = (n: number, letter: string) => {
      renderDemoBoard(n, false);
      return Array.from(document.querySelectorAll<HTMLElement>("#demoKeyboard .demo-key"))
        .find((k) => k.textContent === letter);
    };
    // Tab 1: only guess 1's letters — 'l' (from guess 2 "least") not yet green.
    expect(keyOn(0, "L")?.classList.contains("green")).toBe(false);
    expect(kb?.classList.contains("reviewing")).toBe(true);
    // Latest tab: full keyboard, not dimmed.
    renderDemoBoard(3, false);
    expect(kb?.classList.contains("reviewing")).toBe(false);
    const lKey = Array.from(document.querySelectorAll<HTMLElement>("#demoKeyboard .demo-key"))
      .find((k) => k.textContent === "L");
    expect(lKey?.classList.contains("green")).toBe(true);
  });

  it("shows double-e as green + yellow for guess 3 ('creep')", () => {
    resetDemoState();
    renderDemoBoard(2, false);
    const cells = document.querySelectorAll("#demoBoard1 .cell");
    // (4,2) index 22: green E; (4,3) index 23: yellow e hint
    expect(cells[22].classList.contains("revealed")).toBe(true);
    expect(cells[22].textContent).toBe("e");
    expect(cells[23].textContent).toBe("e");
    expect(cells[23].classList.contains("revealed")).toBe(false);
  });

  it("shows no yellow tiles on guess 4 ('spool') while O stays yellow on the keyboard", () => {
    resetDemoState();
    renderDemoBoard(3, false);
    // O's hint square is already green: no yellow tiles at all
    expect(document.querySelectorAll("#demoBoard1 .cell.hint").length).toBe(0);
    expect(document.querySelectorAll("#demoBoard1 .cell.hint2").length).toBe(0);
    // ...but the keyboard still tracks O as unplaced
    const keys = document.querySelectorAll<HTMLElement>("#demoKeyboard .demo-key");
    const oKey = Array.from(keys).find((k) => k.textContent === "O");
    expect(oKey?.classList.contains("yellow")).toBe(true);
  });
});
