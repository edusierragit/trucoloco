import { useCallback, useEffect, useState } from "react";
import { sfx } from "../../audio/sfx";
import { BARDO_BY_ID, RELATOR } from "./duelLines.js";
import { CHAMBERS, chamberOdds, cpuChooseBardo, cpuChooseRetort, cpuWantsSpin, other } from "./duelEngine.js";
import { duelStore, useDuel } from "./duelStore.js";
import "@fontsource/oswald/latin-500.css";
import "@fontsource/oswald/latin-600.css";
import "./duel.css";

const HUMAN = "p1";
const CPU = "p2";
// Pausa dramática entre el remate y el gatillo: que se lea quién la pegó.
const REVEAL_MS = 1700;

const fill = (line, a, b) => line.replaceAll("{a}", a).replaceAll("{b}", b);
const pick = (pool, seq) => pool[seq % pool.length];
const rand = (min, max) => min + Math.random() * (max - min);

function relatorLine(duel, names) {
  if (!duel) return "";
  const { lastPull, exchange, seq } = duel;
  if (duel.phase === "over") return fill(pick(RELATOR.corchazo, seq), names[duel.loser], "");
  if (lastPull?.kind === "spin") return fill(pick(RELATOR.spin, seq), names[lastPull.actor], "");
  if (lastPull?.kind === "click" && duel.phase === "attack") return fill(pick(RELATOR.click, seq), names[lastPull.actor], "");
  if (duel.phase === "pull" && exchange?.outcome) {
    const defender = names[other(exchange.by)];
    const attacker = names[exchange.by];
    return fill(pick(RELATOR[exchange.outcome], seq), defender, attacker);
  }
  if (duel.round === 1 && duel.phase === "attack") return pick(RELATOR.start, seq);
  return "";
}

function Revolver({ revolver, spins }) {
  const left = CHAMBERS - revolver.fired;
  return (
    <div className="duel-revolver" aria-label={`Revólver: 1 en ${left}`}>
      <div className="duel-drum">
        {Array.from({ length: CHAMBERS }, (_, index) => (
          <i
            key={index}
            className={index < revolver.fired ? "duel-chamber duel-chamber-spent" : index === revolver.fired ? "duel-chamber duel-chamber-next" : "duel-chamber"}
            style={{ "--a": `${index * 60}deg` }}
          />
        ))}
        <strong>1<small>en</small>{left}</strong>
      </div>
      <div className="duel-spins">
        <span className={spins.p1 ? "" : "duel-spin-used"}>Tu giro</span>
        <span className={spins.p2 ? "" : "duel-spin-used"}>Su giro</span>
      </div>
    </div>
  );
}

