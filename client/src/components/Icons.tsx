// Iconos SVG propios: símbolos de mando (triángulo, círculo, cruz, cuadrado) y trofeo de platino.
import { useState } from "react";

type P = { size?: number; className?: string; strokeWidth?: number };

export const Triangle = ({ size = 18, className, strokeWidth = 2.4 }: P) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 3.5 21.5 20h-19L12 3.5Z" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" />
  </svg>
);

export const Circle = ({ size = 18, className, strokeWidth = 2.4 }: P) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth={strokeWidth} />
  </svg>
);

export const Cross = ({ size = 18, className, strokeWidth = 2.4 }: P) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M5 5l14 14M19 5 5 19" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />
  </svg>
);

export const Square = ({ size = 18, className, strokeWidth = 2.4 }: P) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="4" y="4" width="16" height="16" rx="1.5" stroke="currentColor" strokeWidth={strokeWidth} />
  </svg>
);

export const SYMBOLS = [Triangle, Circle, Cross, Square];

export const Chevron = ({ size = 14, left = false }: { size?: number; left?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ transform: left ? "rotate(180deg)" : undefined }}>
    <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Logo del trofeo de platino. Usa la imagen real de client/public/platinum.png;
 * si no existe, dibuja un trofeo SVG de respaldo.
 */
export function PlatinumTrophy({ size = 72, className }: { size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return (
      <img
        src="/platinum.png"
        alt=""
        width={size}
        height={size}
        className={`logo-img ${className ?? ""}`}
        onError={() => setFailed(true)}
      />
    );
  }
  return <TrophySvg size={size} className={className} />;
}

const TrophySvg = ({ size = 72, className }: { size?: number; className?: string }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden>
    <defs>
      <linearGradient id="plat-body" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset=".45" stopColor="#d4def0" />
        <stop offset=".7" stopColor="#9fb3d6" />
        <stop offset="1" stopColor="#e9eff9" />
      </linearGradient>
      <linearGradient id="plat-base" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#7d93bd" />
        <stop offset="1" stopColor="#3f5786" />
      </linearGradient>
    </defs>
    <path d="M18 10h28v4h7a3 3 0 0 1 3 3c0 8-5.5 13.5-13 14.6A14 14 0 0 1 35 38v6h-6v-6a14 14 0 0 1-8-6.4C13.5 30.5 8 25 8 17a3 3 0 0 1 3-3h7v-4Zm-6 8c.6 4.8 3.5 8 7.7 9.3A22 22 0 0 1 18 18h-6Zm34 0a22 22 0 0 1-1.7 9.3c4.2-1.3 7.1-4.5 7.7-9.3h-6Z" fill="url(#plat-body)" stroke="#8ea3cc" strokeWidth="1" />
    <path d="M25 15c0 9 1.5 15 5 18" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".8" fill="none" />
    <rect x="22" y="44" width="20" height="5" rx="1.5" fill="url(#plat-base)" />
    <rect x="17" y="49" width="30" height="7" rx="2" fill="url(#plat-base)" />
    <path d="m32 16 1.9 3.9 4.3.6-3.1 3 .7 4.3L32 25.8l-3.8 2 .7-4.3-3.1-3 4.3-.6L32 16Z" fill="#5f7fb8" opacity=".55" />
  </svg>
);

/** Símbolos decorativos flotando en el fondo. */
export function BackgroundShapes() {
  const items = [
    { C: Triangle, top: "8%", left: "6%", size: 90, rot: -12 },
    { C: Circle, top: "70%", left: "4%", size: 120, rot: 0 },
    { C: Cross, top: "14%", left: "86%", size: 80, rot: 8 },
    { C: Square, top: "76%", left: "88%", size: 100, rot: 14 },
    { C: Circle, top: "40%", left: "94%", size: 50, rot: 0 },
    { C: Triangle, top: "88%", left: "46%", size: 60, rot: 20 },
  ];
  return (
    <div className="bg-shapes" aria-hidden>
      {items.map(({ C, top, left, size, rot }, i) => (
        <span key={i} style={{ top, left, transform: `rotate(${rot}deg)`, animationDelay: `${i * -3}s` }}>
          <C size={size} strokeWidth={1.2} />
        </span>
      ))}
    </div>
  );
}

/** Moneda: disco dorado con el símbolo de platino (rombo) en relieve. */
export const Coin = ({ size = 18, className }: { size?: number; className?: string }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <defs>
      <linearGradient id="coin-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffe9a3" />
        <stop offset=".5" stopColor="#f5b937" />
        <stop offset="1" stopColor="#c98512" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="10.5" fill="url(#coin-g)" stroke="#b07208" strokeWidth="1" />
    <circle cx="12" cy="12" r="7.6" fill="none" stroke="#fff3c4" strokeWidth="1" opacity=".7" />
    <path d="M12 7.2 15.6 12 12 16.8 8.4 12Z" fill="#fff6d6" stroke="#b07208" strokeWidth=".8" />
  </svg>
);
