import { Puzzle } from "./types";
import { stateAt, gridLetters } from "./game";
import { paintCell } from "./cell";

const DEMO_PUZZLE: Puzzle = {
  h: ["snake", "least", "every"],
  v: ["solve", "aware", "entry"]
};

const DEMO_ANSWERS = [...DEMO_PUZZLE.h, ...DEMO_PUZZLE.v];
const DEMO_GUESSES = ["acres", "least"];

let currentDemoIndex = 0;
let demoSlideTimeout: ReturnType<typeof setTimeout> | null = null;
let autoLoopTimer: ReturnType<typeof setTimeout> | null = null;
let userInteracted = false;

export type SlideDirection = 'forward' | 'backward' | 'none';

export function renderDemoBoard(index: number, animate: boolean | SlideDirection = 'none'): void {
  const tab1 = document.getElementById("demoTab1");
  const tab2 = document.getElementById("demoTab2");
  const timelineLabel = document.getElementById("demoTimelineLabel");

  if (!tab1 || !tab2 || !timelineLabel) return;

  let direction: SlideDirection = 'none';
  if (typeof animate === 'string') {
    direction = animate;
  } else if (animate) {
    direction = index > currentDemoIndex ? 'forward' : index < currentDemoIndex ? 'backward' : 'none';
  }
  currentDemoIndex = index;

  const state = stateAt(index, DEMO_GUESSES, DEMO_ANSWERS);
  const letters = gridLetters(DEMO_PUZZLE);

  const board1 = document.getElementById("demoBoard1");
  const board2 = document.getElementById("demoBoard2");
  const track = document.getElementById("demoBoardTrack");

  if (!board1 || !board2 || !track) return;

  if (demoSlideTimeout) {
    clearTimeout(demoSlideTimeout);
    demoSlideTimeout = null;
    track.style.transition = "none";
    board1.innerHTML = board2.innerHTML;
    board1.style.order = "1";
    board2.style.order = "2";
    track.style.transform = "translateX(0)";
  }

  const fillBoard = (targetBoard: HTMLElement) => {
    targetBoard.innerHTML = "";
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const cell = document.createElement("div");
        paintCell(cell, {
          green: state.green[r][c],
          hints: state.yellow[r][c],
          letter: letters[r][c],
        });
        targetBoard.appendChild(cell);
      }
    }
  };

  tab1.className = "guess-tab demo-tab" + (index === 0 ? " current" : "");
  tab2.className = "guess-tab demo-tab" + (index === 1 ? " current" : "");
  timelineLabel.textContent = "Showing board after guess " + (index + 1) + ": " + DEMO_GUESSES[index].toUpperCase();

  if (direction === 'none') {
    fillBoard(board1);
    board1.style.order = "1";
    board2.style.order = "2";
    track.style.transition = "none";
    track.style.transform = "translateX(0)";
  } else if (direction === 'forward') {
    fillBoard(board2);
    board1.style.order = "1";
    board2.style.order = "2";
    track.style.transition = "none";
    track.style.transform = "translateX(0)";
    void track.offsetHeight;

    track.style.transition = "transform .25s ease-out";
    track.style.transform = "translateX(-50%)";

    demoSlideTimeout = setTimeout(() => {
      if (!board1.isConnected || !board2.isConnected || !track.isConnected) return;
      track.style.transition = "none";
      board1.innerHTML = board2.innerHTML;
      board1.style.order = "1";
      board2.style.order = "2";
      track.style.transform = "translateX(0)";
      demoSlideTimeout = null;
    }, 250);
  } else if (direction === 'backward') {
    fillBoard(board2);
    board2.style.order = "1";
    board1.style.order = "2";
    track.style.transition = "none";
    track.style.transform = "translateX(-50%)";
    void track.offsetHeight;

    track.style.transition = "transform .25s ease-out";
    track.style.transform = "translateX(0)";

    demoSlideTimeout = setTimeout(() => {
      if (!board1.isConnected || !board2.isConnected || !track.isConnected) return;
      track.style.transition = "none";
      board1.innerHTML = board2.innerHTML;
      board1.style.order = "1";
      board2.style.order = "2";
      track.style.transform = "translateX(0)";
      demoSlideTimeout = null;
    }, 250);
  }
}

export function stopDemoLoop(): void {
  userInteracted = true;
  if (autoLoopTimer) {
    clearTimeout(autoLoopTimer);
    autoLoopTimer = null;
  }
  const tab1 = document.getElementById("demoTab1");
  const tab2 = document.getElementById("demoTab2");
  tab1?.classList.remove("tapped");
  tab2?.classList.remove("tapped");
}

export function resetDemoState(): void {
  currentDemoIndex = 0;
  userInteracted = false;
  if (autoLoopTimer) {
    clearTimeout(autoLoopTimer);
    autoLoopTimer = null;
  }
  if (demoSlideTimeout) {
    clearTimeout(demoSlideTimeout);
    demoSlideTimeout = null;
  }
}

function runLoopStep(): void {
  if (userInteracted) return;

  // Alternate between guess 1 (index 0) and guess 2 (index 1)
  const nextIndex = currentDemoIndex === 0 ? 1 : 0;
  const targetTab = document.getElementById(nextIndex === 1 ? "demoTab2" : "demoTab1");

  if (targetTab) {
    targetTab.classList.add("tapped");
  }

  autoLoopTimer = setTimeout(() => {
    if (userInteracted) return;
    targetTab?.classList.remove("tapped");
    renderDemoBoard(nextIndex, true);

    autoLoopTimer = setTimeout(() => {
      if (!userInteracted) {
        runLoopStep();
      }
    }, 2000);
  }, 450);
}

export function startDemoLoop(): void {
  userInteracted = false;
  if (autoLoopTimer) clearTimeout(autoLoopTimer);
  renderDemoBoard(0, false);
  autoLoopTimer = setTimeout(() => {
    if (!userInteracted) {
      runLoopStep();
    }
  }, 2000);
}

export function initDemo(): void {
  const tab1 = document.getElementById("demoTab1");
  const tab2 = document.getElementById("demoTab2");

  if (tab1) {
    tab1.onclick = () => {
      stopDemoLoop();
      renderDemoBoard(0, true);
    };
  }

  if (tab2) {
    tab2.onclick = () => {
      stopDemoLoop();
      renderDemoBoard(1, true);
    };
  }

  startDemoLoop();
}
