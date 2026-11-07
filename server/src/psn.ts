import {
  exchangeAccessCodeForAuthTokens,
  exchangeNpssoForAccessCode,
  exchangeRefreshTokenForAuthTokens,
  getProfileFromUserName,
  getUserTitles,
  getUserTrophiesEarnedForTitle,
  type AuthTokensResponse,
  type TrophyTitle,
} from "psn-api";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

let tokens: (AuthTokensResponse & { obtainedAt: number }) | null = null;

async function auth(): Promise<{ accessToken: string }> {
  const now = Date.now();
  if (tokens && now < tokens.obtainedAt + (tokens.expiresIn - 60) * 1000) return tokens;

  if (tokens && now < tokens.obtainedAt + (tokens.refreshTokenExpiresIn - 60) * 1000) {
    tokens = { ...(await exchangeRefreshTokenForAuthTokens(tokens.refreshToken)), obtainedAt: now };
    return tokens;
  }

  const npsso = readNpsso();
  if (!npsso) throw new HttpError(500, "Falta PSN_NPSSO en el archivo .env del servidor.");
  try {
    const code = await exchangeNpssoForAccessCode(npsso);
    tokens = { ...(await exchangeAccessCodeForAuthTokens(code)), obtainedAt: now };
  } catch {
    throw new HttpError(
      500,
      "PSN ha rechazado el token NPSSO (caduca al cerrar o reiniciar sesión en playstation.com). Consigue uno nuevo y pégalo en el .env.",
    );
  }
  return tokens;
}

/** Lee el NPSSO del .env en cada autenticación, para poder renovarlo sin reiniciar el servidor. */
function readNpsso(): string | undefined {
  try {
    const file = resolve(dirname(fileURLToPath(import.meta.url)), "../../.env");
    const value = parseEnv(readFileSync(file, "utf8")).PSN_NPSSO?.trim();
    if (value) return value;
  } catch {}
  return process.env.PSN_NPSSO;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface PsnProfile {
  onlineId: string;
  accountId: string;
  avatarUrl: string | null;
}

export async function findProfile(username: string): Promise<PsnProfile> {
  const a = await auth();
  try {
    const { profile } = await getProfileFromUserName(a, username);
    const avatar = profile.avatarUrls?.[profile.avatarUrls.length - 1]?.avatarUrl ?? null;
    return { onlineId: profile.onlineId, accountId: profile.accountId, avatarUrl: avatar };
  } catch {
    throw new HttpError(404, `No se encontró el usuario de PSN "${username}".`);
  }
}

export interface PsnPlatinum {
  npId: string;
  name: string;
  iconUrl: string;
  platform: string;
  earnedAt: string;
}

async function allTitles(accountId: string): Promise<TrophyTitle[]> {
  const out: TrophyTitle[] = [];
  let offset = 0;
  for (;;) {
    const res = await getUserTitles(await auth(), accountId, { limit: 800, offset });
    out.push(...res.trophyTitles);
    if (res.nextOffset == null || res.trophyTitles.length === 0) break;
    offset = res.nextOffset;
  }
  return out;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

/** Devuelve todos los platinos del usuario con la fecha exacta en que se consiguieron. */
export async function fetchPlatinums(
  accountId: string,
  onProgress: (done: number, total: number) => void = () => {},
): Promise<PsnPlatinum[]> {
  let titles: TrophyTitle[];
  try {
    titles = await allTitles(accountId);
  } catch {
    throw new HttpError(403, "No se pudieron leer los trofeos. ¿El perfil tiene los trofeos en privado?");
  }
  const withPlat = titles.filter((t) => t.earnedTrophies.platinum > 0);
  let done = 0;
  onProgress(0, withPlat.length);

  const results = await mapLimit(withPlat, 4, async (t): Promise<PsnPlatinum> => {
    let earnedAt = t.lastUpdatedDateTime;
    try {
      const res = await getUserTrophiesEarnedForTitle(await auth(), accountId, t.npCommunicationId, "default", {
        npServiceName: t.npServiceName,
      });
      const plat = res.trophies.find((tr) => tr.trophyType === "platinum" && tr.earned);
      if (plat?.earnedDateTime) earnedAt = plat.earnedDateTime;
    } catch {
      // Si falla, usamos la última actualización del título como aproximación.
    }
    onProgress(++done, withPlat.length);
    return {
      npId: t.npCommunicationId,
      name: t.trophyTitleName,
      iconUrl: t.trophyTitleIconUrl,
      platform: t.trophyTitlePlatform,
      earnedAt,
    };
  });

  return results.sort((a, b) => a.earnedAt.localeCompare(b.earnedAt));
}
