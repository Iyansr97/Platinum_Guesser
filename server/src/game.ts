import { randomUUID } from "node:crypto";
import { db } from "./db.js";
import { getPlatinums, getProfile, type Platinum } from "./profile.js";
import { HttpError } from "./psn.js";
import { cleanTitle, hintWords, normalize } from "./text.js";

export type HintType = "date" | "word" | "platforms" | "year";

/** Monedas que se ganan por cada platino acertado y coste de cada pista. */
export const COINS_PER_PLATINUM = 1;
export const HINT_COST: Record<HintType, number> = { date: 1, platforms: 1, year: 1, word: 3 };

interface GuessError {
  igdbId: number;
  name: string;
  cover: string | null;
}

interface SessionState {
  guessed: number[]; // ids de platinos adivinados
  errors: GuessError[];
  hintTarget: number | null; // id del platino objetivo de las pistas
  hints?: { type: HintType; text: string }[]; // (antiguo) pistas del objetivo actual
  hintsByTarget: Record<number, { type: HintType; text: string }[]>; // pistas ya pagadas, por juego
  targetPicked: boolean; // true si el objetivo lo eligió el jugador
  revealedWords: Record<number, string[]>;
  hintsUsed: number;
  coins: number;
  coinsEarned: number;
  coinsSpent: number;
  startedAt: string;
  lastPlayedAt: string;
  playedMs: number; // tiempo jugado acumulado (solo con la partida abierta y visible)
  lastTick: number | null; // último latido recibido del navegador
  status: "playing" | "finished";
  finishedAt: string | null;
}

/** Hueco máximo entre latidos que se cuenta como tiempo jugado (si no, se considera pausa). */
const MAX_TICK_GAP_MS = 30_000;

function load(id: string): { username: string; state: SessionState } {
  const row = db.prepare("SELECT username, state FROM sessions WHERE id = ?").get(id) as
    | { username: string; state: string }
    | undefined;
  if (!row) throw new HttpError(404, "Partida no encontrada.");
  const state = JSON.parse(row.state) as SessionState;
  // Partidas creadas antes de existir las monedas: empiezan con lo ganado hasta ahora.
  state.coins ??= state.guessed.length * COINS_PER_PLATINUM;
  // Migración: de una sola lista de pistas a pistas guardadas por juego.
  if (!state.hintsByTarget) {
    state.hintsByTarget = {};
    if (state.hintTarget != null && state.hints?.length) state.hintsByTarget[state.hintTarget] = state.hints;
  }
  delete state.hints;
  state.targetPicked ??= false;
  // Migración: estadísticas de historial.
  state.coinsEarned ??= state.guessed.length * COINS_PER_PLATINUM;
  state.coinsSpent ??= Math.max(0, state.coinsEarned - state.coins);
  state.lastPlayedAt ??= state.startedAt;
  state.playedMs ??= 0;
  state.lastTick ??= null;
  state.status ??= "playing";
  state.finishedAt ??= null;
  return { username: row.username, state };
}

function save(id: string, state: SessionState) {
  db.prepare("UPDATE sessions SET state = ? WHERE id = ?").run(JSON.stringify(state), id);
}

export function createSession(username: string): string {
  const id = randomUUID();
  const state: SessionState = {
    guessed: [],
    errors: [],
    hintTarget: null,
    hintsByTarget: {},
    targetPicked: false,
    revealedWords: {},
    hintsUsed: 0,
    coins: 0,
    coinsEarned: 0,
    coinsSpent: 0,
    startedAt: new Date().toISOString(),
    lastPlayedAt: new Date().toISOString(),
    playedMs: 0,
    lastTick: null,
    status: "playing",
    finishedAt: null,
  };
  db.prepare("INSERT INTO sessions (id, username, created_at, state) VALUES (?, ?, ?, ?)").run(
    id,
    username.toLowerCase(),
    state.startedAt,
    JSON.stringify(state),
  );
  return id;
}

/** Estado público de la partida. Los juegos no adivinados NO incluyen su nombre ni icono. */
export function view(id: string) {
  const { username, state } = load(id);
  const profile = getProfile(username)!;
  const plats = getPlatinums(username);
  if (closeIfComplete(state, plats.length)) save(id, state);
  const guessed = new Set(state.guessed);

  const slots = plats.map((p, i) =>
    guessed.has(p.id)
      ? { position: i + 1, guessed: true as const, name: cleanTitle(p.name), iconUrl: p.cover ?? p.iconUrl, earnedAt: p.earnedAt, platform: p.platform }
      : { position: i + 1, guessed: false as const },
  );
  const targetPos = state.hintTarget != null ? plats.findIndex((p) => p.id === state.hintTarget) + 1 : 0;

  return {
    sessionId: id,
    profile: { onlineId: profile.online_id, avatarUrl: profile.avatar_url, fetchedAt: profile.fetched_at },
    total: plats.length,
    guessedCount: plats.filter((p) => guessed.has(p.id)).length,
    slots,
    errors: state.errors,
    hint:
      targetPos > 0
        ? { targetPosition: targetPos, picked: state.targetPicked, hints: state.hintsByTarget[state.hintTarget!] ?? [] }
        : null,
    hintsUsed: state.hintsUsed,
    coins: state.coins,
    hintCost: HINT_COST,
    startedAt: state.startedAt,
    stats: stats(state),
  };
}

