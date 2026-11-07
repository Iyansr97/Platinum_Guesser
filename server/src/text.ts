// Utilidades de texto: normalización de nombres, similitud y palabras para pistas.

const PLATFORM_SUFFIX = /\b(ps ?3|ps ?4|ps ?5|ps ?vita|vita|trophies|trophy set)\b/g;

/** Normaliza un nombre de juego para poder compararlo entre PSN e IGDB. */
export function normalize(name: string): string {
  return cleanTitle(name)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(PLATFORM_SUFFIX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nombre "bonito" para mostrar: sin símbolos de marca ni sufijos de plataforma. */
export function cleanTitle(name: string): string {
  return name
    .replace(/[™®©]/g, "")
    .replace(/\s*[\(\[]?\b(PS ?3|PS ?4|PS ?5|PS ?Vita)( ?(&|\/|and) ?(PS ?3|PS ?4|PS ?5|PS ?Vita))*\b[\)\]]?\s*$/i, "")
    .replace(/\s+trophies$/i, "")
    .replace(/\s*\((GER|EU|US|UK|JP|ASIA|EN|FR|ES|IT|DE)\)\s*$/i, "")
    .replace(/\s*[:\-–—]?\s*PlayStation\s*®?\s*\d?\s*Edition$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Variantes de búsqueda para IGDB, de más a menos exacta:
 * nombre limpio, sin coletillas de edición/pack y solo la parte antes de ":" o " - ".
 */
export function searchVariants(name: string): string[] {
  const clean = cleanTitle(name);
  const noEdition = clean
    .replace(/\s*[:\-–—]?\s*(Game of the Year|GOTY|Complete|Definitive|Deluxe|Ultimate|Gold|Remastered)?\s*Edition$/i, "")
    .replace(/\s*[:\-–—]?\s*(Trilogy|Bundle|Collection)?\s*Pack$/i, "")
    .replace(/\s+Unite$/i, "")
    .trim();
  const beforeSep = noEdition.split(/\s*(?::|\s[-–—]\s)\s*/)[0].trim();
  return [...new Set([clean, noEdition, beforeSep].filter((s) => s.length >= 2))];
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  const t = s.replace(/ /g, "");
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** Coeficiente de Dice sobre bigramas (0..1) entre dos nombres ya normalizados. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  for (const [g, n] of A) inter += Math.min(n, B.get(g) ?? 0);
  const total = [...A.values()].reduce((x, y) => x + y, 0) + [...B.values()].reduce((x, y) => x + y, 0);
  return (2 * inter) / total;
}

const STOPWORDS = new Set([
  "the", "of", "a", "an", "and", "in", "on", "to", "for", "at", "by", "with",
  "de", "del", "la", "el", "los", "las", "y", "en",
  "edition", "game", "goty", "year", "complete", "definitive", "deluxe",
]);

/** Palabras significativas del nombre, para la pista de "una palabra". */
export function hintWords(name: string): string[] {
  const words = cleanTitle(name)
    .split(/[\s:\-–—,.!?/()]+/)
    .map((w) => w.replace(/^['"]+|['"]+$/g, ""))
    .filter((w) => /[\p{L}\p{N}]/u.test(w) && !STOPWORDS.has(w.toLowerCase()));
  return [...new Set(words)];
}
