import { HttpError } from "./psn.js";

/** Plataformas con trofeos: PS3, PS4, PS5 y PS Vita. */
export const PLATFORMS: Record<number, string> = { 9: "PS3", 48: "PS4", 167: "PS5", 46: "PS Vita" };
// Excluye ediciones (version_parent) y tipos que no pueden tener platino propio:
// 1 DLC, 2 expansión, 3 bundle, 5 mod, 13 pack, 14 actualización.
const PLATFORM_FILTER =
  `platforms = (${Object.keys(PLATFORMS).join(",")}) & version_parent = null & game_type != (1,2,3,5,13,14)`;

let token: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (token && Date.now() < token.expiresAt) return token.value;
  const id = process.env.IGDB_CLIENT_ID;
  const secret = process.env.IGDB_CLIENT_SECRET;
  if (!id || !secret) throw new HttpError(500, "Faltan IGDB_CLIENT_ID / IGDB_CLIENT_SECRET en el .env del servidor.");
  const url = `https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secret}&grant_type=client_credentials`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) throw new HttpError(500, "No se pudo autenticar en IGDB. Revisa las credenciales.");
  const json = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: json.access_token, expiresAt: Date.now() + (json.expires_in - 120) * 1000 };
  return token.value;
}

// IGDB permite 4 peticiones/segundo: las encolamos con un pequeño intervalo.
let queue: Promise<unknown> = Promise.resolve();
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => new Promise((r) => setTimeout(r, 260)),
    () => new Promise((r) => setTimeout(r, 260)),
  );
  return run;
}

async function query<T>(endpoint: string, body: string): Promise<T> {
  return throttled(async () => {
    const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: "POST",
      headers: {
        "Client-ID": process.env.IGDB_CLIENT_ID ?? "",
        Authorization: `Bearer ${await getToken()}`,
        "Content-Type": "text/plain",
      },
      body,
    });
    if (!res.ok) throw new HttpError(502, `Error de IGDB (${res.status}).`);
    return (await res.json()) as T;
  });
}

interface RawGame {
  id: number;
  name: string;
  cover?: { image_id: string };
  first_release_date?: number;
  platforms?: number[];
  alternative_names?: { name: string }[];
}

export interface IgdbGame {
  igdbId: number;
  name: string;
  cover: string | null;
  year: number | null;
  platforms: string[];
  alternativeNames: string[];
}

function toGame(g: RawGame): IgdbGame {
  return {
    igdbId: g.id,
    name: g.name,
    cover: g.cover ? `https://images.igdb.com/igdb/image/upload/t_cover_small/${g.cover.image_id}.jpg` : null,
    year: g.first_release_date ? new Date(g.first_release_date * 1000).getUTCFullYear() : null,
    platforms: (g.platforms ?? []).filter((p) => p in PLATFORMS).map((p) => PLATFORMS[p]),
    alternativeNames: (g.alternative_names ?? []).map((a) => a.name),
  };
}

const cache = new Map<string, IgdbGame[]>();

export async function searchGames(text: string, limit = 10): Promise<IgdbGame[]> {
  // IGDB no reconoce bien los apóstrofos/comillas tipográficos ni los símbolos de marca.
  const q = text
    .trim()
    .replace(/[’‘`´]/g, "'")
    .replace(/[™®©]/g, "")
    .replace(/["“”]/g, "");
  if (q.length < 2) return [];
  const key = `${q.toLowerCase()}|${limit}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const raw = await query<RawGame[]>(
    "games",
    `search "${q}"; fields name,cover.image_id,first_release_date,platforms,alternative_names.name; where ${PLATFORM_FILTER}; limit ${limit};`,
  );
  const games = raw.map(toGame);
  if (cache.size > 2000) cache.clear();
  cache.set(key, games);
  return games;
}

/** Portadas (t_cover_small) de varios juegos a la vez, en tandas de 500. */
export async function fetchCovers(ids: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const raw = await query<RawGame[]>("games", `fields cover.image_id; where id = (${chunk.join(",")}); limit 500;`);
    for (const g of raw) {
      const c = toGame(g).cover;
      if (c) out.set(g.id, c);
    }
  }
  return out;
}