function stats(state: SessionState) {
  return {
    playedMs: state.playedMs,
    coinsEarned: state.coinsEarned,
    coinsSpent: state.coinsSpent,
    hintsUsed: state.hintsUsed,
    errors: state.errors.length,
    status: state.status,
    startedAt: state.startedAt,
    lastPlayedAt: state.lastPlayedAt,
    finishedAt: state.finishedAt,
  };
}

/** Partidas completadas antes de existir el estado "finished": se cierran al leerlas. */
function closeIfComplete(state: SessionState, total: number): boolean {
  if (state.status === "finished" || total === 0 || state.guessed.length < total) return false;
  state.status = "finished";
  state.finishedAt = state.lastPlayedAt;
  state.lastTick = null;
  return true;
}

/** Partida sin ninguna jugada: no merece aparecer en el historial. */
function isEmpty(state: SessionState): boolean {
  return state.guessed.length === 0 && state.errors.length === 0 && state.hintsUsed === 0 && state.playedMs < 60_000;
}

function assertPlaying(state: SessionState) {
  if (state.status === "finished") throw new HttpError(400, "Esta partida ya ha terminado.");
}

/** Suma el tiempo desde el último latido (si no ha pasado demasiado) y marca la partida como jugada. */
function accrue(state: SessionState, now = Date.now()) {
  if (state.status !== "playing") return;
  if (state.lastTick != null) {
    const gap = now - state.lastTick;
    if (gap > 0 && gap <= MAX_TICK_GAP_MS) state.playedMs += gap;
  }
  state.lastTick = now;
  state.lastPlayedAt = new Date(now).toISOString();
}

/** Latido del navegador mientras la partida está abierta y visible. */
export function tick(id: string) {
  const { state } = load(id);
  accrue(state);
  save(id, state);
  return stats(state);
}

/** Pausa: cuenta el último tramo y corta el reloj hasta el siguiente latido. */
export function pause(id: string) {
  const { state } = load(id);
  accrue(state);
  state.lastTick = null;
  save(id, state);
  return stats(state);
}

/** Terminar la partida (manual o al adivinar todos). */
export function finish(id: string) {
  const { state } = load(id);
  finishState(state);
  save(id, state);
  return view(id);
}

function finishState(state: SessionState) {
  if (state.status === "finished") return;
  accrue(state);
  state.lastTick = null;
  state.status = "finished";
  state.finishedAt = new Date().toISOString();
}

export function remove(id: string) {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  return { ok: true };
}

/** Historial: resumen de todas las partidas, de la más reciente a la más antigua. */
export function list() {
  const rows = db.prepare("SELECT id, username, state FROM sessions").all() as { id: string; username: string; state: string }[];
  const totals = new Map(
    (db.prepare("SELECT username, COUNT(*) AS n FROM platinums GROUP BY username").all() as { username: string; n: number }[]).map(
      (r) => [r.username, r.n],
    ),
  );
  return rows
    .map((r) => {
      const { state } = load(r.id);
      const profile = getProfile(r.username);
      const total = totals.get(r.username) ?? 0;
      if (closeIfComplete(state, total)) save(r.id, state);
      if (isEmpty(state)) return null;
      return {
        sessionId: r.id,
        onlineId: profile?.online_id ?? r.username,
        avatarUrl: profile?.avatar_url ?? null,
        total,
        guessedCount: state.guessed.length,
        ...stats(state),
      };
    })
    .filter((s): s is NonNullable<typeof s> => s != null && s.total > 0)
    .sort((a, b) => b.lastPlayedAt.localeCompare(a.lastPlayedAt));
}

function matches(p: Platinum, igdbId: number, name: string): boolean {
  if (p.igdbId === igdbId) return true;
  // Respaldo por nombre: si el emparejamiento con IGDB falló o eligió una variante rara,
  // elegir el juego con el mismo nombre que en PSN también cuenta como acierto.
  const n = normalize(name);
  return normalize(p.name) === n || (p.igdbName != null && normalize(p.igdbName) === n);
}

