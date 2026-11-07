import { db } from "./db.js";
import { fetchCovers, searchGames, PLATFORMS } from "./igdb.js";
import { fetchPlatinums, findProfile, HttpError } from "./psn.js";
import { normalize, searchVariants, similarity } from "./text.js";

/** Umbral mínimo de similitud para aceptar un emparejamiento PSN -> IGDB. */
const MIN_SCORE = 0.6;

export interface Platinum {
  id: number;
  npId: string;
  name: string;
  iconUrl: string;
  platform: string;
  earnedAt: string;
  igdbId: number | null;
  igdbName: string | null;
  cover: string | null;
  year: number | null;
  platforms: string[];
}

export interface ProfileRow {
  username: string;
  online_id: string;
  account_id: string;
  avatar_url: string | null;
  fetched_at: string;
}

export function getProfile(username: string): ProfileRow | undefined {
  return db.prepare("SELECT * FROM profiles WHERE username = ?").get(username.toLowerCase()) as ProfileRow | undefined;
}

export function getPlatinums(username: string): Platinum[] {
  const rows = db
    .prepare(
      `SELECT p.*, m.igdb_id, m.igdb_name, m.year, m.cover, m.platforms AS igdb_platforms
       FROM platinums p LEFT JOIN igdb_matches m ON m.np_id = p.np_id
       WHERE p.username = ? ORDER BY p.earned_at ASC, p.id ASC`,
    )
    .all(username.toLowerCase()) as Record<string, any>[];
  return rows.map((r) => ({
    id: r.id,
    npId: r.np_id,
    name: r.name,
    iconUrl: r.icon_url,
    platform: r.platform,
    earnedAt: r.earned_at,
    igdbId: r.igdb_id ?? null,
    igdbName: r.igdb_name ?? null,
    cover: r.cover ?? null,
    year: r.year ?? null,
    platforms: r.igdb_platforms ? JSON.parse(r.igdb_platforms) : psnPlatforms(r.platform),
  }));
}

/** "PS3,PSVITA" -> ["PS3", "PS Vita"] */
export function psnPlatforms(p: string): string[] {
  return p.split(",").map((x) => (x.trim().toUpperCase() === "PSVITA" ? "PS Vita" : x.trim()));
}

export async function matchWithIgdb(npId: string, psnName: string, psnPlatform: string): Promise<void> {
  // Los ya emparejados no se repiten; los que fallaron se reintentan en cada carga.
  const existing = db.prepare("SELECT 1 FROM igdb_matches WHERE np_id = ? AND igdb_id IS NOT NULL").get(npId);
  if (existing) return;

  const variants = searchVariants(psnName);
  const targets = variants.map(normalize);
  let best: { id: number; name: string; cover: string | null; year: number | null; platforms: string[]; score: number } | null = null;

  try {
    for (const query of variants) {
      for (const g of await searchGames(query, 15)) {
        const names = [g.name, ...g.alternativeNames].map(normalize);
        let score = Math.max(...names.flatMap((n) => targets.map((t) => similarity(t, n))));
        // Pequeño bonus si la plataforma del platino coincide con las del juego.
        if (psnPlatforms(psnPlatform).some((p) => g.platforms.includes(p))) score += 0.02;
        if (!best || score > best.score) best = { id: g.igdbId, name: g.name, cover: g.cover, year: g.year, platforms: g.platforms, score };
      }
      // Solo paramos si hay coincidencia (casi) exacta; un 85 % puede ser una variante
      // como "Rainbow Six Siege: North Star" en lugar del juego principal.
      if (best && best.score >= 0.97) break;
    }
  } catch (e) {
    console.warn(`[igdb] fallo emparejando "${psnName}":`, (e as Error).message);
    return; // se reintentará en la próxima carga
  }

  const ok = best && best.score >= MIN_SCORE;
  if (!ok) console.warn(`[igdb] sin coincidencia fiable para "${psnName}" (mejor: ${best?.name} ${best?.score.toFixed(2)})`);
  db.prepare(
    "INSERT OR REPLACE INTO igdb_matches (np_id, igdb_id, igdb_name, year, platforms, score, cover) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    npId,
    ok ? best!.id : null,
    ok ? best!.name : null,
    ok ? best!.year : null,
    JSON.stringify(ok ? best!.platforms : psnPlatforms(psnPlatform)),
    best?.score ?? 0,
    ok ? best!.cover : null,
  );
}

/**
 * Carga (o recarga) los platinos de un usuario desde PSN y los empareja con IGDB.
 * Si ya están en caché y no se pide refresh, no llama a PSN.
 */
export type LoadStage = "profile" | "dates" | "igdb";
export type ProgressFn = (stage: LoadStage, done: number, total: number) => void;

export async function loadProfile(username: string, refresh: boolean, onProgress: ProgressFn = () => {}): Promise<ProfileRow> {
  const key = username.trim().toLowerCase();
  const cached = getProfile(key);
  if (cached && !refresh) return cached;

  onProgress("profile", 0, 1);
  const profile = await findProfile(username.trim());
  const plats = await fetchPlatinums(profile.accountId, (d, t) => onProgress("dates", d, t));
  if (plats.length === 0) {
    throw new HttpError(
      404,
      `${profile.onlineId} no tiene ningún platino visible. Si tiene trofeos en privado, hazlos públicos en la configuración de privacidad de PSN.`,
    );
  }

  const upsert = db.prepare(
    `INSERT INTO platinums (username, np_id, name, icon_url, platform, earned_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (username, np_id) DO UPDATE SET name = excluded.name, icon_url = excluded.icon_url,
       platform = excluded.platform, earned_at = excluded.earned_at`,
  );
  for (const p of plats) upsert.run(key, p.npId, p.name, p.iconUrl, p.platform, p.earnedAt);

  for (const [i, p] of plats.entries()) {
    onProgress("igdb", i, plats.length);
    await matchWithIgdb(p.npId, p.name, p.platform);
  }
  onProgress("igdb", plats.length, plats.length);

  db.prepare(
    `INSERT OR REPLACE INTO profiles (username, online_id, account_id, avatar_url, fetched_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(key, profile.onlineId, profile.accountId, profile.avatarUrl, new Date().toISOString());

  console.log(`[perfil] ${profile.onlineId}: ${plats.length} platinos cargados`);
  return getProfile(key)!;
}

export { PLATFORMS };

/** Rellena las portadas de emparejamientos antiguos que no las tienen. */
export async function backfillCovers(): Promise<void> {
  const rows = db.prepare("SELECT DISTINCT igdb_id FROM igdb_matches WHERE igdb_id IS NOT NULL AND cover IS NULL").all() as {
    igdb_id: number;
  }[];
  if (rows.length === 0) return;
  const covers = await fetchCovers(rows.map((r) => r.igdb_id));
  const upd = db.prepare("UPDATE igdb_matches SET cover = ? WHERE igdb_id = ?");
  for (const [id, url] of covers) upd.run(url, id);
  console.log(`[igdb] portadas rellenadas: ${covers.size}/${rows.length}`);
}
