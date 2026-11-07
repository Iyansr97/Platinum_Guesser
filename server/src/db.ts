import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
mkdirSync(resolve(root, "data"), { recursive: true });

export const db = new DatabaseSync(resolve(root, "data/platino.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    username    TEXT PRIMARY KEY,   -- en minúsculas
    online_id   TEXT NOT NULL,
    account_id  TEXT NOT NULL,
    avatar_url  TEXT,
    fetched_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS platinums (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT NOT NULL,
    np_id       TEXT NOT NULL,
    name        TEXT NOT NULL,
    icon_url    TEXT NOT NULL,
    platform    TEXT NOT NULL,
    earned_at   TEXT NOT NULL,
    UNIQUE (username, np_id)
  );

  -- Emparejamiento PSN (npCommunicationId) -> IGDB, compartido entre perfiles.
  CREATE TABLE IF NOT EXISTS igdb_matches (
    np_id       TEXT PRIMARY KEY,
    igdb_id     INTEGER,            -- NULL si no se encontró coincidencia fiable
    igdb_name   TEXT,
    year        INTEGER,
    platforms   TEXT NOT NULL,      -- JSON: ["PS4","PS5"]
    score       REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    username    TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    state       TEXT NOT NULL       -- JSON con el estado de la partida
  );
`);

// Migración: portada IGDB (más ligera que el icono de PSN).
try {
  db.exec("ALTER TABLE igdb_matches ADD COLUMN cover TEXT");
} catch {}