export function guess(id: string, input: { igdbId: number; name: string; cover: string | null }) {
  const { username, state } = load(id);
  assertPlaying(state);
  accrue(state);
  const plats = getPlatinums(username);
  const hits = plats.filter((p) => matches(p, input.igdbId, input.name));

  let result: {
    status: "correct" | "already" | "wrong" | "repeated-error";
    count: number;
    positions: number[];
    coinsEarned: number;
  };

  if (hits.length > 0) {
    const fresh = hits.filter((p) => !state.guessed.includes(p.id));
    const positions = hits.map((p) => plats.indexOf(p) + 1);
    if (fresh.length === 0) {
      result = { status: "already", count: hits.length, positions, coinsEarned: 0 };
    } else {
      state.guessed.push(...fresh.map((p) => p.id));
      if (state.hintTarget != null && fresh.some((p) => p.id === state.hintTarget)) {
        state.hintTarget = null;
        state.targetPicked = false;
      }
      const coinsEarned = fresh.length * COINS_PER_PLATINUM;
      state.coins += coinsEarned;
      state.coinsEarned += coinsEarned;
      result = { status: "correct", count: fresh.length, positions, coinsEarned };
    }
  } else if (state.errors.some((e) => e.igdbId === input.igdbId)) {
    result = { status: "repeated-error", count: 0, positions: [], coinsEarned: 0 };
  } else {
    state.errors.unshift({ igdbId: input.igdbId, name: input.name, cover: input.cover });
    result = { status: "wrong", count: 0, positions: [], coinsEarned: 0 };
  }

  if (state.guessed.length >= plats.length) finishState(state);
  save(id, state);
  return { result, state: view(id) };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Elige el juego objetivo de las pistas pulsando su casilla (gratis).
 * position = 0 quita la selección: la siguiente pista será de un juego al azar.
 */
export function selectTarget(id: string, position: number) {
  const { username, state } = load(id);
  assertPlaying(state);
  if (position === 0) {
    state.hintTarget = null;
    state.targetPicked = false;
  } else {
    const p = getPlatinums(username)[position - 1];
    if (!p) throw new HttpError(400, "Casilla no válida.");
    if (state.guessed.includes(p.id)) throw new HttpError(400, "Ese juego ya está adivinado.");
    state.hintTarget = p.id;
    state.targetPicked = true;
  }
  save(id, state);
  return view(id);
}

export function hint(id: string, type: HintType | undefined, newTarget: boolean) {
  const { username, state } = load(id);
  assertPlaying(state);
  accrue(state);
  const plats = getPlatinums(username);
  const pending = plats.filter((p) => !state.guessed.includes(p.id));
  if (pending.length === 0) throw new HttpError(400, "¡Ya has adivinado todos los juegos!");

  let target = plats.find((p) => p.id === state.hintTarget && !state.guessed.includes(p.id));
  if (!target || newTarget) {
    const pool = pending.length > 1 && target ? pending.filter((p) => p.id !== target!.id) : pending;
    target = pool[Math.floor(Math.random() * pool.length)];
    state.hintTarget = target.id;
    state.targetPicked = false;
  }

  // "Cambiar de juego" sin pedir pista: solo cambia el objetivo.
  if (!type) {
    save(id, state);
    return view(id);
  }

  let text: string;
  let newWord: string | null = null;
  switch (type) {
    case "date":
      text = `Lo platinaste el ${formatDate(target.earnedAt)}`;
      break;
    case "year":
      text = target.year ? `Salió en ${target.year}` : "Año de salida desconocido";
      break;
    case "platforms":
      text = `Disponible en ${target.platforms.join(", ") || target.platform}`;
      break;
    case "word": {
      const revealed = (state.revealedWords[target.id] ??= []);
      const remaining = hintWords(target.name).filter((w) => !revealed.includes(w));
      if (remaining.length === 0) {
        throw new HttpError(400, "Ya se han revelado todas las palabras de este juego.");
      } else {
        newWord = remaining[Math.floor(Math.random() * remaining.length)];
        text = `Contiene la palabra «${newWord}»`;
      }
      break;
    }
    default:
      throw new HttpError(400, "Tipo de pista no válido.");
  }

  // Las pistas fijas (fecha, año, plataformas) no se duplican ni se cobran dos veces.
  const hints = (state.hintsByTarget[target.id] ??= []);
  if (!hints.some((h) => h.text === text)) {
    const cost = HINT_COST[type];
    if (state.coins < cost) {
      throw new HttpError(400, `Necesitas ${cost} moneda${cost > 1 ? "s" : ""} para esta pista y tienes ${state.coins}. Acierta platinos para ganar más.`);
    }
    state.coins -= cost;
    state.coinsSpent += cost;
    if (newWord) state.revealedWords[target.id].push(newWord);
    hints.push({ type, text });
    state.hintsUsed++;
  }

  save(id, state);
  return view(id);
}
