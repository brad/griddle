import { Puzzle } from "./types";
import { stateAt, gridLetters, keyState } from "./game";
import { paintCell } from "./cell";
import { KEY_ROWS } from "./data";

const DEMO_PUZZLE: Puzzle = {
  h: ["snake", "least", "every"],
  v: ["solve", "aware", "entry"]
};

const DEMO_ANSWERS = [...DEMO_PUZZLE.h, ...DEMO_PUZZLE.v];
// Each guess demonstrates a rule nuance:
//  acres: yellow hints, including a two-hint crossing square
//  least: green squares lock in
//  creep: double letter — one copy green, one yellow
//  spool: O is yellow on the keyboard, but its hint square is already green
const DEMO_GUESSES = ["acres", "least", "creep", "spool"];
const DEMO_TITLES = [
  "Yellow hints — one square shows two",
  "Green squares lock in",
  "Double letter: one green, one yellow",
  "O is yellow, but its square is green",
];

let currentDemoIndex = 0;
let demoSlideTimeout: ReturnType<typeof setTimeout> | null = null;
let autoLoopTimer: ReturnType<typeof setTimeout> | null = null;
let userInteracted = false;

export type SlideDirection = 'forward' | 'backward' | 'none';

export function renderDemoBoard(index: number, animate: boolean | SlideDirection = 'none'): void {
  const timelineLabel = document.getElementById("demoTimelineLabel");
  const title = document.getElementById("demoTitle");
  const tabs = document.querySelectorAll<HTMLElement>("#demoTabs .demo-tab");

  if (!timelineLabel) return;

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

  tabs.forEach((tab, i) => {
    tab.classList.toggle("current", i === index);
  });
  if (title) title.textContent = DEMO_TITLES[index];
  timelineLabel.textContent = "Showing board after guess " + (index + 1) + ": " + DEMO_GUESSES[index].toUpperCase();
  renderDemoKeyboard(index);

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

// Non-interactive keyboard showing the key colors for the viewed demo guess,
// exactly like the real game: it follows the selected tab, and dims while
// reviewing an earlier guess.
export function renderDemoKeyboard(index: number): void {
  const kb = document.getElementById("demoKeyboard");
  if (!kb) return;
  const s = keyState(DEMO_GUESSES.slice(0, index + 1), DEMO_ANSWERS);
  kb.innerHTML = "";
  kb.classList.toggle("reviewing", index < DEMO_GUESSES.length - 1);
  KEY_ROWS.forEach((row) => {
    const r = document.createElement("div");
    r.className = "key-row";
    for (const c of row) {
      if (c === "↵" || c === "⌫") continue;
      const k = document.createElement("span");
      k.className = "key demo-key" + (s[c.toLowerCase()] ? " " + s[c.toLowerCase()] : "");
      k.textContent = c;
      r.appendChild(k);
    }
    kb.appendChild(r);
  });
}

export function stopDemoLoop(): void {
  userInteracted = true;
  if (autoLoopTimer) {
    clearTimeout(autoLoopTimer);
    autoLoopTimer = null;
  }
  document.querySelectorAll("#demoTabs .demo-tab").forEach((tab) => {
    tab.classList.remove("tapped");
  });
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

  const nextIndex = (currentDemoIndex + 1) % DEMO_GUESSES.length;
  const tabs = document.querySelectorAll<HTMLElement>("#demoTabs .demo-tab");
  const targetTab = tabs[nextIndex];

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
  const container = document.getElementById("demoTabs");
  if (container) {
    container.innerHTML = "";
    DEMO_GUESSES.forEach((g, i) => {
      const b = document.createElement("button");
      b.className = "guess-tab demo-tab" + (i === 0 ? " current" : "");
      b.textContent = String(i + 1);
      b.title = g.toUpperCase();
      b.id = `demoTab${i + 1}`;
      b.onclick = () => {
        stopDemoLoop();
        renderDemoBoard(i, true);
      };
      container.appendChild(b);
    });
  }

  startDemoLoop();
}
