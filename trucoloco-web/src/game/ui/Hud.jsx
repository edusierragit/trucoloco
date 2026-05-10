import { useState } from "react";
import { getCardRankLabel, getCardRankNumber, getCardSuitCode } from "../data/cards";
import { roleDefinitions } from "../data/characters";

const BOTTOM_OWNED_ADVANCE_PHASES = ["pre-rival-lead", "rival-leads", "trick-closed"];

const roleTone = {
  Negociante: {
    slug: "negociante",
    tableName: "La caja",
    quote: "Todo se arregla charlando. Si no, se cobra.",
    seal: "BANCO"
  },
  "Jugador Estrella": {
    slug: "jugador-estrella",
    tableName: "La fama",
    quote: "El marketing sube cuando la mesa lo mira.",
    seal: "HYPE"
  },
  Cartachin: {
    slug: "cartachin",
    tableName: "La mugre fina",
    quote: "No es suerte. Es una carta donde no miraste.",
    seal: "ARMA"
  }
};

const roleSelectCopy = {
  Negociante: "Puntos y trato",
  "Jugador Estrella": "Caos social",
  Cartachin: "Mazo de armas"
};

function getRoleTone(match) {
  return roleTone[match.selectedRole] ?? roleTone.Cartachin;
}

function Header({ match }) {
  const subtitle = match.phase === "role-select"
    ? `Elegi un rol para entrar al antro. La mesa ya tiene repartidor y mano.`
    : match.handClosed
    ? `La mano termino. ${match.activeLane.human.name} ${match.handWinner === "A" ? "la gano" : "la perdio"}.`
    : `Elegiste ${match.selectedRole}. Reparte ${match.dealerName}; sale ${match.whoStartsName}.`;
  const scoreNames = match.phase === "role-select"
    ? `Reparte ${match.dealerName} · sale ${match.whoStartsName}`
    : `${match.activeLane.human.name} vs ${match.activeLane.rival.name}`;

  return (
    <header className={match.phase === "role-select" ? "hud-top hud-top-select" : "hud-top hud-top-compact"}>
      <div className="title-block">
        <h1>TRUCOLOCO 5.0</h1>
        <p>{subtitle}</p>
      </div>

      <div className="scoreboard">
        <span className="score-label">Mano {match.handNumber} · Mano vale {match.activeBet}</span>
        <strong>
          {match.scores.A} - {match.scores.B}
        </strong>
        <span className="score-names">{scoreNames}</span>
        <span className="score-label">primero a {match.config.winningScore}</span>
      </div>
    </header>
  );
}

function RoleSelector({ match }) {
  const selectedRoleDef = roleDefinitions[match.selectedRole];
  const selectedCharacter = match.selectedCharacter ?? match.activeLane.human;
  const startSelectedRole = () => {
    if (!match.canAdvance) return;
    match.startHand();
  };

  if (match.handStarted) {
    return (
      <section className="role-lock">
        <div>
          <span className="panel-kicker">{match.handClosed ? "Rol de la partida" : "Rol en juego"}</span>
          <strong>
            {selectedCharacter.name}
          </strong>
          <small>{match.selectedRole}</small>
        </div>
        <span className="role-spotlight-tag">{selectedRoleDef.powerName}</span>
      </section>
    );
  }

  return (
    <section className="role-selector role-selector-arcade">
      <div className="role-select-hero">
        <span className="panel-kicker">Paso 1 · Rol y personaje</span>
        <h2>Elegí tu entrada</h2>
        <p>
          Primero definís la regla de la mano. Después marcás qué personaje del rol toma el foco.
        </p>
      </div>

      <div className="role-card-row">
        {match.roleOptions.map((role, index) => {
          const human = match.roster.A.find((player) => player.role === role);
          const active = role === match.selectedRole;

          return (
            <button
              key={role}
              className={active ? "role-card role-card-active" : "role-card"}
              disabled={!match.canSwitchRole && role !== match.selectedRole}
              onClick={() => match.selectRole(role)}
              style={{ "--role-accent": human?.accent ?? "#e5a83e", "--role-index": index }}
              type="button"
            >
              <span className="role-card-number">0{index + 1}</span>
              <strong>{role}</strong>
              <small>{roleSelectCopy[role]}</small>
            </button>
          );
        })}
      </div>

      <div className="character-picker">
        <div className="character-picker-head">
          <span className="panel-kicker">Personaje · {match.selectedRole}</span>
          <strong>{selectedCharacter.name}</strong>
        </div>

        <div className="character-card-row">
          {match.selectedRoleCharacters.map((character) => {
            const active = character.id === selectedCharacter.id;

            return (
              <button
                key={character.id}
                className={active ? "character-card character-card-active" : "character-card"}
                disabled={!match.canSwitchRole && !active}
                onClick={() => match.selectCharacter(character.id)}
                style={{ "--character-accent": character.accent }}
                type="button"
              >
                <span className="character-card-mark" aria-hidden="true" />
                <strong>{character.name}</strong>
                <small>{character.role}</small>
                <em>{character.quote}</em>
              </button>
            );
          })}
        </div>
      </div>

      <article className="role-ready-strip">
        <div>
          <span className="panel-kicker">Antes de repartir</span>
          <strong>{selectedCharacter.name} · {selectedRoleDef.title}</strong>
          <p>
            La mesa 3v3 ya tiene orden. Sale {match.whoStartsName}. Reparte {match.dealerName}. Tu entrada queda marcada por {selectedCharacter.name}.
          </p>
        </div>
        <button
          className="action-button action-button-primary"
          disabled={!match.canAdvance}
          onClick={startSelectedRole}
          type="button"
        >
          Sentarse y repartir
        </button>
      </article>
    </section>
  );
}

