import { useEffect, useState } from "react";
import { api, formatClock, formatDuration, type GameState, type HintType, type SearchResult } from "../api";
import ProgressPanel from "./ProgressPanel";
import SearchBox from "./SearchBox";
import HintPanel from "./HintPanel";
import ErrorList from "./ErrorList";
import { BackgroundShapes, Circle, Coin, Cross, PlatinumTrophy, Triangle } from "./Icons";

interface Feedback {
  kind: "ok" | "bad" | "info";
  text: string;
  cover?: string | null;
}

export default function GameScreen({ initial, onExit }: { initial: GameState; onExit: () => void }) {
  const [game, setGame] = useState(initial);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [panelOpen, setPanelOpen] = useState(true);
  const [busy, setBusy] = useState(false);

  const finished = game.stats.status === "finished";
  const complete = game.total > 0 && game.guessedCount === game.total;
  const playedMs = usePlayClock(game.sessionId, initial.stats.playedMs, finished);

  const exit = async () => {
    if (!finished) await api.pause(game.sessionId).catch(() => {});
    onExit();
  };

  const endGame = async () => {
    if (!confirm("¿Terminar la partida? Ya no podrás seguir adivinando en ella.")) return;
    try {
      setGame(await api.finish(game.sessionId));
      setFeedback(null);
    } catch (e) {
      setFeedback({ kind: "bad", text: (e as Error).message });
    }
  };

  const onSelect = async (g: SearchResult) => {
    setBusy(true);
    try {
      const { result, state } = await api.guess(game.sessionId, g);
      setGame(state);
      const nums = result.positions.map((p) => `#${p}`).join(", ");
      switch (result.status) {
        case "correct":
          setRevealed(result.positions);
          setFeedback({
            kind: "ok",
            cover: g.cover,
            text:
              (result.count > 1 ? `¡${g.name}! ${result.count} platinos (${nums})` : `¡${g.name}! Platino ${nums}`) +
              ` · +${result.coinsEarned} moneda${result.coinsEarned > 1 ? "s" : ""}`,
          });
          break;
        case "already":
          setFeedback({ kind: "info", cover: g.cover, text: `${g.name} ya estaba adivinado (${nums})` });
          break;
        case "repeated-error":
          setFeedback({ kind: "info", cover: g.cover, text: `Ya probaste ${g.name} y no tienes su platino` });
          break;
        case "wrong":
          setFeedback({ kind: "bad", cover: g.cover, text: `No tienes el platino de ${g.name}` });
          break;
      }
    } catch (e) {
      setFeedback({ kind: "bad", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const onPick = async (position: number) => {
    try {
      setGame(await api.selectTarget(game.sessionId, position));
    } catch (e) {
      setFeedback({ kind: "bad", text: (e as Error).message });
    }
  };

  const onHint = async (type: HintType | undefined, newTarget = false) => {
    try {
      setGame(await api.hint(game.sessionId, type, newTarget));
    } catch (e) {
      setFeedback({ kind: "bad", text: (e as Error).message });
    }
  };

  return (
    <div className={`game ${panelOpen ? "panel-open" : ""}`}>
      <ProgressPanel
        game={game}
        open={panelOpen}
        onToggle={() => setPanelOpen((o) => !o)}
        revealed={revealed}
        onPick={onPick}
      />

      <main className="play">
        <BackgroundShapes />
        <header className="topbar">
          <div className="brand">
            <PlatinumTrophy size={28} />
            <span>Platinum Guesser</span>
          </div>
          <div className="who">
            {game.profile.avatarUrl && <img src={game.profile.avatarUrl} alt="" />}
            <span className="clock" title="Tiempo jugado (se para al salir o cambiar de pestaña)">
              <ClockIcon />
              {formatClock(finished ? game.stats.playedMs : playedMs)}
            </span>
            <span className="coins" title="Monedas">
              <Coin size={20} />
              {game.coins}
            </span>
            <span>{game.profile.onlineId}</span>
            {!finished && (
              <button className="ghost small" onClick={endGame} title="Cerrar la partida definitivamente">
                Terminar
              </button>
            )}
            <button className="ghost small" onClick={exit} title={finished ? "Volver al menú" : "Pausar y volver al menú"}>
              {finished ? "Menú" : "Salir"}
            </button>
          </div>
        </header>

        <section className="center">
          {finished ? (
            <Summary game={game} complete={complete} onMenu={onExit} />
          ) : (
            <>
              <h2 className="prompt">¿Qué juegos has platinado?</h2>
              <SearchBox onSelect={onSelect} disabled={busy} />
            </>
          )}

          {feedback && (
            <div key={feedback.text} className={`feedback ${feedback.kind}`}>
              <span className="fb-icon">
                {feedback.kind === "ok" ? <Circle size={20} /> : feedback.kind === "bad" ? <Cross size={20} /> : <Triangle size={20} />}
              </span>
              {feedback.cover && <img src={feedback.cover} alt="" />}
              <span>{feedback.text}</span>
            </div>
          )}

          {!finished && <HintPanel hint={game.hint} hintsUsed={game.hintsUsed} coins={game.coins} hintCost={game.hintCost} onHint={onHint} onClearTarget={() => onPick(0)} />}
          <ErrorList errors={game.errors} />
        </section>
      </main>
    </div>
  );
}

/** Resumen final de la partida. */
function Summary({ game, complete, onMenu }: { game: GameState; complete: boolean; onMenu: () => void }) {
  const st = game.stats;
  const pct = game.total ? Math.round((game.guessedCount / game.total) * 100) : 0;
  const items: [string, string][] = [
    ["Adivinados", `${game.guessedCount}/${game.total}`],
    ["Porcentaje", `${pct}%`],
    ["Tiempo jugado", formatDuration(st.playedMs)],
    ["Pistas usadas", String(st.hintsUsed)],
    ["Monedas gastadas", `${st.coinsSpent} de ${st.coinsEarned}`],
    ["Errores", String(st.errors)],
  ];
  return (
    <div className="card summary">
      <PlatinumTrophy size={88} className="trophy-glow" />
      <h2>{complete ? "¡Los has recordado todos!" : "Partida terminada"}</h2>
      <dl>
        {items.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <button className="primary" onClick={onMenu}>
        Volver al menú principal
      </button>
    </div>
  );
}

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" />
    <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

/**
 * Reloj de juego: envía un latido cada 10 s mientras la pestaña está visible y pausa
 * al ocultarla, salir o cerrar. El servidor solo suma tiempo entre latidos seguidos.
 */
function usePlayClock(sessionId: string, initialMs: number, finished: boolean): number {
  const [clock, setClock] = useState({ base: initialMs, at: Date.now(), running: false });
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (finished) return;
    let alive = true;
    const sync = () =>
      api
        .tick(sessionId)
        .then((st) => alive && setClock({ base: st.playedMs, at: Date.now(), running: true }))
        .catch(() => {});
    const stop = () => {
      setClock((c) => ({ base: c.running ? c.base + (Date.now() - c.at) : c.base, at: Date.now(), running: false }));
      api.pause(sessionId).catch(() => {});
    };
    const onVisibility = () => (document.visibilityState === "visible" ? sync() : stop());
    const onHide = () => api.pauseBeacon(sessionId);

    if (document.visibilityState === "visible") sync();
    const beat = setInterval(() => document.visibilityState === "visible" && sync(), 10_000);
    const second = setInterval(() => setNow(Date.now()), 1000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    return () => {
      alive = false;
      clearInterval(beat);
      clearInterval(second);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      api.pause(sessionId).catch(() => {});
    };
  }, [sessionId, finished]);

  return clock.running ? clock.base + Math.max(0, now - clock.at) : clock.base;
}
