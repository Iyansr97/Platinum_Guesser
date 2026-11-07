import { useEffect, useRef } from "react";
import { formatDate, type GameState } from "../api";
import { Chevron, PlatinumTrophy, SYMBOLS } from "./Icons";

interface Props {
  game: GameState;
  open: boolean;
  onToggle: () => void;
  revealed: number[]; // posiciones recién adivinadas (para animarlas)
  onPick: (position: number) => void; // elegir/quitar el juego objetivo de las pistas
}

export default function ProgressPanel({ game, open, onToggle, revealed, onPick }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const pct = game.total ? Math.round((game.guessedCount / game.total) * 100) : 0;
  const target = game.hint?.targetPosition ?? 0;

  // Desplaza la cuadrícula hasta la caja recién revelada o la del objetivo de la pista.
  const focus = revealed[0] ?? target;
  useEffect(() => {
    if (!focus || !open) return;
    gridRef.current
      ?.querySelector(`[data-pos="${focus}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focus, open, revealed]);

  return (
    <aside className={`panel ${open ? "open" : "closed"}`}>
      <button className="panel-toggle" onClick={onToggle} aria-expanded={open}>
        <span className="toggle-label">
          <PlatinumTrophy size={22} />
          <span>
            <strong>{game.guessedCount}</strong>/{game.total} · {pct}%
          </span>
        </span>
        <span className="chev">
          <Chevron left={open} />
        </span>
      </button>

      {open && (
        <>
          <div className="progress">
            <div className="progress-head">
              <span>Progreso</span>
              <span>
                {game.guessedCount}/{game.total} adivinados · {pct}%
              </span>
            </div>
            <div className="bar">
              <div className="fill" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <p className="panel-tip">Pulsa una casilla para pedir pistas de ese juego</p>
          <div className="grid" ref={gridRef}>
            {game.slots.map((s) => {
              const cls = [
                "slot",
                s.guessed ? "guessed" : "hidden",
                s.position === target ? "target" : "",
                !s.guessed ? "pickable" : "",
                revealed.includes(s.position) ? "reveal" : "",
              ].join(" ");
              const Sym = SYMBOLS[(s.position - 1) % 4];
              return (
                <div
                  key={s.position}
                  data-pos={s.position}
                  className={cls}
                  role={s.guessed ? undefined : "button"}
                  tabIndex={s.guessed ? undefined : 0}
                  onClick={s.guessed ? undefined : () => onPick(s.position === target ? 0 : s.position)}
                  onKeyDown={s.guessed ? undefined : (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick(s.position === target ? 0 : s.position))}
                  title={s.guessed ? `#${s.position} · ${s.name}\nPlatino: ${formatDate(s.earnedAt)} (${s.platform})` : s.position === target ? `#${s.position} · seleccionado (pulsa para quitar)` : `#${s.position} · pulsa para pedir pistas de este juego`}
                >
                  {s.guessed ? (
                    <img src={s.iconUrl} alt={s.name} loading="lazy" />
                  ) : (
                    <>
                      <Sym size={34} strokeWidth={1.4} className="ghost-sym" />
                      <span className="q">?</span>
                    </>
                  )}
                  <span className="num">{s.position}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </aside>
  );
}