function ActionFocus({ match }) {
  if (match.phase === "role-select") {
    return null;
  }

  const actions = [];
  const focusState = getFocusState(match);
  const focusButtons = [];
  const advanceHandler = getAdvanceHandler(match);
  const trucoActionLabel = match.trucoCallLabel ?? "Truco";

  if (match.canUseRolePower) actions.push(match.rolePowerButtonLabel);
  if (match.canUseWeapon) actions.push("Cargar arma");
  if (match.canCallEnvido) actions.push("Cantar envido");
  if (match.canCallTruco) actions.push(`Cantar ${trucoActionLabel.toLowerCase()}`);
  if (match.canPlayCard) actions.push("Bajar carta");
  if (match.canAdvance && match.advanceLabel && !BOTTOM_OWNED_ADVANCE_PHASES.includes(match.phase)) {
    actions.push(match.phase === "table-auto-turn" ? "Avanzar mesa" : match.advanceLabel);
  }

  if (match.canUseRolePower && match.selectedRole === "Negociante") {
    focusButtons.push({
      label: match.rolePowerButtonLabel,
      tone: "primary",
      onClick: match.negotiatePoints
    });
  }

  if (match.canCallEnvido) {
    focusButtons.push({
      label: "Envido",
      tone: "secondary",
      onClick: match.callEnvido
    });
  }

  if (match.canCallTruco) {
    focusButtons.push({
      label: trucoActionLabel,
      tone: "secondary",
      onClick: match.callTruco
    });
  }

  if (
    match.canAdvance &&
    match.advanceLabel &&
    !match.handClosed &&
    !match.matchWinner &&
    !BOTTOM_OWNED_ADVANCE_PHASES.includes(match.phase)
  ) {
    focusButtons.push({
      label: match.advanceLabel,
      tone: focusButtons.length ? "secondary" : "primary",
      onClick: advanceHandler
    });
  }

  return (
    <section className="call-bar action-focus">
      <div className="call-copy">
        <div className="focus-status">
          <span className={`focus-badge focus-badge-${focusState.tone}`}>{focusState.badge}</span>
          <span className="role-table-name">{getRoleTone(match).tableName}</span>
        </div>
        <span className="panel-kicker">Turno de mesa</span>
        <strong className="role-power-title">{focusState.summary}</strong>
        <p>{match.phaseHint}</p>
        {actions.length ? <small className="role-power-status">Accion disponible: {actions.join(" o ").toLowerCase()}.</small> : null}
      </div>

      {focusButtons.length ? (
        <div className="call-actions focus-actions">
          {focusButtons.map((button) => (
            <button
              key={button.label}
              className={`action-button action-button-${button.tone}`}
              onClick={button.onClick}
              type="button"
            >
              {button.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function TableFlowPanel({ match }) {
  if (!match.tableFlow || match.phase === "role-select") {
    return null;
  }

  return (
    <section className="table-flow-panel">
      <div className="table-flow-head">
        <span className="panel-kicker">Mesa 3v3</span>
        <strong>Orden de ronda</strong>
      </div>
      <div className="table-flow-seats">
        {match.tableFlow.seats.map((seat) => {
          const className = [
            "table-flow-seat",
            seat.isSelectedDuel ? "table-flow-seat-duel" : "",
            seat.isActing ? "table-flow-seat-acting" : "",
            seat.isMano ? "table-flow-seat-mano" : "",
            seat.isDealer ? "table-flow-seat-dealer" : ""
          ].filter(Boolean).join(" ");

          return (
            <article key={seat.seatId} className={className}>
              <span>{seat.label}</span>
              <strong>{seat.player?.name}</strong>
              <small>
                {seat.isActing ? "Actua" : seat.isMano ? "Mano" : seat.isDealer ? "Reparte" : seat.role}
              </small>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function getAdvanceHandler(match) {
  if (match.matchWinner) return match.restartMatch;
  if (match.phase === "envido-resolution") return match.settleEnvido;
  if (match.phase === "role-select") return match.startHand;
  if (match.phase === "trick-closed") return match.clearTrick;
  if (match.phase === "pre-rival-lead" || match.phase === "rival-leads") return match.revealRivalLead;
  if (match.handClosed) return match.startNextHand;
  return match.advance;
}

function getTeamName(team, match) {
  return team === "A" ? match.activeLane.human.name : match.activeLane.rival.name;
}

function getTeamLabel(team) {
  return team === "A" ? "Tu equipo" : "Equipo rival";
}

function getSeatNameById(match, seatId) {
  return match.tableFlow?.seats.find((seat) => seat.seatId === seatId)?.player?.name ?? null;
}

function getTrickWinnerName(trick, match) {
  if (!trick) return "La mesa";
  if (trick.result === "tie") return getTeamName(trick.winner, match);
  return getSeatNameById(match, trick.winnerSeatId) ?? getTeamName(trick.winner, match);
}

function getCurrentLeaderName(match) {
  return getSeatNameById(match, match.currentLeadSeatId) ?? getTeamName(match.leadTeam, match);
}

function getFocusState(match) {
  if (match.phase === "role-select") {
    return {
      badge: "Rol listo",
      summary: `Si confirmas ${match.selectedRole}, la mano arranca para ${match.whoStartsName}.`,
      tone: "neutral"
    };
  }

  if (match.matchWinner) {
    return {
      badge: "Partida cerrada",
      summary: `${getTeamName(match.matchWinner, match)} llego a ${match.config.winningScore}.`,
      tone: "neutral"
    };
  }

  if (match.handClosed) {
    return {
      badge: match.handWinner === "A" ? "Mano ganada" : "Mano perdida",
      summary: match.pointsInverted
        ? `${getTeamName(match.handWinner, match)} gano la mano, pero el punto lo cobra ${getTeamName(match.scoringWinner, match)}.`
        : `${getTeamName(match.scoringWinner, match)} cobra esta mano.`,
      tone: match.scoringWinner === "A" ? "win" : "lose"
    };
  }

  if (match.phase === "envido-resolution") {
    const pending = match.envidoPending;
    const winnerName = pending?.winner === "A" ? match.activeLane.human.name : match.activeLane.rival.name;

    return {
      badge: pending?.accepted ? "Envido querido" : "Envido no querido",
      summary: pending?.accepted
        ? `${match.activeLane.human.name} ${pending.humanValue} · ${match.activeLane.rival.name} ${pending.rivalValue}. Cobra ${winnerName}.`
        : `${match.activeLane.rival.name} no quiso. Cobra ${match.activeLane.human.name}.`,
      tone: pending?.winner === "A" ? "win" : "lose"
    };
  }

  if (match.phase === "truco-response") {
    return {
      badge: "Te apuran",
      summary: `${match.activeLane.rival.name} sube a ${match.trucoPending?.label ?? "truco"}.`,
      tone: "neutral"
    };
  }

  if (match.phase === "trick-closed") {
    const lastTrick = match.trickHistory[match.trickHistory.length - 1];
    const winnerName = getTrickWinnerName(lastTrick, match);

    if (lastTrick?.result === "tie") {
      return {
        badge: "Vuelta parda",
        summary: `La ventaja sigue para ${winnerName}.`,
        tone: "draw"
      };
    }

    return {
      badge: lastTrick?.winner === "A" ? "Vuelta ganada" : "Vuelta perdida",
      summary: `${winnerName} abre la siguiente vuelta.`,
      tone: lastTrick?.winner === "A" ? "win" : "lose"
    };
  }

  if (match.phase === "rival-leads") {
    return {
      badge: "Turno rival",
      summary: `${match.activeLane.rival.name} abre la vuelta ${match.displayVueltaNumber}.`,
      tone: "neutral"
    };
  }

  if (match.phase === "pre-rival-lead") {
    return {
      badge: "Decidis vos",
      summary: `${match.activeLane.rival.name} sale primero, pero tu rol todavia puede intervenir.`,
      tone: "neutral"
    };
  }

  if (match.phase === "answer-rival") {
    return {
      badge: "Tu respuesta",
      summary: `${match.activeLane.rival.name} ya jugo. Ahora responde ${match.activeLane.human.name}.`,
      tone: "neutral"
    };
  }

  if (match.phase === "table-auto-turn") {
    if ((match.canUseRolePower || match.canUseWeapon) && match.tableCards.length === 0) {
      return {
        badge: "Antes de la primera carta",
        summary: `Podés usar tu rol antes de que juegue ${match.nextActorName}.`,
        tone: "neutral"
      };
    }

    return {
      badge: "Mesa",
      summary: `Juega ${match.nextActorName}. Avanzá para ver su carta.`,
      tone: "neutral"
    };
  }

  if (match.phase === "table-human-turn") {
    if ((match.canUseRolePower || match.canUseWeapon) && match.tableCards.length === 0) {
      return {
        badge: "Tu turno",
        summary: "Primero decidí si usás tu rol.",
        tone: "neutral"
      };
    }

    return {
      badge: "Tu turno",
      summary: `Te toca como ${match.activeLane.human.name}.`,
      tone: "neutral"
    };
  }

  return {
    badge: "Tu turno",
    summary: `Estas abriendo la vuelta ${match.displayVueltaNumber}.`,
    tone: "neutral"
  };
}

function getShortCardName(card) {
  return card?.name?.replace(" de ", " ") ?? "";
}

function getSuitClass(card) {
  return `suit-${(card?.suit ?? "neutral").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function getProgressSummary(match) {
  if (!match.trickHistory.length) {
    return `Todavia no se jugo ninguna vuelta. Sale ${match.whoStartsName}.`;
  }

  const lastTrick = match.trickHistory[match.trickHistory.length - 1];

  if (match.handClosed) {
    return `${getTeamLabel(match.handWinner)} cerro la mano en ${match.trickHistory.length} ${match.trickHistory.length === 1 ? "vuelta" : "vueltas"}.`;
  }

  if (lastTrick.result === "tie") {
    return `La vuelta ${lastTrick.index} fue parda. La ventaja sigue para ${getTrickWinnerName(lastTrick, match)}.`;
  }

  return `${getTrickWinnerName(lastTrick, match)} gano la vuelta ${lastTrick.index} y abre la siguiente.`;
}

function TableCard({ card, label }) {
  const delta = card.powerDelta ?? 0;
  const modifierCopy = delta ? (delta > 0 ? "Potenciada" : "Debilitada") : null;

  return (
    <article
      className={`table-card table-card-${card.side?.toLowerCase() ?? "neutral"} ${getSuitClass(card)}`}
      style={{ "--card-accent": card.tone }}
    >
      <span className="table-card-corner">
        <strong>{getCardRankNumber(card)}</strong>
        <small>{getCardSuitCode(card)}</small>
      </span>
      <span className="table-card-owner">{label}</span>
      <span className="table-card-emblem" aria-hidden="true" />
      <strong className="table-card-name">{card.name}</strong>
      <small>{card.suit}</small>
      <span className="table-card-suit-mark">{getCardSuitCode(card)}</span>
      {modifierCopy ? <span className="table-card-force">{modifierCopy}</span> : null}
    </article>
  );
}

function TableShowdown({ match }) {
  const lastTrick = match.tableCards.length >= 6 ? match.trickHistory[match.trickHistory.length - 1] : null;
  const resultCopy = getTableResultCopy(match, lastTrick);
  const tableSlots = Array.from({ length: 6 }, (_, index) => match.tableCards[index] ?? null);

  return (
    <section className="table-showdown">
      <div className="table-showdown-head">
        <span className="panel-kicker">Mesa · Vuelta {match.displayVueltaNumber}/3</span>
        <strong>{resultCopy}</strong>
      </div>

      <div className="table-card-row table-card-row-six">
        {tableSlots.map((card, index) =>
          card ? (
            <TableCard key={`${card.seatId}-${card.handIndex}`} card={card} label={card.owner} />
          ) : (
            <div key={`empty-${index}`} className="table-card table-card-empty">
              <span>Slot {index + 1}</span>
              <small>{index === match.tableCards.length ? "Próximo" : "Pendiente"}</small>
            </div>
          )
        )}
      </div>
    </section>
  );
}

function getTableResultCopy(match, lastTrick) {
  if (lastTrick) {
    const winnerName = getTrickWinnerName(lastTrick, match);
    if (lastTrick.result === "tie") return `Parda. La ventaja queda para ${winnerName}.`;
    return `${winnerName} gana esta vuelta.`;
  }

  if (match.tableCards.length) {
    return `${match.tableCards.length}/6 cartas en mesa. Actúa ${match.nextActorName ?? "la mesa"}.`;
  }

  if (match.nextActorName) return `Todavía no hay cartas. Sale ${match.nextActorName}.`;
  if (match.handClosed) return "La mano ya cerro.";
  return "Todavia no hay cartas en esta vuelta.";
}

function TableSpotlight({ match }) {
  if (!match.handStarted || match.phase === "role-select") {
    return null;
  }

  return (
    <div className="table-spotlight-layer">
      <TableShowdown match={match} />
    </div>
  );
}

function TrickLedger({ match }) {
  if (!match.trickHistory.length) {
    return null;
  }

  return (
    <section className="trick-ledger">
      <span className="panel-kicker">Vueltas jugadas</span>
      <div className="trick-ledger-list">
        {match.trickHistory.map((trick) => {
          const result =
            trick.result === "tie" ? "Parda" : trick.winner === "A" ? "Tu equipo" : "Rival";
          const winningCard = trick.cards?.find((card) => card.seatId === trick.winnerSeatId);
          const summary = trick.cards
            ? `${trick.cards.length} cartas · ${winningCard?.card?.name ?? winningCard?.name ?? "sin carta ganadora"}`
            : getShortCardName(trick.humanCard);
          const winnerName = getTrickWinnerName(trick, match);

          return (
            <article key={trick.index} className="trick-ledger-row">
              <strong>V{trick.index}</strong>
              <span>{summary}</span>
              <span>{winningCard?.owner ?? winnerName}</span>
              <em>{result}</em>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function StatusStrip({ match }) {
  const hasTableEvent = match.tableCards.length > 0 || match.trickHistory.length > 0 || match.handClosed || match.matchWinner;

  if (match.phase === "role-select" || match.handClosed || match.matchWinner || !hasTableEvent) {
    return null;
  }

  const negotiationSummary = match.negotiationDice
    ? `Dados ${match.negotiationDice.humanDie} y ${match.negotiationDice.rivalDie}.`
    : null;
  const tone = getRoleTone(match);
  const speaker = match.nextActorName ?? match.activeLane.human.name;

  return (
    <section className="status-strip">
      <article className="recent-event-card acta-card">
        <div className="acta-top">
          <span className="panel-kicker">Acta de mesa</span>
          <span className="acta-seal">{tone.seal}</span>
        </div>
        <strong>{match.highlight}</strong>
        <p>{match.eventLog}</p>
        <blockquote>
          <span>{speaker}</span>
          {tone.quote}
        </blockquote>
        {negotiationSummary ? <p className="acta-note">{negotiationSummary}</p> : null}
      </article>
      {match.trickHistory.length ? (
        <article className="status-card status-card-wide">
          <TrickLedger match={match} />
        </article>
      ) : null}
    </section>
  );
}

function RolePowerBar({ match }) {
  return null;
}

function AwayFromTablePanel({ match, onReturnToTable }) {
  return (
    <section className="away-from-table-panel">
      <span className="focus-badge focus-badge-neutral">Fuera de mesa</span>
      <span className="panel-kicker">Vista de puerta</span>
      <strong>La mano sigue en la mesa.</strong>
      <p>
        No se puede jugar desde la puerta. Volvé a la mesa para ver cartas, cantar o avanzar la ronda.
      </p>
      <button className="action-button action-button-primary" onClick={onReturnToTable} type="button">
        Volver a la mesa
      </button>
      <small>
        Ahora: {match.nextActorName ? `actúa ${match.nextActorName}` : match.highlight}
      </small>
    </section>
  );
}

function CardButton({ card, disabled, onPlay, offset }) {
  const rankLabel = getCardRankLabel(card);
  const rankNumber = getCardRankNumber(card);
  const suitGlyph = getCardSuitCode(card);
  const hasCardImage = Boolean(card.image);

  return (
    <button
      className={`card-button ${hasCardImage ? "card-button-image" : ""} ${getSuitClass(card)}`}
      disabled={disabled}
      onClick={() => onPlay(card.handIndex)}
      style={{
        "--card-accent": card.tone,
        "--card-offset": offset
      }}
      type="button"
      aria-label={`Jugar ${card.name}`}
    >
      <span className="card-surface">
        {hasCardImage ? (
          <img className="card-art" src={card.image} alt="" draggable="false" />
        ) : (
          <>
            <span className="card-corner">
              <span className="card-corner-number">{rankNumber}</span>
              <small>{suitGlyph}</small>
            </span>
            <span className="card-corner card-corner-bottom">
              <span className="card-corner-number">{rankNumber}</span>
              <small>{suitGlyph}</small>
            </span>
            <span className="card-badge">{suitGlyph}</span>
            <span className="card-rank-word">{rankLabel}</span>
            <span className="card-suit-emblem" aria-hidden="true" />
            <span className="card-main">
              <span className="card-main-rank">{rankNumber}</span>
              <span className="card-main-suit">{suitGlyph}</span>
            </span>
            <span className="card-name">{card.name}</span>
          </>
        )}
        <span className="card-footer">
          <span className="card-suit-label">{card.suit}</span>
          <span className="card-power">Fuerza {card.power}</span>
        </span>
      </span>
    </button>
  );
}

function TrucoResponsePanel({ match }) {
  const pending = match.trucoPending;
  const callerName = pending?.caller === "A" ? match.activeLane.human.name : match.activeLane.rival.name;
  const raiseLabel = match.trucoResponseRaiseLabel;

  if (!pending) return null;

  return (
    <footer className="bottom-dock bottom-dock-decision bottom-dock-truco">
      <section className="decision-panel truco-response-panel">
        <div className="decision-copy">
          <span className="panel-kicker">Lance de truco</span>
          <strong>{callerName} canta {pending.label}</strong>
          <p>
            Si querés, la mano vale {pending.acceptedBet}. Si no querés, {callerName} cobra {pending.rejectedPoints}.
          </p>
        </div>

        <div className="truco-ladder" aria-hidden="true">
          <span className={pending.label === "Truco" ? "truco-step truco-step-active" : "truco-step"}>Truco</span>
          <span className={pending.label === "Retruco" ? "truco-step truco-step-active" : "truco-step"}>Retruco</span>
          <span className={pending.label === "Vale cuatro" ? "truco-step truco-step-active" : "truco-step"}>Vale 4</span>
        </div>

        <div className="decision-action-stack truco-response-actions">
          {raiseLabel ? (
            <button className="action-button action-button-secondary next-hand" onClick={match.raiseTrucoResponse} type="button">
              Quiero {raiseLabel.toLowerCase()}
            </button>
          ) : null}
          <button className="action-button action-button-primary next-hand" onClick={match.acceptTruco} type="button">
            Quiero
          </button>
          <button className="action-button action-button-danger next-hand" onClick={match.rejectTruco} type="button">
            No quiero
          </button>
        </div>
      </section>
    </footer>
  );
}

function WeaponButton({ weapon, disabled, onUse }) {
  return (
    <button
      className="weapon-button"
      disabled={disabled}
      onClick={() => onUse(weapon.handIndex)}
      style={{ background: `linear-gradient(160deg, ${weapon.tone}, #1c1209)` }}
      type="button"
    >
      <span className="weapon-title">{weapon.name}</span>
      <span className="weapon-copy">{weapon.summary}</span>
    </button>
  );
}

function getHandPanelCopy(match) {
  const trucoActionLabel = match.trucoCallLabel?.toLowerCase() ?? "truco";

  if (match.phase === "role-select") {
    return "Primero confirma el rol. La mano se reparte cuando arranques.";
  }

  if (match.matchWinner) {
    return "La partida ya termino. Si queres, arranca una nueva.";
  }

  if (match.phase === "envido-resolution") {
    return "Primero anotá el envido. Después vuelve la mano normal.";
  }

  if (match.canPlayCard) {
    if (match.canCallEnvido && match.canCallTruco) return `Podés cantar envido, ${trucoActionLabel} o bajar una carta.`;
    if (match.canCallTruco) return `Podés cantar ${trucoActionLabel} o bajar una carta.`;
    return "Elegi una carta para esta vuelta.";
  }

  if (match.phase === "table-auto-turn") {
    return `Está por jugar ${match.nextActorName}. Avanzá la mesa para ver la carta.`;
  }

  if (match.canAdvance && match.phase === "rival-leads") {
    return `${match.activeLane.rival.name} sale primero. Mirá su carta antes de responder.`;
  }

  if (match.phase === "pre-rival-lead") {
    return "Antes de mirar la salida rival, decidí si usás el poder del rol.";
  }

  if (match.canAdvance && match.phase === "trick-closed") {
    return "La vuelta ya se resolvio. Limpiá la mesa para arrancar la siguiente con claridad.";
  }

  if (match.handClosed) {
    return "La mano ya termino. Lo que te quedo en la mano ya no cambia el resultado.";
  }

  return "Todavia no es momento de bajar una carta.";
}

function BottomDock({ match, handFocus, setHandFocus }) {
  const nextLabel = match.advanceLabel ?? (match.matchWinner ? "Nueva partida" : match.handClosed ? "Siguiente mano" : "Seguir");
  const advanceHandler = getAdvanceHandler(match);
  const showWeaponsPanel =
    match.handStarted &&
    !match.handClosed &&
    match.selectedRole === "Cartachin" &&
    (match.canUseWeapon || match.activeWeapon || match.weaponUsed);
  const showHandCards = match.handStarted && !match.handClosed && !match.matchWinner && match.canPlayCard;
  const handWinnerName = getTeamLabel(match.handWinner);
  const scoringWinnerName = getTeamLabel(match.scoringWinner);
  const showResultPanel = match.handStarted && (match.handClosed || match.matchWinner);
  const showUtilityPanel = showResultPanel || showWeaponsPanel;

  if (match.phase === "role-select") {
    return null;
  }

  if (match.phase === "table-auto-turn" && !showWeaponsPanel) {
    return null;
  }

  if (match.phase === "table-auto-turn" && showWeaponsPanel) {
    return (
      <footer className="bottom-dock bottom-dock-weapons-only">
        <section className="weapons-panel">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">Armas de Cartachin</span>
              <p>
                {match.activeWeapon
                  ? `Activa: ${match.activeWeapon.name}.`
                  : match.canUseWeapon
                    ? "Podés cargar un arma antes de que salga la primera carta."
                    : "El arma de esta mano ya quedó definida."}
              </p>
            </div>
          </div>

          <div className="weapon-grid">
            {match.weaponHand.map((weapon) => (
              <WeaponButton
                key={weapon.handIndex}
                weapon={weapon}
                disabled={!match.canUseWeapon}
                onUse={match.useWeapon}
              />
            ))}
          </div>
        </section>
      </footer>
    );
  }

  if (match.trucoPending) {
    return <TrucoResponsePanel match={match} />;
  }

  if (match.phase === "pre-rival-lead" || match.phase === "rival-leads") {
    const isPreDecision = match.phase === "pre-rival-lead";
    const decisionActions = [];

    if (match.canUseRolePower && match.selectedRole === "Negociante") {
      decisionActions.push({
        label: match.rolePowerButtonLabel,
        tone: "primary",
        onClick: match.negotiatePoints
      });
    }

    if (match.canCallEnvido) {
      decisionActions.push({
        label: "Envido",
        tone: decisionActions.length ? "secondary" : "primary",
        onClick: match.callEnvido
      });
    }

    if (match.canCallTruco) {
      decisionActions.push({
        label: match.trucoCallLabel ?? "Truco",
        tone: decisionActions.length ? "secondary" : "primary",
        onClick: match.callTruco
      });
    }

    if (match.canAdvance) {
      decisionActions.push({
        label: nextLabel,
        tone: decisionActions.length ? "secondary" : "primary",
        onClick: advanceHandler
      });
    }

    return (
      <footer className="bottom-dock bottom-dock-decision">
        <section className="decision-panel">
          <div className="decision-copy">
            <span className="panel-kicker">{isPreDecision ? "Antes de la salida" : "Salida rival"}</span>
            <strong>{isPreDecision ? "Decisión previa" : `${match.activeLane.rival.name} abre la vuelta`}</strong>
            <p>
              {isPreDecision
                ? `${match.activeLane.rival.name} sale primero. Podés usar tu rol ahora o dejar que muestre su carta.`
                : `Mirá qué carta baja ${match.activeLane.rival.name}; después respondés con una de tus cartas.`}
            </p>
          </div>

          {showWeaponsPanel ? (
            <div className="decision-weapons">
              {match.weaponHand.map((weapon) => (
                <WeaponButton key={weapon.handIndex} weapon={weapon} disabled={!match.canUseWeapon} onUse={match.useWeapon} />
              ))}
            </div>
          ) : null}

          <div className="decision-action-stack">
            {decisionActions.map((action) => (
              <button
                key={action.label}
                className={`action-button action-button-${action.tone} next-hand`}
                onClick={action.onClick}
                type="button"
              >
                {action.label}
              </button>
            ))}
          </div>
        </section>
      </footer>
    );
  }

  if (match.phase === "envido-resolution") {
    const pending = match.envidoPending;
    const winnerName = pending?.winner === "A" ? match.activeLane.human.name : match.activeLane.rival.name;

    return (
      <footer className="bottom-dock bottom-dock-decision">
        <section className="decision-panel envido-panel">
          <div className="decision-copy">
            <span className="panel-kicker">Lance de envido</span>
            <strong>{pending?.accepted ? "Se cantan los tantos" : "No quiso"}</strong>
            <p>
              {pending?.accepted
                ? `${match.activeLane.human.name} canta ${pending.humanValue}. ${match.activeLane.rival.name} canta ${pending.rivalValue}. Cobra ${winnerName}.`
                : `${match.activeLane.rival.name} no quiere. ${match.activeLane.human.name} cobra 1 punto y se sigue jugando.`}
            </p>
          </div>

          {pending?.accepted ? (
            <div className="envido-tantos">
              <article>
                <span>{match.activeLane.human.name}</span>
                <strong>{pending.humanValue}</strong>
              </article>
              <article>
                <span>{match.activeLane.rival.name}</span>
                <strong>{pending.rivalValue}</strong>
              </article>
            </div>
          ) : null}

          <button
            className="action-button action-button-primary next-hand"
            disabled={!match.canAdvance}
            onClick={advanceHandler}
            type="button"
          >
            {nextLabel}
          </button>
        </section>
      </footer>
    );
  }

  if (showResultPanel) {
    const resultTone = match.scoringWinner === "A" ? "win" : "lose";
    const resultTitle = match.matchWinner
      ? `${scoringWinnerName} gana la partida`
      : `${handWinnerName} gana la mano`;
    const resultCopy = match.matchWinner
      ? `La partida llego a ${match.config.winningScore}. Podes barajar una prueba nueva.`
      : match.pointsInverted
        ? `${handWinnerName} gano jugando, pero la negociacion hizo que cobre ${scoringWinnerName}.`
        : `${scoringWinnerName} cobra ${match.activeBet} ${match.activeBet === 1 ? "punto" : "puntos"}.`;

    return (
      <footer className="bottom-dock bottom-dock-result">
        <section className={`hand-result-panel hand-result-panel-${resultTone}`}>
          <div className="hand-result-copy">
            <span className="panel-kicker">{match.matchWinner ? "Partida cerrada" : "Mano cerrada"}</span>
            <strong>{resultTitle}</strong>
            <p>{resultCopy}</p>
          </div>

          <div className="hand-result-meta">
            <span>Vuelta {match.displayVueltaNumber}/3</span>
            <span>Vos {match.trickWins.A}</span>
            <span>{match.activeLane.rival.name} {match.trickWins.B}</span>
            <span>{match.pointsInverted ? "Cobro invertido" : "Cobro normal"}</span>
          </div>

          <button
            className="action-button action-button-primary next-hand"
            disabled={!match.canAdvance}
            onClick={advanceHandler}
            type="button"
          >
            {nextLabel}
          </button>
        </section>
      </footer>
    );
  }

  if (match.phase === "trick-closed") {
    const lastTrick = match.trickHistory[match.trickHistory.length - 1];
    const trickTone = lastTrick?.result === "tie" ? "draw" : lastTrick?.winner === "A" ? "win" : "lose";
    const nextLeader = getCurrentLeaderName(match);

    return (
      <footer className="bottom-dock bottom-dock-table-result">
        <section className={`table-result-panel table-result-panel-${trickTone}`}>
          <div className="table-result-copy">
            <span className="panel-kicker">Vuelta resuelta</span>
            <strong>{match.highlight}</strong>
            <p>Limpiá la mesa. La próxima vuelta la abre {nextLeader}.</p>
          </div>

          <button
            className="action-button action-button-primary next-hand"
            disabled={!match.canAdvance}
            onClick={advanceHandler}
            type="button"
          >
            {nextLabel}
          </button>
        </section>
      </footer>
    );
  }

  return (
    <footer className={showHandCards ? "bottom-dock bottom-dock-play" : "bottom-dock"}>
      <section className={showHandCards ? "hand-panel hand-panel-play hand-panel-focus" : handFocus ? "hand-panel hand-panel-focus" : "hand-panel"}>
        <div className="panel-header">
          <div>
            <span className="panel-kicker">{showHandCards ? "Acción disponible" : "Tu mano"}</span>
            <p>{getHandPanelCopy(match)}</p>
          </div>
          <div className="panel-header-actions">
            {showHandCards && !match.canPlayCard ? (
              <button className="view-toggle" onClick={() => setHandFocus((value) => !value)} type="button">
                {handFocus ? "Bajar mano" : "Mirar cartas"}
              </button>
            ) : null}
            <div className="duel-chip">
              {match.activeLane.human.name} vs {match.activeLane.rival.name}
            </div>
          </div>
        </div>

        {showHandCards ? (
          <div className="hand-fan">
            {match.humanHand.map((card, index) => {
              const midpoint = (match.humanHand.length - 1) / 2;

              return (
                <CardButton
                  key={card.handIndex}
                  card={card}
                  disabled={!match.canPlayCard}
                  offset={index - midpoint}
                  onPlay={match.playCard}
                />
              );
            })}
          </div>
        ) : (
          <div className="hand-empty">
            <strong>
              {match.phase === "role-select"
                ? "Rol sin confirmar."
                : match.phase === "table-auto-turn"
                  ? "Turno de la mesa."
                  : match.matchWinner
                    ? "Partida cerrada."
                    : "Mano cerrada."}
            </strong>
            <p>
              {match.phase === "role-select"
                ? "Arranca la mano para repartir tus cartas."
                : match.phase === "table-auto-turn"
                  ? `Le toca a ${match.nextActorName}. Usá el botón para avanzar la ronda.`
                : match.matchWinner
                  ? "El marcador ya definio la partida."
                  : "Cobra el punto y pasa a la siguiente mano."}
            </p>
          </div>
        )}
      </section>

      <section className={showUtilityPanel ? "utility-row" : "utility-row utility-row-solo"}>
        {showWeaponsPanel ? (
          <div className="weapons-panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">Armas de Cartachin</span>
                <p>
                  {match.activeWeapon
                    ? `Activa: ${match.activeWeapon.name}.`
                    : match.canUseWeapon
                      ? "Elegi un arma antes de jugar la primera carta."
                      : match.weaponUsed
                        ? "Ya cargaste el arma de esta mano."
                        : "En esta fase no podes cargar armas."}
                </p>
              </div>
            </div>

            <div className="weapon-grid">
              {match.weaponHand.map((weapon) => (
                <WeaponButton
                  key={weapon.handIndex}
                  weapon={weapon}
                  disabled={!match.canUseWeapon}
                  onUse={match.useWeapon}
                />
              ))}
            </div>
          </div>
        ) : null}

        <button
          className="action-button action-button-primary next-hand"
          disabled={!match.canAdvance}
          onClick={advanceHandler}
          type="button"
        >
          {nextLabel}
        </button>
      </section>
    </footer>
  );
}

export function Hud({ match, cameraView = "table", onReturnToTable }) {
  const [handFocus, setHandFocus] = useState(false);
  const tone = getRoleTone(match);
  const isAwayFromTable = match.handStarted && cameraView === "entry";
  const hudClassName = [
    "hud",
    `hud-role-${tone.slug}`,
    match.phase === "role-select" ? "hud-role-select" : "",
    isAwayFromTable ? "hud-away-from-table" : "",
    match.handStarted && !match.handClosed ? "hud-hand-active" : "",
    match.canPlayCard ? "hud-can-play" : ""
  ].filter(Boolean).join(" ");

  return (
    <div className={hudClassName}>
      <div className="hud-top-stack">
        <Header match={match} />
        <RoleSelector match={match} />
      </div>

      <div className="hud-center">
        {isAwayFromTable ? (
          <AwayFromTablePanel match={match} onReturnToTable={onReturnToTable} />
        ) : (
          <>
            <ActionFocus match={match} />
            <TableFlowPanel match={match} />
            <StatusStrip match={match} />
            <RolePowerBar match={match} />
          </>
        )}
      </div>

      {isAwayFromTable ? null : <TableSpotlight match={match} />}
      {isAwayFromTable ? null : <BottomDock match={match} handFocus={handFocus} setHandFocus={setHandFocus} />}
    </div>
  );
}
