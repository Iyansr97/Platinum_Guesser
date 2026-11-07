import { formatDate, formatDuration, type SessionSummary } from "../api";
import { Coin, PlatinumTrophy } from "./Icons";

interface Props {
  history: SessionSummary[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function HistoryList({ history, onOpen, onDelete }: Props) {
  if (history.length === 0) return null;

  return (
    <section className="history">
      <h2>Historial de partidas</h2>
      <ul>
        {history.map((s) => {
          const pct = s.total ? Math.round((s.guessedCount / s.total) * 100) : 0;
          const finished = s.status === "finished";
          const complete = s.guessedCount >= s.total;
          return (
            <li key={s.sessionId} className={`history-item ${finished ? "finished" : ""}`}>
              <div className="h-top">
                <div className="h-who">
                  {s.avatarUrl ? <img src={s.avatarUrl} alt="" /> : <PlatinumTrophy size={32} />}
                  <div>
                    <strong>{s.onlineId}</strong>
                    <span className="muted small">
                      {finished ? `Terminada el ${formatDate(s.finishedAt!)}` : `Última vez: ${formatDate(s.lastPlayedAt)}`}
                    </span>
                  </div>
                </div>
                <span className={`h-status ${finished ? (complete ? "complete" : "ended") : "playing"}`}>
                  {finished ? (complete ? "Completada" : "Terminada") : "En curso"}
                </span>
              </div>

              <div className="h-progress">
                <div className="h-bar">
                  <div style={{ width: `${pct}%` }} />
                </div>
                <span>
                  <strong>{pct}%</strong> · {s.guessedCount}/{s.total}
                </span>
              </div>

              <dl className="h-stats">
                <div>
                  <dt>Tiempo</dt>
                  <dd>{formatDuration(s.playedMs)}</dd>
                </div>
                <div>
                  <dt>Pistas</dt>
                  <dd>{s.hintsUsed}</dd>
                </div>
                <div>
                  <dt>Monedas gastadas</dt>
                  <dd>
                    <Coin size={13} /> {s.coinsSpent} / {s.coinsEarned}
                  </dd>
                </div>
                <div>
                  <dt>Errores</dt>
                  <dd>{s.errors}</dd>
                </div>
              </dl>

              <div className="h-actions">
                <button className={finished ? "ghost small" : "primary small"} onClick={() => onOpen(s.sessionId)}>
                  {finished ? "Ver resumen" : "Reanudar"}
                </button>
                <button
                  className="link danger"
                  onClick={() => {
                    if (confirm(`¿Borrar esta partida de ${s.onlineId}? No se puede deshacer.`)) onDelete(s.sessionId);
                  }}
                >
                  Borrar
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
