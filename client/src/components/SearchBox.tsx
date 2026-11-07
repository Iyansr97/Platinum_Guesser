import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { api, type SearchResult } from "../api";
import { Square } from "./Icons";

export default function SearchBox({ onSelect, disabled }: { onSelect: (g: SearchResult) => void; disabled: boolean }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Búsqueda con debounce de 300 ms; cancela la petición anterior.
  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api.search(text, ctrl.signal);
        setResults(r);
        setActive(0);
        setError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const choose = (g: SearchResult) => {
    onSelect(g);
    setQ("");
    setResults([]);
    inputRef.current?.focus();
  };

  const onKey = (e: KeyboardEvent) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      setResults([]);
    }
  };

  const showEmpty = !loading && !error && q.trim().length >= 2 && results.length === 0;

  return (
    <div className="search">
      <input
        ref={inputRef}
        autoFocus
        value={q}
        disabled={disabled}
        placeholder="Escribe el nombre de un juego…"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKey}
        aria-autocomplete="list"
      />
      {loading && <span className="spinner" aria-hidden />}

      {(results.length > 0 || showEmpty || error) && (
        <ul className="results" role="listbox">
          {error && <li className="empty">{error}</li>}
          {showEmpty && <li className="empty">Sin resultados en PlayStation</li>}
          {results.map((g, i) => (
            <li
              key={g.igdbId}
              role="option"
              aria-selected={i === active}
              className={i === active ? "active" : ""}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(g);
              }}
            >
              {g.cover ? (
                <img src={g.cover} alt="" />
              ) : (
                <div className="nocover">
                  <Square size={14} />
                </div>
              )}
              <div>
                <div className="r-name">{g.name}</div>
                <div className="r-meta">
                  {[g.platforms.join(" · "), g.year].filter(Boolean).join(" — ")}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