export function DuelOverlay({ playerName = "Vos", rivalName = "Rival", onExit }) {
  const duel = useDuel();
  const [revealSeq, setRevealSeq] = useState(-1);
  const names = { p1: playerName, p2: rivalName };

  useEffect(() => {
    sfx.ensure();
    duelStore.start();
    return () => duelStore.clear();
  }, []);

  const revealing = duel?.phase === "pull" && !duel.lastPull && revealSeq !== duel.seq;

  useEffect(() => {
    if (!revealing) return undefined;
    const seq = duel.seq;
    const timer = window.setTimeout(() => setRevealSeq(seq), REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [revealing, duel?.seq]);

  // Sonido por evento: una vez por cambio de estado, nunca por frame.
  useEffect(() => {
    if (!duel) return;
    const { phase, exchange, lastPull } = duel;
    if (phase === "retort") sfx.slap();
    else if (phase === "pull" && !lastPull) {
      if (exchange.outcome === "highlight") sfx.crowd(1.2);
      else if (exchange.outcome === "cagon") sfx.canto();
      else sfx.crowd(0.55);
    } else if (lastPull?.kind === "click") sfx.dryClick();
    else if (lastPull?.kind === "spin") sfx.drumSpin();
    else if (lastPull?.kind === "corchazo") sfx.corchazo();
  }, [duel?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  // Director: CPU y relojes. Se re-agenda en cada cambio de estado.
  useEffect(() => {
    if (!duel || duel.phase === "over") return undefined;
    const timers = [];
    const later = (ms, fn) => timers.push(window.setTimeout(fn, ms));
    const dispatch = (action) => duelStore.dispatch(action);

    if (duel.phase === "attack") {
      if (duel.attacker === CPU) {
        later(rand(1300, 2100), () => dispatch({ type: "attack", actor: CPU, bardoId: cpuChooseBardo(duelStore.get(), Math.random) }));
      } else {
        // si el humano se cuelga, el antro elige por él
        later(20000, () => dispatch({ type: "attack", actor: HUMAN, bardoId: duel.hands[HUMAN][0] }));
      }
    } else if (duel.phase === "retort") {
      if (other(duel.attacker) === CPU) {
        const think = rand(1500, Math.max(1800, Math.min(4200, duel.exchange.timeMs - 900)));
        later(think, () => dispatch({ type: "retort", actor: CPU, answer: cpuChooseRetort(duelStore.get(), Math.random) }));
      } else {
        later(duel.exchange.timeMs, () => dispatch({ type: "retort", actor: HUMAN, answer: null }));
      }
    } else if (duel.phase === "pull" && !revealing) {
      if (duel.puller === CPU) {
        if (cpuWantsSpin(duel, CPU)) later(1200, () => dispatch({ type: "spin", actor: CPU }));
        else later(rand(1400, 2300), () => dispatch({ type: "pull", actor: CPU }));
      } else {
        later(15000, () => dispatch({ type: "pull", actor: HUMAN }));
      }
    }
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [duel, revealing]);

  const act = useCallback((action) => duelStore.dispatch({ ...action, actor: HUMAN }), []);

  const myTurnAttack = duel?.phase === "attack" && duel.attacker === HUMAN;
  const myTurnRetort = duel?.phase === "retort" && duel.attacker !== HUMAN;
  const myTurnPull = duel?.phase === "pull" && duel.puller === HUMAN && !revealing;
  const canSpin = myTurnPull && duel.spins[HUMAN] > 0 && duel.revolver.fired > 0;

  useEffect(() => {
    const onKey = (event) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === "escape") { onExit?.(); return; }
      const current = duelStore.get();
      if (!current) return;
      const slot = ["1", "2", "3"].indexOf(key);
      if (slot >= 0 && myTurnAttack && current.hands[HUMAN][slot]) act({ type: "attack", bardoId: current.hands[HUMAN][slot] });
      else if (slot >= 0 && myTurnRetort && current.exchange.options[slot]) act({ type: "retort", answer: current.exchange.options[slot] });
      else if ((key === " " || key === "enter") && myTurnPull) { event.preventDefault(); act({ type: "pull" }); }
      else if (key === "g" && canSpin) act({ type: "spin" });
      else if (key === "r" && current.phase === "over") duelStore.start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act, canSpin, myTurnAttack, myTurnPull, myTurnRetort, onExit]);

  if (!duel) return null;

  const { exchange } = duel;
  const bardo = exchange ? BARDO_BY_ID[exchange.bardoId] : null;
  const showExchange = duel.phase === "retort" || duel.phase === "pull";
  const outcome = duel.phase === "pull" ? exchange?.outcome : null;
  const relator = relatorLine(duel, names);

  return (
    <div className={`duel duel-phase-${duel.phase}`} role="region" aria-label="Duelo de bardo">
      <header className="duel-top">
        <div className={duel.attacker === HUMAN && duel.phase !== "over" ? "duel-name duel-name-on" : "duel-name"}>
          <small>Vos</small>
          <strong>{playerName}</strong>
        </div>
        <div className="duel-title">
          <small>Sala del conflicto · Ronda {duel.round}</small>
          <strong>Duelo de bardo</strong>
          <Revolver revolver={duel.revolver} spins={duel.spins} />
        </div>
        <div className={duel.attacker === CPU && duel.phase !== "over" ? "duel-name duel-name-rival duel-name-on" : "duel-name duel-name-rival"}>
          <small>Rival</small>
          <strong>{rivalName}</strong>
        </div>
      </header>

      {showExchange && bardo ? (
        <div className="duel-exchange" key={exchange.bardoId}>
          <p className={exchange.by === HUMAN ? "duel-bubble duel-bubble-left" : "duel-bubble duel-bubble-right"}>
            <small>{names[exchange.by]} tira:</small>
            «{bardo.bardo}»
          </p>
          {outcome ? (
            <p className={`duel-bubble duel-answer duel-answer-${outcome} ${exchange.by === HUMAN ? "duel-bubble-right" : "duel-bubble-left"}`}>
              <small>{names[other(exchange.by)]}:</small>
              {exchange.answer ? `«${exchange.answer}»` : "…"}
              <b className="duel-stamp">{outcome === "highlight" ? "¡HIGHLIGHT!" : outcome === "cagon" ? "¡CAGÓN!" : "¡SE LA COMIÓ!"}</b>
              {outcome !== "highlight" ? <em>El remate era: «{bardo.remate}»</em> : null}
            </p>
          ) : null}
        </div>
      ) : null}

      <section className="duel-actions">
        {duel.phase === "attack" ? (
          myTurnAttack ? (
            <>
              <h3>Tirá tu bardo</h3>
              <div className="duel-options">
                {duel.hands[HUMAN].map((id, index) => (
                  <button key={id} type="button" className="duel-card" onClick={() => act({ type: "attack", bardoId: id })}>
                    <kbd>{index + 1}</kbd>
                    {BARDO_BY_ID[id].bardo}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <h3 className="duel-waiting">{rivalName} está buscando la más hiriente…</h3>
          )
        ) : null}

        {duel.phase === "retort" ? (
          <>
            <div className="duel-timer" key={duel.seq} style={{ "--duel-time": `${exchange.timeMs}ms` }}>
              <i />
            </div>
            {myTurnRetort ? (
              <>
                <h3>¡Rematalo!</h3>
                <div className="duel-options">
                  {exchange.options.map((option, index) => (
                    <button key={option} type="button" className="duel-card duel-card-retort" onClick={() => act({ type: "retort", answer: option })}>
                      <kbd>{index + 1}</kbd>
                      {option}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <h3 className="duel-waiting">{rivalName} busca el remate…</h3>
            )}
          </>
        ) : null}

        {duel.phase === "pull" && !revealing ? (
          myTurnPull ? (
            <div className="duel-trigger-row">
              <button type="button" className="duel-trigger" onClick={() => act({ type: "pull" })}>
                Apretar el gatillo
                <small>1 en {Math.round(1 / chamberOdds(duel.revolver))} · Espacio</small>
              </button>
              <button type="button" className="duel-spin" disabled={!canSpin} onClick={() => act({ type: "spin" })}>
                {duel.spins[HUMAN] ? "Girar tambor" : "Sin giro"}
                <small>{duel.revolver.fired === 0 ? "Tambor fresco" : "Vuelve a 1 en 6 · G"}</small>
              </button>
            </div>
          ) : (
            <h3 className="duel-waiting duel-waiting-tense">{rivalName} se apunta a la sien…</h3>
          )
        ) : null}

        {duel.phase === "over" ? (
          <div className={duel.loser === HUMAN ? "duel-result duel-result-lose" : "duel-result duel-result-win"}>
            <strong>¡CORCHAZO!</strong>
            <p>{duel.loser === HUMAN ? "Quedaste pagando. La vuelta es tuya." : `${rivalName} quedó pagando. Salís caminando.`}</p>
            <div className="duel-result-actions">
              <button type="button" className="duel-trigger" onClick={() => duelStore.start()}>Revancha <small>R</small></button>
              <button type="button" className="duel-spin" onClick={onExit}>Volver al antro <small>Esc</small></button>
            </div>
          </div>
        ) : null}
      </section>

      {relator ? <p className="duel-relator" key={`r-${duel.seq}`}>{relator}</p> : null}
    </div>
  );
}
