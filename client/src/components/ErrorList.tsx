import type { GameState } from "../api";
import { Cross, Square } from "./Icons";

export default function ErrorList({ errors }: { errors: GameState["errors"] }) {
  if (errors.length === 0) return null;
  return (
    <section className="card errors">
      <div className="section-head">
        <h3>
          <Cross size={14} /> Errores
        </h3>
        <span className="badge bad">{errors.length}</span>
      </div>
      <ul>
        {errors.map((e) => (
          <li key={e.igdbId} title={e.name}>
            {e.cover ? (
              <img src={e.cover} alt="" />
            ) : (
              <div className="nocover">
                <Square size={12} />
              </div>
            )}
            <span>{e.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
