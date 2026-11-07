export type HintType = "date" | "word" | "platforms" | "year";

export type Slot =
  | { position: number; guessed: false }
  | { position: number; guessed: true; name: string; iconUrl: string; earnedAt: string; platform: string };

export interface GameState {
  sessionId: string;
  profile: { onlineId: string; avatarUrl: string | null; fetchedAt: string };
  total: number;
  guessedCount: number;
  slots: Slot[];
  errors: { igdbId: number; name: string; cover: string | null }[];
  hint: { targetPosition: number; picked: boolean; hints: { type: HintType; text: string }[] } | null;
  hintsUsed: number;
  coins: number;
  hintCost: Record<HintType, number>;
  startedAt: string;
  stats: GameStats;
}

export interface GameStats {
  playedMs: number;
  coinsEarned: number;
  coinsSpent: number;
  hintsUsed: number;
  errors: number;
  status: "playing" | "finished";
  startedAt: string;
  lastPlayedAt: string;
  finishedAt: string | null;
}

export interface SessionSummary extends GameStats {
  sessionId: string;
  onlineId: string;
  avatarUrl: string | null;
  total: number;
  guessedCount: number;
}

export interface LoadProgress {
  stage: "profile" | "dates" | "igdb" | "done" | "error";
  done: number;
  total: number;
}

/** Porcentaje global aproximado: perfil 0-5 %, fechas 5-55 %, IGDB 55-100 %. */
export function loadPercent(p: LoadProgress): number {
  const f = p.total ? p.done / p.total : 0;
  if (p.stage === "profile") return 2;
  if (p.stage === "dates") return 5 + f * 50;
  if (p.stage === "igdb") return 55 + f * 45;
  return 100;
}

export interface SearchResult {
  igdbId: number;
  name: string;
  cover: string | null;
  year: number | null;
  platforms: string[];
}

export interface GuessResult {
  status: "correct" | "already" | "wrong" | "repeated-error";
  count: number;
  positions: number[];
  coinsEarned: number;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
  return data as T;
}

export const api = {
  /** Inicia la carga y va informando del progreso hasta tener la partida creada. */
  loadProfile: async (username: string, refresh: boolean, onProgress: (p: LoadProgress) => void) => {
    const { jobId } = await request<{ jobId: string }>("/api/profile/load", {
      method: "POST",
      body: JSON.stringify({ username, refresh }),
    });
    for (;;) {
      const job = await request<LoadProgress & { state?: GameState; error?: string }>(`/api/profile/job/${jobId}`);
      if (job.stage === "error") throw new Error(job.error);
      if (job.stage === "done" && job.state) return job.state;
      onProgress(job);
      await new Promise((r) => setTimeout(r, 400));
    }
  },
  getGame: (id: string) => request<GameState>(`/api/game/${id}`),
  guess: (id: string, g: SearchResult) =>
    request<{ result: GuessResult; state: GameState }>(`/api/game/${id}/guess`, {
      method: "POST",
      body: JSON.stringify({ igdbId: g.igdbId, name: g.name, cover: g.cover }),
    }),
  hint: (id: string, type: HintType | undefined, newTarget = false) =>
    request<GameState>(`/api/game/${id}/hint`, { method: "POST", body: JSON.stringify({ type, newTarget }) }),
  listSessions: () => request<SessionSummary[]>("/api/sessions"),
  tick: (id: string) => request<GameStats>(`/api/game/${id}/tick`, { method: "POST" }),
  pause: (id: string) => request<GameStats>(`/api/game/${id}/pause`, { method: "POST" }),
  /** Pausa fiable al cerrar la pestaña. */
  pauseBeacon: (id: string) => navigator.sendBeacon?.(`/api/game/${id}/pause`),
  finish: (id: string) => request<GameState>(`/api/game/${id}/finish`, { method: "POST" }),
  deleteSession: (id: string) => request<{ ok: boolean }>(`/api/game/${id}`, { method: "DELETE" }),
  selectTarget: (id: string, position: number) =>
    request<GameState>(`/api/game/${id}/target`, { method: "POST", body: JSON.stringify({ position }) }),
  search: (q: string, signal?: AbortSignal) =>
    request<SearchResult[]>(`/api/search?q=${encodeURIComponent(q)}`, { signal }),
};


export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });

/** 3725000 -> "1 h 02 min" · 125000 -> "2 min 05 s" */
export function formatDuration(ms: number): string {
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m > 0) return `${m} min ${String(sec).padStart(2, "0")} s`;
  return `${sec} s`;
}

/** Reloj de partida: 754000 -> "12:34", 3725000 -> "1:02:05" */
export function formatClock(ms: number): string {
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
