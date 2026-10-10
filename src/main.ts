import { initDemo, startDemoLoop, stopDemoLoop } from './demo';
import type { Puzzle, Stats, GameState } from './types';
import { PUZZLES, VALID, KEY_ROWS, MAX_GUESSES } from './data';
import { dayNumber, stateAt, gridLetters, keyState, complete, best } from './game';
import { paintCell } from './cell';
import { share, starCount, starPositions } from './share';
import { buildAndShareGif } from './gif';
import {
  DIST_BUCKET_COUNT,
  DIST_MIN_GUESSES,
  STAR_BUCKETS,
  defaultStats,
  normalizeGuessDist,
  normalizeStarDist,
  recordHistory,
} from './stats';
import {
  initSync,
  isSyncConfigured,
  schedulePush,
  signIn,
  signOut,
  touchUpdatedAt,
} from './sync';

export type SlideDirection = 'forward' | 'backward' | 'none';

// Umami analytics global (loaded via defer script in index.html; may be
// absent when blocked or still loading).
declare const umami:
  | { track: (event: string, data?: Record<string, string>) => void }
  | undefined;

function trackGameEnd(event: "game-completed" | "game-busted"): void {
  if (typeof umami !== "undefined") {
    umami.track(event, { guesses: String(guesses.length) });
  }
}

let puzzleNumber: number;
let puzzle: Puzzle;
let answers: string[];
let guesses: string[] = [];
let selected = -1;
let input = "";
let over = false;
let won = false;
let mainSlideTimeout: ReturnType<typeof setTimeout> | null = null;

// Review mode: the player is viewing an older guess. Board, keyboard, and
// input reflect the game as of that guess; typing is disabled until they
// return to the latest guess.
function isReviewing(): boolean {
  return selected >= 0 && selected < guesses.length - 1;
}

// Storage keys. Renamed weavle_* -> griddle_* with the 2026-10-02 rebrand;
// migrateStorageKeys() carries existing players' data forward exactly once.
const LS_GAME = "griddle_game";
const LS_STATS = "griddle_stats";
const LS_HELP_DISMISSED = "griddle_help_dismissed";
const LEGACY_KEYS: Array<[string, string]> = [
  ["weavle_game", LS_GAME],
  ["weavle_stats", LS_STATS],
  ["weavle_help_dismissed", LS_HELP_DISMISSED],
];

export function migrateStorageKeys(): void {
  for (const [oldKey, newKey] of LEGACY_KEYS) {
    try {
      if (localStorage.getItem(newKey) === null) {
        const oldValue = localStorage.getItem(oldKey);
        if (oldValue !== null) localStorage.setItem(newKey, oldValue);
      }
      localStorage.removeItem(oldKey);
    } catch {
      // Storage unavailable (private mode etc.) — the game works without it.
    }
  }
}

function loadStats(): Stats {
  const stored = localStorage.getItem(LS_STATS);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      return {
        ...defaultStats(),
        ...parsed,
        guessDist: normalizeGuessDist(parsed.guessDist),
        starDist: normalizeStarDist(parsed.starDist),
      };
    } catch {
      return defaultStats();
    }
  }
  return defaultStats();
}

function saveStats(stats: Stats): void {
  localStorage.setItem(LS_STATS, JSON.stringify(stats));
  touchUpdatedAt();
  schedulePush();
}

function saveGameState(): void {
  const state: GameState = {
    puzzleNumber,
    guesses,
    selected,
    input,
    over,
    won
  };
  localStorage.setItem(LS_GAME, JSON.stringify(state));
  touchUpdatedAt();
  schedulePush();
}

