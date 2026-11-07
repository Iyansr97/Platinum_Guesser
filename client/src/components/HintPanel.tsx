import type { ComponentType } from "react";
import type { GameState, HintType } from "../api";
import { Circle, Coin, Cross, Square, Triangle } from "./Icons";

const TYPES: { type: HintType; Icon: ComponentType<{ size?: number }>; label: string }[] = [
  { type: "date", Icon: Square, label: "Fecha del platino" },
  { type: "word", Icon: Triangle, label: "Una palabra" },
  { type: "platforms", Icon: Circle, label: "Plataformas" },
  { type: "year", Icon: Cross, label: "Año de salida" },
];
const ICON_BY_TYPE = Object.fromEntries(TYPES.map((t) => [t.type, t.Icon])) as Record<HintType, ComponentType<{ size?: number }>>;

interface Props {
  hint: GameState["hint"];
  hintsUsed: number;
  coins: number;
  hintCost: GameState["hintCost"];
  onHint: (type: HintType | undefined, newTarget?: boolean) => void;
  onClearTarget: () => void;
}

export default function HintPanel({ hint, hintsUsed, coins, hintCost, onHint, onClearTarget }: Props) {
  // Una pista fija ya revelada (fecha, año, plataformas) no se vuelve a cobrar.
  const alreadyShown = (t: HintType) => t !== "word" && !!hint?.hints.some((h) => h.type === t);

  return (
    <section className="card hints">
      <div className="section-head">
        <h3>Pistas</h3>
        <div className="hint-meta">
          <span className="muted small">{hintsUsed} usadas</span>
          <span className="coins" title="Monedas disponibles">
            <Coin size={18} />
            {coins}
          </span>
        </div>
      </div>

      {hint ? (
        <p className="muted small">
          Pistas sobre el juego <strong className="accent">#{hint.targetPosition}</strong>
          {hint.picked ? " (elegido por ti)" : " (al azar)"}
          <button className="link" onClick={() => onHint(undefined, true)} title="Elegir otro juego al azar (gratis)">
            Otro al azar
          </button>
          <button className="link" onClick={onClearTarget} title="La próxima pista será de un juego al azar">
            Quitar
          </button>
        </p>
      ) : (
        <p className="muted small">
          Ganas 1 moneda por cada platino acertado. Pulsa una casilla del progreso para pedir pistas de ese juego, o pide una directamente y se elegirá uno al azar.
        </p>
      )}

      <div className="hint-buttons">
        {TYPES.map(({ type, Icon, label }) => {
          const cost = hintCost[type];
          const shown = alreadyShown(type);
          const cantAfford = !shown && coins < cost;
          return (
            <button
              key={type}
              className={`chip ${cantAfford ? "locked" : ""}`}
              disabled={cantAfford || shown}
              onClick={() => onHint(type)}
              title={cantAfford ? `Necesitas ${cost} moneda${cost > 1 ? "s" : ""}` : undefined}
            >
              <Icon size={16} />
              <span className="chip-label">{label}</span>
              <span className="cost">
                {shown ? (
                  "Vista"
                ) : (
                  <>
                    <Coin size={14} />
                    {cost}
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {hint && hint.hints.length > 0 && (
        <ul className="hint-list">
          {hint.hints.map((h, i) => {
            const Icon = ICON_BY_TYPE[h.type];
            return (
              <li key={i}>
                <Icon size={14} />
                {h.text}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
