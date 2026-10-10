// Cloud sync: Firebase Auth (Google sign-in) + Firestore. The game works
// fully offline; sync is best-effort. Conflicts resolve last-write-wins on
// the updatedAt timestamp.

import { FIREBASE_CONFIG } from "./firebase-config";
import type { Stats, GameState } from "./types";

export function isSyncConfigured(): boolean {
  return FIREBASE_CONFIG.apiKey.length > 0;
}

export interface SyncPayload {
  stats: Stats | null;
  game: GameState | null;
  updatedAt: number;
}

const LS_UPDATED_AT = "griddle_updated_at";
const LS_STATS = "griddle_stats";
const LS_GAME = "griddle_game";

export function touchUpdatedAt(): void {
  try {
    localStorage.setItem(LS_UPDATED_AT, String(Date.now()));
  } catch {
    // Storage unavailable; the game works without it.
  }
}

function readJSON<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function readLocalPayload(): SyncPayload | null {
  const stats = readJSON<Stats>(LS_STATS);
  const game = readJSON<GameState>(LS_GAME);
  if (!stats && !game) return null;
  return {
    stats,
    game,
    updatedAt: Number(localStorage.getItem(LS_UPDATED_AT) ?? 0) || 0,
  };
}

export function writeLocalPayload(p: SyncPayload): void {
  if (p.stats) localStorage.setItem(LS_STATS, JSON.stringify(p.stats));
  if (p.game) localStorage.setItem(LS_GAME, JSON.stringify(p.game));
  localStorage.setItem(LS_UPDATED_AT, String(p.updatedAt));
}

export type SyncDirection = "push" | "pull" | "none";

export function chooseDirection(
  local: SyncPayload | null,
  remote: SyncPayload | null,
): SyncDirection {
  if (!local && !remote) return "none";
  if (!remote) return "push";
  if (!local) return "pull";
  if (remote.updatedAt > local.updatedAt) return "pull";
  if (local.updatedAt > remote.updatedAt) return "push";
  return "none";
}

interface FirebaseCtx {
  auth: import("firebase/auth").Auth;
  db: import("firebase/firestore").Firestore;
  signInWithPopup: typeof import("firebase/auth").signInWithPopup;
  signOut: typeof import("firebase/auth").signOut;
  GoogleAuthProvider: typeof import("firebase/auth").GoogleAuthProvider;
  onAuthStateChanged: typeof import("firebase/auth").onAuthStateChanged;
  doc: typeof import("firebase/firestore").doc;
  getDoc: typeof import("firebase/firestore").getDoc;
  setDoc: typeof import("firebase/firestore").setDoc;
  serverTimestamp: typeof import("firebase/firestore").serverTimestamp;
}

let ctx: FirebaseCtx | null = null;
let uid: string | null = null;

async function ensureCtx(): Promise<FirebaseCtx> {
  if (ctx) return ctx;
  const [{ initializeApp }, authMod, fsMod] = await Promise.all([
    import("firebase/app"),
    import("firebase/auth"),
    import("firebase/firestore"),
  ]);
  const app = initializeApp(FIREBASE_CONFIG);
  ctx = {
    auth: authMod.getAuth(app),
    db: fsMod.getFirestore(app),
    signInWithPopup: authMod.signInWithPopup,
    signOut: authMod.signOut,
    GoogleAuthProvider: authMod.GoogleAuthProvider,
    onAuthStateChanged: authMod.onAuthStateChanged,
    doc: fsMod.doc,
    getDoc: fsMod.getDoc,
    setDoc: fsMod.setDoc,
    serverTimestamp: fsMod.serverTimestamp,
  };
  return ctx;
}

function docToPayload(data: Record<string, unknown>): SyncPayload {
  const ts = data["updatedAt"];
  const updatedAt =
    ts !== null &&
    typeof ts === "object" &&
    "toMillis" in (ts as Record<string, unknown>)
      ? ((ts as unknown as { toMillis(): number }).toMillis() ?? 0)
      : 0;
  return {
    stats: (data["stats"] as Stats | null) ?? null,
    game: (data["game"] as GameState | null) ?? null,
    updatedAt,
  };
}

async function pushPayload(c: FirebaseCtx, id: string): Promise<void> {
  const local = readLocalPayload();
  if (!local) return;
  await c.setDoc(c.doc(c.db, "users", id), {
    stats: local.stats,
    game: local.game,
    updatedAt: c.serverTimestamp(),
  });
}

export interface SyncEvents {
  onUser(email: string | null): void;
  onRemoteApplied(): void;
}

export async function initSync(events: SyncEvents): Promise<void> {
  if (!isSyncConfigured()) return;
  const c = await ensureCtx();
  c.onAuthStateChanged(c.auth, async (user) => {
    uid = user?.uid ?? null;
    events.onUser(user?.email ?? null);
    if (!user || !uid) return;
    const id = uid;
    try {
      const snap = await c.getDoc(c.doc(c.db, "users", id));
      const remote = snap.exists()
        ? docToPayload(snap.data() as Record<string, unknown>)
        : null;
      const direction = chooseDirection(readLocalPayload(), remote);
      if (direction === "push") {
        await pushPayload(c, id);
      } else if (direction === "pull" && remote) {
        writeLocalPayload(remote);
        events.onRemoteApplied();
      }
    } catch {
      // Offline or permission error; local data stays the source of truth.
    }
  });
}

export async function signIn(): Promise<void> {
  const c = await ensureCtx();
  await c.signInWithPopup(c.auth, new c.GoogleAuthProvider());
}

export async function signOut(): Promise<void> {
  const c = await ensureCtx();
  uid = null;
  await c.signOut(c.auth);
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

export function schedulePush(): void {
  if (!isSyncConfigured() || !uid) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    pushTimer = null;
    try {
      await pushPayload(await ensureCtx(), uid as string);
    } catch {
      // Offline or permission error; the next save retries.
    }
  }, 1500);
}