function loadGameState(): GameState | null {
  const stored = localStorage.getItem(LS_GAME);
  if (!stored) return null;
  try {
    const state = JSON.parse(stored);
    const today = dayNumber();
    if (state.puzzleNumber !== today) {
      localStorage.removeItem(LS_GAME);
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

function clearGameState(): void {
  localStorage.removeItem(LS_GAME);
}

function updateStats(won: boolean, guessCount: number, bestScore: number): void {
  const stats = loadStats();
  const today = dayNumber();

  if (stats.lastPlayed === today) {
    return;
  }

  stats.played++;
  stats.lastPlayed = today;

  if (won) {
    stats.wins++;
    stats.currentStreak++;
    if (stats.currentStreak > stats.maxStreak) {
      stats.maxStreak = stats.currentStreak;
    }
    const idx = guessCount - DIST_MIN_GUESSES;
    if (idx >= 0 && idx < DIST_BUCKET_COUNT) {
      stats.guessDist[idx]++;
    }
  } else {
    stats.currentStreak = 0;
  }

  const stars = starCount(guessCount, bestScore);
  if (stars >= 0 && stars < STAR_BUCKETS) {
    stats.starDist[stars]++;
  }
  recordHistory({ day: today, guesses: guessCount, stars, won });

  saveStats(stats);
}

let statsTab: "guesses" | "stars" = "guesses";

function distBar(label: string, count: number, maxCount: number): string {
  const barWidth = (count / Math.max(maxCount, 1)) * 100;
  return `
    <div style="display:flex;align-items:center;gap:8px">
      <span style="width:28px;text-align:right;font-variant-numeric:tabular-nums">${label}</span>
      <div style="flex:1;height:8px;background:var(--cell);border-radius:4px;overflow:hidden">
        <div style="width:${barWidth}%;height:100%;background:var(--green);transition:width .3s"></div>
      </div>
      <span style="width:36px;text-align:right;font-variant-numeric:tabular-nums">${count}</span>
    </div>
  `;
}

function renderGuessDist(stats: Stats): string {
  const maxDist = Math.max(...stats.guessDist, 1);
  return `
    <div style="font-size:.75rem;color:var(--muted);margin-bottom:8px">GUESS DISTRIBUTION</div>
    <div style="display:flex;flex-direction:column;gap:4px">
      ${stats.guessDist
        .map((count, i) => distBar(String(i + DIST_MIN_GUESSES), count, maxDist))
        .join("")}
    </div>
  `;
}

function renderStarDist(stats: Stats): string {
  const total = stats.starDist.reduce((a, b) => a + b, 0);
  const avg =
    total > 0
      ? (stats.starDist.reduce((a, b, i) => a + b * i, 0) / total).toFixed(1)
      : "–";
  const maxDist = Math.max(...stats.starDist, 1);
  const rows = [];
  for (let s = STAR_BUCKETS - 1; s >= 0; s--) {
    rows.push(distBar(`${s}★`, stats.starDist[s], maxDist));
  }
  return `
    <div style="font-size:.75rem;color:var(--muted);margin-bottom:8px">STAR DISTRIBUTION</div>
    <div style="font-size:.8rem;margin-bottom:8px">Average <strong>${avg} ★</strong> over ${total} game${total === 1 ? "" : "s"}</div>
    <div style="display:flex;flex-direction:column;gap:4px">
      ${rows.join("")}
    </div>
  `;
}

function renderStats(): void {
  const stats = loadStats();
  const content = document.getElementById("statsContent");
  if (!content) return;

  const winPct = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;
  const tabStyle = (active: boolean) =>
    `flex:1;padding:6px;font-size:.8rem;${active ? "font-weight:700;border-color:var(--accent);" : ""}`;

  content.innerHTML = `
    <div style="display:flex;justify-content:space-around;margin-bottom:16px;font-size:.9rem">
      <div style="text-align:center">
        <div style="font-size:1.5rem;font-weight:700">${stats.played}</div>
        <div style="color:var(--muted);font-size:.7rem">PLAYED</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:1.5rem;font-weight:700">${winPct}%</div>
        <div style="color:var(--muted);font-size:.7rem">WIN %</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:1.5rem;font-weight:700">${stats.currentStreak}</div>
        <div style="color:var(--muted);font-size:.7rem">CURRENT STREAK</div>
      </div>
      <div style="text-align:center">
        <div style="font-size:1.5rem;font-weight:700">${stats.maxStreak}</div>
        <div style="color:var(--muted);font-size:.7rem">MAX STREAK</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      <button id="tabGuesses" style="${tabStyle(statsTab === "guesses")}">Guesses</button>
      <button id="tabStars" style="${tabStyle(statsTab === "stars")}">Stars</button>
    </div>
    ${statsTab === "guesses" ? renderGuessDist(stats) : renderStarDist(stats)}
  `;

  const tabGuesses = document.getElementById("tabGuesses");
  if (tabGuesses) tabGuesses.onclick = () => { statsTab = "guesses"; renderStats(); };
  const tabStars = document.getElementById("tabStars");
  if (tabStars) tabStars.onclick = () => { statsTab = "stars"; renderStats(); };
}

const GOOGLE_G_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>`;
const FACEBOOK_F_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`;

function providerButton(
  provider: "google" | "facebook",
  label: string,
  logo: string,
  background: string,
  color: string,
  border: string,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.setAttribute(
    "style",
    `display:flex;align-items:center;justify-content:center;gap:10px;width:100%;` +
      `padding:10px;border-radius:6px;font-size:.9rem;font-weight:500;cursor:pointer;` +
      `background:${background};color:${color};border:1px solid ${border};margin-top:8px`,
  );
  btn.innerHTML = `${logo}<span>${label}</span>`;
  btn.onclick = () => {
    signIn(provider).catch(() => {});
  };
  return btn;
}

function renderSyncBody(email: string | null): void {
  const body = document.getElementById("syncBody");
  if (!body) return;
  body.innerHTML = "";
  if (email) {
    const label = document.createElement("div");
    label.style.fontSize = ".8rem";
    label.style.color = "var(--muted)";
    label.textContent = `Signed in as ${email}`;
    const btn = document.createElement("button");
    btn.textContent = "Sign out";
    btn.style.marginTop = "8px";
    btn.onclick = () => {
      signOut().catch(() => {});
    };
    body.append(label, btn);
  } else {
    const googleBtn = providerButton(
      "google",
      "Sign in with Google",
      GOOGLE_G_SVG,
      "#fff",
      "#1f1f1f",
      "#dadce0",
    );
    const facebookBtn = providerButton(
      "facebook",
      "Continue with Facebook",
      FACEBOOK_F_SVG,
      "#1877f2",
      "#fff",
      "#1877f2",
    );
    const note = document.createElement("div");
    note.style.fontSize = ".75rem";
    note.style.color = "var(--muted)";
    note.style.marginTop = "8px";
    note.textContent = "Sync stats and today's game across devices.";
    body.append(googleBtn, facebookBtn, note);
  }
}

function initSyncUI(): void {
  const section = document.getElementById("syncSection");
  if (!section || !isSyncConfigured()) return;
  section.hidden = false;
  renderSyncBody(null);
  initSync({
    onUser: (email) => renderSyncBody(email),
    onRemoteApplied: () => location.reload(),
  }).catch(() => {});
}

function pickDaily(): void {
  puzzleNumber = dayNumber();
  puzzle = PUZZLES[(puzzleNumber - 1) % PUZZLES.length];
  answers = [...puzzle.h, ...puzzle.v];
  const puzzleNumEl = document.getElementById("puzzleNumber");
  if (puzzleNumEl) puzzleNumEl.textContent = String(puzzleNumber);
  const bestEl = document.getElementById("bestValue");
  if (bestEl) bestEl.textContent = String(best(puzzle));

  const saved = loadGameState();
  if (saved) {
    guesses = saved.guesses;
    selected = saved.selected;
    input = saved.input;
    over = saved.over;
    won = saved.won;
  } else {
    guesses = [];
    selected = -1;
    input = "";
    over = false;
    won = false;
  }

  const guessCountEl = document.getElementById("guessCount");
  if (guessCountEl) guessCountEl.textContent = String(guesses.length);

  if (over) {
    message(won ? "Solved in " + guesses.length + " guesses." : "Bust. The words were " + answers.join(", ").toUpperCase() + ".", !won);
    setTimeout(() => showResults(), 250);
  } else if (guesses.length > 0) {
    message((MAX_GUESSES - guesses.length) + " guesses left.");
  } else {
    message("Use the keyboard to enter a guess.");
  }

  renderBoard('none');
  renderTabs();
  renderTyped();
  renderKeyboard();
  renderShareBtn();
}

export function renderBoard(direction: SlideDirection = 'none'): void {
  const board1 = document.getElementById("board1");
  const board2 = document.getElementById("board2");
  const track = document.getElementById("boardTrack");

  if (!board1 || !board2 || !track) return;

  if (mainSlideTimeout) {
    clearTimeout(mainSlideTimeout);
    mainSlideTimeout = null;
    track.style.transition = "none";
    board1.innerHTML = board2.innerHTML;
    board1.style.order = "1";
    board2.style.order = "2";
    track.style.transform = "translateX(0)";
  }

  const s = stateAt(selected, guesses, answers);
  const letters = puzzle ? gridLetters(puzzle) : Array(5).fill(Array(5).fill(""));

  const fillBoard = (targetBoard: HTMLElement) => {
    targetBoard.innerHTML = "";
    // Stars are earned for the win: show them only when viewing the final
    // guess, not when flipping back through earlier guesses.
    const starSet = over && selected === guesses.length - 1
      ? new Set(starPositions(guesses.length, best(puzzle)).map(([sr, sc]) => sr * 5 + sc))
      : new Set<number>();
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const d = document.createElement("div");
        paintCell(d, {
          green: s.green[r][c],
          hints: s.yellow[r][c],
          letter: letters[r][c],
          star: starSet.has(r * 5 + c),
        });
        if (animateStars && starSet.has(r * 5 + c)) d.classList.add("pop");
        targetBoard.appendChild(d);
      }
    }
  };

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

    mainSlideTimeout = setTimeout(() => {
      if (!board1.isConnected || !board2.isConnected || !track.isConnected) return;
      track.style.transition = "none";
      board1.innerHTML = board2.innerHTML;
      board1.style.order = "1";
      board2.style.order = "2";
      track.style.transform = "translateX(0)";
      mainSlideTimeout = null;
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

    mainSlideTimeout = setTimeout(() => {
      if (!board1.isConnected || !board2.isConnected || !track.isConnected) return;
      track.style.transition = "none";
      board1.innerHTML = board2.innerHTML;
      board1.style.order = "1";
      board2.style.order = "2";
      track.style.transform = "translateX(0)";
      mainSlideTimeout = null;
    }, 250);
  }
  animateStars = false;
}

function renderTyped(): void {
  const p = document.getElementById("typed");
  if (!p) return;
  p.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const d = document.createElement("div");
    d.className = "typed-tile" + (input[i] ? " filled" : "");
    d.textContent = input[i] || "";
    p.appendChild(d);
  }
}

function renderTabs(): void {
  const t = document.getElementById("guessTabs");
  const l = document.getElementById("timelineLabel");
  if (!t || !l) return;
  t.innerHTML = "";
  if (selected < 0) {
    l.textContent = "Your guesses will appear here.";
    return;
  }
  l.textContent = "Showing board after guess " + (selected + 1) + ": " + guesses[selected].toUpperCase();
  guesses.forEach((g, i) => {
    const b = document.createElement("button");
    b.className = "guess-tab" + (i === selected ? " current" : "");
    b.textContent = String(i + 1);
    b.title = g.toUpperCase();
    b.onclick = () => {
      const prev = selected;
      selected = i;
      const direction: SlideDirection = selected > prev ? 'forward' : selected < prev ? 'backward' : 'none';
      renderBoard(direction);
      renderTabs();
      renderKeyboard();
    };
    t.appendChild(b);
  });
}

function renderKeyboard(): void {
  const k = document.getElementById("keyboard");
  if (!k) return;
  // The keyboard reflects the viewed guess, like the board does.
  const s = keyState(guesses.slice(0, selected + 1), answers);
  const reviewing = isReviewing();
  k.innerHTML = "";
  KEY_ROWS.forEach((row, rowIndex) => {
    const r = document.createElement("div");
    r.className = "key-row";
    if (rowIndex === 1) {
      const spacerLeft = document.createElement("div");
      spacerLeft.className = "key-spacer";
      r.appendChild(spacerLeft);
    }
    for (const c of row) {
      const b = document.createElement("button");
      b.className = "key" + (c === "↵" || c === "⌫" ? " wide" : "") + (s[c.toLowerCase()] ? " " + s[c.toLowerCase()] : "");
      b.textContent = c === "↵" ? "ENTER" : c === "⌫" ? "⌫" : c;
      b.disabled = reviewing;
      b.onclick = () => press(c);
      r.appendChild(b);
    }
    if (rowIndex === 1) {
      const spacerRight = document.createElement("div");
      spacerRight.className = "key-spacer";
      r.appendChild(spacerRight);
    }
    k.appendChild(r);
  });
  const submitBtn = document.getElementById("submit") as HTMLButtonElement | null;
  if (submitBtn) submitBtn.disabled = reviewing;
}

function message(text: string, bad = false): void {
  const e = document.getElementById("msg");
  if (!e) return;
  e.textContent = text;
  e.className = "msg" + (bad ? " bad" : "");
}

function press(c: string): void {
  if (over || isReviewing()) return;
  if (c === "↵") return submit();
  if (c === "⌫") {
    input = input.slice(0, -1);
    return renderTyped();
  }
  if (/^[a-z]$/i.test(c) && input.length < 5) {
    input += c.toUpperCase();
    renderTyped();
  }
}

function submit(): void {
  if (over) return;
  const g = input.toLowerCase();
  input = "";
  renderTyped();
  if (g.length !== 5) return message("Need a 5-letter word.", true);
  if (!VALID.has(g) && !answers.includes(g)) return message("Not in the built-in word list.", true);
  if (guesses.includes(g)) return message("Already guessed.", true);

  guesses.push(g);
  selected = guesses.length - 1;
  const s = stateAt(selected, guesses, answers);
  renderBoard('forward');
  renderTabs();
  renderKeyboard();

  const guessCountEl = document.getElementById("guessCount");
  if (guessCountEl) guessCountEl.textContent = String(guesses.length);

  if (answers.every(w => guesses.includes(w)) || complete(s)) {
    over = true;
    won = true;
    animateStars = true;
    message("Solved in " + guesses.length + " guesses.");
    trackGameEnd("game-completed");
    setTimeout(() => showResults(), 250);
    saveGameState();
    return;
  }
  if (guesses.length === MAX_GUESSES) {
    over = true;
    won = false;
    message("Bust. The words were " + answers.join(", ").toUpperCase() + ".", true);
    trackGameEnd("game-busted");
    setTimeout(() => showResults(), 250);
    saveGameState();
    return;
  }
  message((MAX_GUESSES - guesses.length) + " guesses left.");
  saveGameState();
}

function renderShare(): void {
  const shareTextEl = document.getElementById("shareText");
  if (shareTextEl) shareTextEl.textContent = share(puzzleNumber, won, guesses, answers, puzzle);
}

function showResults(): void {
  // Repaint the finished board so earned stars appear in the gaps.
  renderBoard('none');
  const resTitle = document.getElementById("resultTitle");
  if (resTitle) resTitle.textContent = won ? "Griddle solved!" : "Griddle — busted";
  const resMsg = document.getElementById("resultMessage");
  if (resMsg) {
    resMsg.textContent = won
      ? "You solved Griddle " + puzzleNumber + " in " + guesses.length + "/" + MAX_GUESSES + " guesses."
      : "You used all 10 guesses.";
  }
  updateStats(won, guesses.length, best(puzzle));
  renderShare();
  renderShareBtn();
  document.getElementById("results")?.classList.add("show");
  saveGameState();
}

async function copyShare(): Promise<void> {
  const shareContent = share(puzzleNumber, won, guesses, answers, puzzle);
  const copyBtn = document.getElementById("copyShare");
  try {
    await navigator.clipboard.writeText(shareContent);
    if (copyBtn) copyBtn.textContent = "Copied!";
    setTimeout(() => {
      if (copyBtn) copyBtn.textContent = "Copy results";
    }, 1200);
  } catch {
    prompt("Copy results:", shareContent);
  }
}

function closeShareMenu(): void {
  document.getElementById("shareMenu")?.setAttribute("hidden", "");
  document.getElementById("shareMenuBtn")?.setAttribute("aria-expanded", "false");
}

/** The header share button reopens the results dialog; visible only once the game is over. */
function renderShareBtn(): void {
  const btn = document.getElementById("shareBtn");
  if (btn) btn.hidden = !over;
}

async function shareGifFlow(): Promise<void> {
  const opt = document.getElementById("shareGifOpt") as HTMLButtonElement | null;
  if (!opt || opt.disabled) return;
  const original = opt.innerHTML;
  opt.disabled = true;
  opt.innerHTML = `<span class="spinner" aria-hidden="true"></span>Making GIF…`;
  // Let the spinner paint before the heavy rasterize/encode work begins.
  await new Promise(r => setTimeout(r, 30));
  try {
    const how = await buildAndShareGif({ puzzleNumber, guesses, answers, puzzle, won });
    closeShareMenu();
    message(how === "shared" ? "GIF shared!" : "GIF downloaded — text copied.");
  } catch (e) {
    // Dismissing the system share sheet throws AbortError; stay silent then.
    if (e instanceof DOMException && e.name === "AbortError") return;
    message("Couldn't make the GIF. Try text instead?", true);
  } finally {
    opt.disabled = false;
    opt.innerHTML = original;
  }
}

let shareMenuWired = false;
// One-shot flag: the next board paint pops earned stars in, then clears.
let animateStars = false;

function initShareMenu(): void {
  const menuBtn = document.getElementById("shareMenuBtn");
  const menu = document.getElementById("shareMenu");
  const textOpt = document.getElementById("shareTextOpt");
  const gifOpt = document.getElementById("shareGifOpt");
  if (!menuBtn || !menu) return;
  menuBtn.onclick = (e) => {
    e.stopPropagation();
    const isHidden = menu.hasAttribute("hidden");
    if (isHidden) {
      menu.removeAttribute("hidden");
      menuBtn.setAttribute("aria-expanded", "true");
    } else {
      closeShareMenu();
    }
  };
  menu.onclick = (e) => e.stopPropagation();
  if (textOpt) textOpt.onclick = () => { closeShareMenu(); copyShare(); };
  if (gifOpt) gifOpt.onclick = () => { shareGifFlow(); };
  if (!shareMenuWired) {
    shareMenuWired = true;
    document.addEventListener("click", closeShareMenu);
  }
}

function reset(): void {
  clearGameState();
  pickDaily();
  guesses = [];
  selected = -1;
  input = "";
  over = false;
  won = false;
  renderShareBtn();
  const guessCountEl = document.getElementById("guessCount");
  if (guessCountEl) guessCountEl.textContent = "0";
  message("Use the keyboard to enter a guess.");
  renderBoard('none');
  renderTabs();
  renderTyped();
  renderKeyboard();
  document.getElementById("results")?.classList.remove("show");
}

// Event Listeners setup
function initUI(): void {
  migrateStorageKeys();
  initSyncUI();
  const help = document.getElementById("help");
  const results = document.getElementById("results");
  const stats = document.getElementById("stats");

  // Check localStorage for dismissed help
  const helpDismissed = localStorage.getItem(LS_HELP_DISMISSED) === "true";
  if (!helpDismissed && help) {
    help.classList.add("show");
    startDemoLoop();
  }

  const helpBtn = document.getElementById("helpBtn");
  if (helpBtn) helpBtn.onclick = () => {
    help?.classList.add("show");
    startDemoLoop();
  };

  const statsBtn = document.getElementById("statsBtn");
  if (statsBtn) statsBtn.onclick = () => {
    renderStats();
    stats?.classList.add("show");
  };

  const closeHelp = document.getElementById("closeHelp");
  if (closeHelp) {
    const hideHelp = (e?: Event) => {
      e?.preventDefault();
      help?.classList.remove("show");
      stopDemoLoop();
      localStorage.setItem(LS_HELP_DISMISSED, "true");
    };
    closeHelp.onclick = hideHelp;
    closeHelp.addEventListener("touchstart", hideHelp, { passive: false });
  }

  const closeResults = document.getElementById("closeResults");
  if (closeResults) {
    const hideResults = (e?: Event) => {
      e?.preventDefault();
      results?.classList.remove("show");
    };
    closeResults.onclick = hideResults;
    closeResults.addEventListener("touchstart", hideResults, { passive: false });
  }

  // Reopen the results/share dialog after it was closed.
  const shareBtn = document.getElementById("shareBtn");
  if (shareBtn) {
    shareBtn.onclick = () => {
      document.getElementById("results")?.classList.add("show");
    };
  }

  const closeStats = document.getElementById("closeStats");
  if (closeStats) {
    const hideStats = (e?: Event) => {
      e?.preventDefault();
      stats?.classList.remove("show");
    };
    closeStats.onclick = hideStats;
    closeStats.addEventListener("touchstart", hideStats, { passive: false });
  }

  const submitBtn = document.getElementById("submit");
  if (submitBtn) submitBtn.onclick = submit;

  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) resetBtn.onclick = reset;

  const copyShareBtn = document.getElementById("copyShare");
  if (copyShareBtn) copyShareBtn.onclick = copyShare;
  initShareMenu();

  document.onkeydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      closeShareMenu();
      if (help?.classList.contains("show")) stopDemoLoop();
      help?.classList.remove("show");
      results?.classList.remove("show");
      stats?.classList.remove("show");
    } else if (!help?.classList.contains("show") && !results?.classList.contains("show") && !stats?.classList.contains("show")) {
      if (e.key === "Enter") press("↵");
      else if (e.key === "Backspace") press("⌫");
      else if (/^[a-z]$/i.test(e.key)) press(e.key.toLowerCase());
    }
  };

  const boardWrapper = document.getElementById("boardWrapper");
  if (boardWrapper) {
    let touchStartX = 0;
    let touchStartY = 0;

    boardWrapper.addEventListener("touchstart", (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    boardWrapper.addEventListener("touchend", (e: TouchEvent) => {
      if (guesses.length < 2) return;

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const dx = touchEndX - touchStartX;
      const dy = touchEndY - touchStartY;

      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
        if (dx > 0 && selected > 0) {
          selected--;
          renderBoard('backward');
          renderTabs();
          renderKeyboard();
        } else if (dx < 0 && selected < guesses.length - 1) {
          selected++;
          renderBoard('forward');
          renderTabs();
          renderKeyboard();
        }
      }
    }, { passive: true });
  }

  const demoBoardWrapper = document.getElementById("demoBoardWrapper");
  if (demoBoardWrapper) {
    let touchStartX = 0;
    let touchStartY = 0;

    demoBoardWrapper.addEventListener("touchstart", (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    demoBoardWrapper.addEventListener("touchend", (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const dx = touchEndX - touchStartX;
      const dy = touchEndY - touchStartY;

      const tab1 = document.getElementById("demoTab1");
      const tab2 = document.getElementById("demoTab2");
      const isTab1Active = tab1?.classList.contains("current");
      const isTab2Active = tab2?.classList.contains("current");

      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {
        if (dx > 0 && !isTab1Active) {
          tab1?.click();
        } else if (dx < 0 && !isTab2Active) {
          tab2?.click();
        }
      }
    }, { passive: true });
  }

  initDemo();
  pickDaily();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initUI);
} else {
  initUI();
}
