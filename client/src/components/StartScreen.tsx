import { useState, type FormEvent } from "react";
import { loadPercent, type LoadProgress, type SessionSummary } from "../api";
import HistoryList from "./HistoryList";
import { BackgroundShapes,Circle, Cross, PlatinumTrophy, Square, Triangle } from "./Icons";

const STAGE_LABEL: Record<string, string> = {
  profile: "Buscando tu perfil en PSN",
  dates: "Descargando tus platinos",
  igdb: "Identificando los juegos",
};

function LoadBar({ progress }: { progress: LoadProgress }) {
  const pct = Math.round(loadPercent(progress));
  const counter = progress.stage !== "profile" && progress.total > 0 ? ` · ${progress.done}/${progress.total}` : "";
  return (
    <div className="loadbar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="loadbar-head">
        <span>
          {STAGE_LABEL[progress.stage] ?? "Cargando"}
          {counter}
        </span>
        <strong>{pct}%</strong>
      </div>
      <div className="loadbar-track">
        <div className="loadbar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

interface Props {
  loading: boolean;
  progress: LoadProgress | null;
  error: string | null;
  history: SessionSummary[];
  onStart: (username: string, refresh: boolean) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function StartScreen({ loading, progress, error, history, onStart, onOpen, onDelete }: Props) {
  const [username, setUsername] = useState("");
  const [refresh, setRefresh] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (username.trim()) onStart(username.trim(), refresh);
  };

  return (
    <main className="start">
      <BackgroundShapes />
      <div className="start-card">
        <PlatinumTrophy size={96} className="trophy-glow" />
        <h1>Platinum Guesser</h1>
        <div className="symbol-row" aria-hidden>
          <Triangle size={16} />
          <Circle size={16} />
          <Cross size={16} />
          <Square size={16} />
        </div>
        <p className="muted">¿Te acuerdas de todos los juegos que has platinado?</p>

        <form onSubmit={submit}>
          <label htmlFor="user">Tu usuario de PSN</label>
          <input
            id="user"
            autoFocus
            placeholder="p. ej. MiUsuarioPSN"
            value={username}
            disabled={loading}
            onChange={(e) => setUsername(e.target.value)}
          />
          <label className="check">
            <input type="checkbox" checked={refresh} disabled={loading} onChange={(e) => setRefresh(e.target.checked)} />
            Volver a descargar mis platinos de PSN
          </label>
          <button type="submit" className="primary" disabled={loading || !username.trim()}>
            {loading ? "Cargando platinos…" : "Nueva partida"}
          </button>
        </form>

        {loading && progress && <LoadBar progress={progress} />}
        {error && <p className="error-msg">{error}</p>}
      </div>

      {!loading && <HistoryList history={history} onOpen={onOpen} onDelete={onDelete} />}
    </main>
  );
}
