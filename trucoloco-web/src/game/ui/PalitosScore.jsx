// Anotador de palitos (fósforos) — el marcador tradicional del truco.
// Cada 5 puntos = un cuadrito de 4 fósforos + 1 diagonal (1-4 dibujan los lados,
// el 5° cruza en diagonal). Tablero partido en MALAS (0-15) y BUENAS (16-30),
// una columna por equipo (NOSOTROS / ELLOS). Look de mesa de bar, cero casino.

const SEGMENTS = 5; // 4 lados + diagonal
const SQUARES_PER_HALF = 3; // 15 puntos por mitad (malas / buenas)

// Los 5 trazos de un cuadro, en orden de anotación: izq, abajo, der, arriba, diagonal.
// Cada trazo: [x1,y1,x2,y2] con la "cabeza" del fósforo en (x1,y1).
const STICKS = [
  [8, 8, 8, 32],   // 1 · lado izquierdo
  [8, 34, 32, 34], // 2 · lado inferior
  [32, 32, 32, 8], // 3 · lado derecho
  [34, 8, 10, 8],  // 4 · lado superior
  [9, 9, 31, 31]   // 5 · diagonal (cruza)
];

function MatchSquare({ sticks, accent }) {
  return (
    <svg className="palito-square" viewBox="0 0 40 40" aria-hidden="true">
      {STICKS.slice(0, sticks).map(([x1, y1, x2, y2], index) => (
        <g key={index}>
          <line
            className="palito-stick"
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={index === 4 ? accent : "#e9dcc0"}
          />
          {/* cabeza del fósforo */}
          <circle className="palito-head" cx={x1} cy={y1} r={2.6} fill={index === 4 ? accent : "#c9482f"} />
        </g>
      ))}
    </svg>
  );
}

// Dibuja una mitad (malas o buenas): 3 cuadros, hasta 15 puntos.
function ScoreHalf({ label, points, accent }) {
  const value = Math.max(0, Math.min(15, points));
  return (
    <div className="palito-half">
      <span className="palito-half-label">{label}</span>
      <div className="palito-squares">
        {Array.from({ length: SQUARES_PER_HALF }, (_, i) => {
          const filled = Math.max(0, Math.min(SEGMENTS, value - i * SEGMENTS));
          return <MatchSquare key={i} sticks={filled} accent={accent} />;
        })}
      </div>
    </div>
  );
}

function TeamColumn({ name, score, accent, onAdjust, canAdjust }) {
  const malas = Math.min(15, score);
  const buenas = Math.max(0, score - 15);

  return (
    <div className="palito-team" style={{ "--palito-accent": accent }}>
      <div className="palito-team-head">
        <span className="palito-team-name">{name}</span>
        <span className="palito-team-total">{score}</span>
      </div>
      <ScoreHalf label="MALAS" points={malas} accent={accent} />
      <ScoreHalf label="BUENAS" points={buenas} accent={accent} />
      <div className="palito-adjust">
        <button
          type="button"
          className="palito-adjust-btn"
          disabled={!canAdjust}
          title={canAdjust ? "Restar un tanto" : "Anotador manual: próximamente"}
          onClick={() => onAdjust?.(-1)}
        >
          −
        </button>
        <button
          type="button"
          className="palito-adjust-btn"
          disabled={!canAdjust}
          title={canAdjust ? "Sumar un tanto" : "Anotador manual: próximamente"}
          onClick={() => onAdjust?.(1)}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function PalitosScore({ match }) {
  const scores = match.scores ?? { A: 0, B: 0 };
  const canAdjustManual = typeof match.adjustScore === "function";
  const mode = match.scoreMode ?? "auto";
  const isManual = mode === "manual";
  const toggleAvailable = typeof match.setScoreMode === "function";

  const adjust = (team) => (delta) => {
    if (!canAdjustManual) return;
    match.adjustScore(team, delta);
  };

  return (
    <section className="palitos-board" aria-label="Anotador de palitos">
      <header className="palitos-head">
        <span className="palitos-title">PIZARRA</span>
        <button
          type="button"
          className={isManual ? "palitos-mode palitos-mode-manual" : "palitos-mode"}
          disabled={!toggleAvailable}
          title={toggleAvailable ? "Cambiar anotador auto/manual" : "Anotador manual: próximamente"}
          onClick={() => match.setScoreMode?.(isManual ? "auto" : "manual")}
        >
          {isManual ? "Manual" : "Auto"}
        </button>
      </header>
      <div className="palitos-teams">
        <TeamColumn
          name="NOSOTROS"
          score={scores.A ?? 0}
          accent="#7ecb8f"
          onAdjust={adjust("A")}
          canAdjust={canAdjustManual && isManual}
        />
        <div className="palitos-divider" aria-hidden="true" />
        <TeamColumn
          name="ELLOS"
          score={scores.B ?? 0}
          accent="#e0704f"
          onAdjust={adjust("B")}
          canAdjust={canAdjustManual && isManual}
        />
      </div>
    </section>
  );
}
