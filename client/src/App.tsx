import { useCallback, useEffect, useState } from "react";
import { api, type GameState, type LoadProgress, type SessionSummary } from "./api";
import StartScreen from "./components/StartScreen";
import GameScreen from "./components/GameScreen";

export default function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<LoadProgress | null>(null);

  const refreshHistory = useCallback(() => {
    api.listSessions().then(setHistory).catch(() => setHistory([]));
  }, []);

  useEffect(refreshHistory, [refreshHistory]);

  const start = async (username: string, refresh: boolean) => {
    setLoading(true);
    setError(null);
    setProgress(null);
    try {
      setGame(await api.loadProfile(username, refresh, setProgress));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const open = async (id: string) => {
    setError(null);
    try {
      setGame(await api.getGame(id));
    } catch (e) {
      setError((e as Error).message);
      refreshHistory();
    }
  };

  const remove = async (id: string) => {
    await api.deleteSession(id).catch(() => {});
    refreshHistory();
  };

  const backToMenu = () => {
    setGame(null);
    refreshHistory();
  };

  if (game) return <GameScreen key={game.sessionId} initial={game} onExit={backToMenu} />;

  return (
    <StartScreen
      loading={loading}
      progress={progress}
      error={error}
      history={history}
      onStart={start}
      onOpen={open}
      onDelete={remove}
    />
  );
}
