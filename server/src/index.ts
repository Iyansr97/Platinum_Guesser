import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import { HttpError } from "./psn.js";
import { searchGames } from "./igdb.js";
import { backfillCovers, loadProfile, type LoadStage } from "./profile.js";
import { randomUUID } from "node:crypto";
import * as game from "./game.js";

// Las credenciales se leen en tiempo de llamada, así que basta con cargarlas aquí.
try {
  process.loadEnvFile(resolve(dirname(fileURLToPath(import.meta.url)), "../../.env"));
} catch {
  console.warn("No se encontró el archivo .env (copia .env.example a .env).");
}

const app = Fastify({ logger: { level: "warn" } });

app.setErrorHandler((err, _req, reply) => {
  if (err instanceof HttpError) return reply.status(err.status).send({ error: err.message });
  console.error(err);
  return reply.status(500).send({ error: "Error inesperado en el servidor." });
});

// Carga de perfil como trabajo en segundo plano, para que la web pueda mostrar el progreso.
interface LoadJob {
  stage: LoadStage | "done" | "error";
  done: number;
  total: number;
  state?: ReturnType<typeof game.view>;
  error?: string;
  finishedAt?: number;
}
const jobs = new Map<string, LoadJob>();

app.post<{ Body: { username: string; refresh?: boolean } }>("/api/profile/load", async (req) => {
  const username = req.body?.username?.trim();
  if (!username) throw new HttpError(400, "Introduce un usuario de PSN.");

  const jobId = randomUUID();
  const job: LoadJob = { stage: "profile", done: 0, total: 1 };
  jobs.set(jobId, job);

  loadProfile(username, !!req.body.refresh, (stage, done, total) => Object.assign(job, { stage, done, total }))
    .then((profile) => {
      job.state = game.view(game.createSession(profile.username));
      job.stage = "done";
    })
    .catch((err) => {
      if (!(err instanceof HttpError)) console.error(err);
      job.error = err instanceof HttpError ? err.message : "Error inesperado al cargar el perfil.";
      job.stage = "error";
    })
    .finally(() => (job.finishedAt = Date.now()));

  return { jobId };
});

app.get<{ Params: { id: string } }>("/api/profile/job/:id", async (req) => {
  const job = jobs.get(req.params.id);
  if (!job) throw new HttpError(404, "Carga no encontrada.");
  // Limpia trabajos terminados hace más de 5 minutos.
  for (const [id, j] of jobs) if (j.finishedAt && Date.now() - j.finishedAt > 300_000) jobs.delete(id);
  return job;
});

app.get<{ Params: { id: string } }>("/api/game/:id", async (req) => game.view(req.params.id));

app.post<{ Params: { id: string }; Body: { igdbId: number; name: string; cover: string | null } }>(
  "/api/game/:id/guess",
  async (req) => {
    const { igdbId, name, cover } = req.body ?? ({} as any);
    if (typeof igdbId !== "number" || !name) throw new HttpError(400, "Juego no válido.");
    return game.guess(req.params.id, { igdbId, name, cover: cover ?? null });
  },
);

app.post<{ Params: { id: string }; Body: { type?: game.HintType; newTarget?: boolean } }>(
  "/api/game/:id/hint",
  async (req) => game.hint(req.params.id, req.body?.type, !!req.body?.newTarget),
);

app.post<{ Params: { id: string }; Body: { position: number } }>("/api/game/:id/target", async (req) => {
  const position = Number(req.body?.position);
  if (!Number.isInteger(position) || position < 0) throw new HttpError(400, "Casilla no válida.");
  return game.selectTarget(req.params.id, position);
});

app.get("/api/sessions", async () => game.list());
app.post<{ Params: { id: string } }>("/api/game/:id/tick", async (req) => game.tick(req.params.id));
app.post<{ Params: { id: string } }>("/api/game/:id/pause", async (req) => game.pause(req.params.id));
app.post<{ Params: { id: string } }>("/api/game/:id/finish", async (req) => game.finish(req.params.id));
app.delete<{ Params: { id: string } }>("/api/game/:id", async (req) => game.remove(req.params.id));

app.get<{ Querystring: { q?: string } }>("/api/search", async (req) => {
  const games = await searchGames(req.query.q ?? "", 10);
  return games.map(({ alternativeNames, ...g }) => g);
});

const port = Number(process.env.PORT ?? 3001);
await app.listen({ port, host: "127.0.0.1" });
console.log(`Servidor escuchando en http://localhost:${port}`);

backfillCovers().catch((e) => console.warn("[igdb] no se pudieron rellenar portadas:", (e as Error).message));
