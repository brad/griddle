// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { renderDemoBoard, initDemo, stopDemoLoop, resetDemoState } from "./demo";

describe("demo board", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="demo-board-wrapper" id="demoBoardWrapper">
        <div class="demo-board-track" id="demoBoardTrack">
          <div class="demo-board" id="demoBoard1"></div>
          <div class="demo-board" id="demoBoard2"></div>
        </div>
      </div>
      <p id="demoTimelineLabel"></p>
      <button id="demoTab1" class="guess-tab demo-tab current">1</button>
      <button id="demoTab2" class="guess-tab demo-tab">2</button>
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

  it("allows switching tabs manually", () => {
    resetDemoState();
    initDemo();
    const tab2 = document.getElementById("demoTab2") as HTMLButtonElement;
    tab2.click();
    expect(tab2.classList.contains("current")).toBe(true);
    stopDemoLoop();
  });
});
