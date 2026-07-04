import { useState } from "react";
import { createPortal } from "react-dom";
import { useEffect } from "react";
import { sfx } from "../audio/sfx";
import { getCardRankLabel, getCardRankNumber, getCardSuitCode } from "../data/cards";
import { roleDefinitions } from "../data/characters";
import { GAME_MODES } from "../config";

const BOTTOM_OWNED_ADVANCE_PHASES = ["pre-rival-lead", "rival-leads", "trick-closed"];

const roleTone = {
  Negociante: {
    slug: "negociante",
    tableName: "La caja",
    seal: "BANCO"
  },
  "Jugador Estrella": {
    slug: "jugador-estrella",
    tableName: "La fama",
    seal: "HYPE"
  },
  Cartachin: {
    slug: "cartachin",
    tableName: "La mugre fina",
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

function AmbientAudio() {
  useEffect(() => {
    const start = () => {
      sfx.ensure();
      sfx.ambient();
    };
    window.addEventListener("pointerdown", start, { once: true });
    return () => window.removeEventListener("pointerdown", start);
  }, []);
  return null;
}

function Header({ match }) {
  const subtitle = match.phase === "role-select"
    ? "Elegí rol."
    : match.handClosed
    ? "Mano cerrada."
    : `Sale ${match.nextActorName ?? match.whoStartsName}.`;
  const scoreNames = match.phase === "role-select"
    ? `Reparte ${match.dealerName} · sale ${match.whoStartsName}`
    : `${match.activeLane.human.name} vs ${match.activeLane.rival.name}`;

  const isRoleSelect = match.phase === "role-select";

  return (
    <header className={isRoleSelect ? "hud-top hud-top-select" : "hud-top hud-top-compact"}>
      <div className="title-block">
        <h1>TRUCOLOCO</h1>
        {isRoleSelect ? null : (
          <div className="title-sub">
            <span className={`mode-chip mode-chip-${match.gameMode}`}>{match.gameModeInfo.label}</span>
            <p>{subtitle}</p>
          </div>
        )}
      </div>

      {isRoleSelect ? null : (
        <div className="scoreboard">
          <span className="score-label">Mano {match.handNumber} · Mano vale {match.activeBet}</span>
          <strong key={`${match.scores.A}-${match.scores.B}`} className="score-pop">
            {match.scores.A} - {match.scores.B}
          </strong>
          <span className="score-names">{scoreNames}</span>
          <span className="score-label">primero a {match.config.winningScore}</span>
        </div>
      )}
    </header>
  );
}

function RoleSelector({ match, multiplayer }) {
  const selectedRoleDef = roleDefinitions[match.selectedRole];
  const selectedCharacter = match.selectedCharacter ?? match.activeLane.human;
  const inSala = Boolean(multiplayer?.active);
  const salaConnected = Boolean(multiplayer?.connected ?? inSala);
  const hasSalaSeat = Boolean(multiplayer?.mySeat);
  const hostCanStartSala = inSala && salaConnected && multiplayer?.isHost && hasSalaSeat && match.canAdvance;
  const selectedSeatLabel = multiplayer?.mySeat ? `${multiplayer.mySeat.label} · ${multiplayer.mySeat.role}` : "";
  const primaryActionLabel = inSala && !salaConnected
    ? "Conectando a sala..."
    : !inSala
    ? "Probar solo (vs bots)"
    : hasSalaSeat
      ? multiplayer?.isHost
        ? "Repartir mano en sala"
        : "Esperando al anfitrión"
      : "Reclamar silla para jugar";
  const primaryActionSub = inSala && !salaConnected
    ? `Sala ${multiplayer?.roomCode ?? ""} · entrando por link`
    : !inSala
    ? `Modo de prueba · ${selectedCharacter.name} · ${match.selectedRole}`
    : hasSalaSeat
      ? multiplayer?.isHost
        ? `Sala ${multiplayer.roomCode} · ${selectedSeatLabel}`
        : `Sala ${multiplayer.roomCode} · ya tenés silla`
      : `Sala ${multiplayer?.roomCode ?? ""} · elegí lugar y compartí link`;
  const startSelectedRole = () => {
    if (!match.canAdvance) return;
    match.startHand();
  };
  const runPrimaryAction = () => {
    if (inSala && !salaConnected) return;
    if (!inSala) {
      startSelectedRole();
      return;
    }
    if (hasSalaSeat) {
      multiplayer?.startRoomHand?.();
      return;
    }
    multiplayer?.claimSelectedSeat?.();
  };
  const primaryDisabled = inSala && !salaConnected ? true : !inSala ? !match.canAdvance : hasSalaSeat ? !hostCanStartSala : false;

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
        <div className="role-lock-actions">
          <span className="role-spotlight-tag">{selectedRoleDef.powerName}</span>
          {match.returnToRoleSelect ? (
            <button
              className="role-change-button"
              disabled={inSala && !multiplayer?.isHost}
              onClick={match.returnToRoleSelect}
              type="button"
            >
              Cambiar rol
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  const canChangeMode = !inSala || multiplayer?.isHost;

  return (
    <section className="role-selector role-selector-arcade">
      <div className="mode-select">
        <span className="panel-kicker">Modo de juego</span>
        <div className="mode-card-row">
          {Object.values(GAME_MODES).map((mode) => {
            const active = match.gameMode === mode.id;

            return (
              <button
                key={mode.id}
                className={[
                  "mode-card",
                  `mode-card-${mode.id}`,
                  active ? "mode-card-active" : ""
                ].filter(Boolean).join(" ")}
                disabled={!canChangeMode && !active}
                onClick={() => match.setGameMode(mode.id)}
                type="button"
              >
                <strong>{mode.label}</strong>
                <small>{mode.tagline}</small>
              </button>
            );
          })}
        </div>
      </div>

      <div className="role-select-hero">
        <span className="panel-kicker">Paso 2 · Rol y personaje</span>
        <h2>Elegí rol</h2>
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
            const lockedBySala = multiplayer?.lockedCharacterIds?.has(character.id) && character.id !== multiplayer?.myCharacterId;

            return (
              <button
                key={character.id}
                className={[
                  "character-card",
                  active ? "character-card-active" : "",
                  lockedBySala ? "character-card-locked" : ""
                ].filter(Boolean).join(" ")}
                disabled={lockedBySala || (!match.canSwitchRole && !active)}
                onClick={() => match.selectCharacter(character.id)}
                style={{ "--character-accent": character.accent }}
                type="button"
              >
                <span className="character-card-mark" aria-hidden="true" />
                <strong>{character.name}</strong>
                <small>{lockedBySala ? "Ocupado en sala" : character.role}</small>
              </button>
            );
          })}
        </div>
      </div>

      <article className="role-ready-strip">
        <p className="role-ready-hint">
          {inSala
            ? hasSalaSeat
              ? multiplayer?.isHost
                ? "Ya tenés silla. Repartí cuando los pibes estén sentados."
                : "Ya tenés silla. El anfitrión arranca la mano compartida."
              : "Para jugar con amigos, reclamá tu silla y pasá el link de la sala."
            : "Elegí tu rol y personaje. Podés probar solo o crear sala para amigos."}
        </p>
        {multiplayer?.notice ? <p className="role-ready-notice">{multiplayer.notice}</p> : null}
        <div className="role-ready-actions">
          <button
            className={inSala ? "role-test-button role-test-button-room" : "role-test-button"}
            disabled={primaryDisabled}
            onClick={runPrimaryAction}
            type="button"
          >
            <span className="role-test-main">{primaryActionLabel}</span>
            <span className="role-test-sub">{primaryActionSub}</span>
          </button>
          {inSala && salaConnected ? (
            <button className="role-secondary-button" onClick={multiplayer?.leaveSala} type="button">
              Salir de sala
            </button>
          ) : null}
        </div>
      </article>
    </section>
  );
}

function ActionFocus({ match }) {
  if (match.phase === "role-select") {
    return null;
  }

  const focusState = getFocusState(match);
  const focusButtons = [];
  const advanceHandler = getAdvanceHandler(match);
  const trucoActionLabel = match.trucoCallLabel ?? "Truco";

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
        <span className="panel-kicker">Turno</span>
        <strong className="role-power-title">{focusState.summary}</strong>
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

  const focusSeats = match.tableFlow.seats.filter((seat) =>
    seat.isActing || seat.isSelectedDuel || seat.isMano || seat.isDealer
  );

  return (
    <section className="table-flow-panel">
      <div className="table-flow-head">
        <span className="panel-kicker">Mesa 3v3</span>
        <strong>Foco actual</strong>
      </div>
      <div className="table-flow-seats">
        {focusSeats.map((seat) => {
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
      summary: `Sale ${match.whoStartsName}.`,
      tone: "neutral"
    };
  }

  if (match.matchWinner) {
    return {
      badge: "Partida cerrada",
      summary: `Gana ${getTeamName(match.matchWinner, match)}.`,
      tone: "neutral"
    };
  }

  if (match.handClosed) {
    return {
      badge: match.handWinner === "A" ? "Mano ganada" : "Mano perdida",
      summary: match.pointsInverted
        ? `Cobra ${getTeamName(match.scoringWinner, match)}.`
        : `Cobra ${getTeamName(match.scoringWinner, match)}.`,
      tone: match.scoringWinner === "A" ? "win" : "lose"
    };
  }

  if (match.phase === "envido-resolution") {
    const pending = match.envidoPending;
    const winnerName = pending?.winner === "A" ? match.activeLane.human.name : match.activeLane.rival.name;

    return {
      badge: pending?.accepted ? "Envido querido" : "Envido no querido",
      summary: pending?.accepted
        ? `${pending.humanValue}-${pending.rivalValue}. Cobra ${winnerName}.`
        : `Cobra ${match.activeLane.human.name}.`,
      tone: pending?.winner === "A" ? "win" : "lose"
    };
  }

  if (match.phase === "truco-response") {
    return {
      badge: "Te apuran",
      summary: `${match.trucoPending?.label ?? "Truco"}.`,
      tone: "neutral"
    };
  }

  if (match.phase === "trick-closed") {
    const lastTrick = match.trickHistory[match.trickHistory.length - 1];
    const winnerName = getTrickWinnerName(lastTrick, match);

    if (lastTrick?.result === "tie") {
      return {
        badge: "Vuelta parda",
        summary: `Sigue ${winnerName}.`,
        tone: "draw"
      };
    }

    return {
      badge: lastTrick?.winner === "A" ? "Vuelta ganada" : "Vuelta perdida",
      summary: `Sale ${winnerName}.`,
      tone: lastTrick?.winner === "A" ? "win" : "lose"
    };
  }

  if (match.phase === "rival-leads") {
    return {
      badge: "Turno rival",
      summary: `Juega ${match.activeLane.rival.name}.`,
      tone: "neutral"
    };
  }

  if (match.phase === "pre-rival-lead") {
    return {
      badge: "Decidis vos",
      summary: `Antes de ${match.activeLane.rival.name}.`,
      tone: "neutral"
    };
  }

  if (match.phase === "answer-rival") {
    return {
      badge: "Tu respuesta",
      summary: `Respondé con carta.`,
      tone: "neutral"
    };
  }

  if (match.phase === "table-auto-turn") {
    if ((match.canUseRolePower || match.canUseWeapon) && match.tableCards.length === 0) {
      return {
        badge: "Antes de la primera carta",
        summary: `Antes de ${match.nextActorName}.`,
        tone: "neutral"
      };
    }

    return {
      badge: "Mesa",
      summary: `Juega ${match.nextActorName}.`,
      tone: "neutral"
    };
  }

  if (match.phase === "table-human-turn") {
    if ((match.canUseRolePower || match.canUseWeapon) && match.tableCards.length === 0) {
      return {
        badge: "Tu turno",
        summary: "Rol o carta.",
        tone: "neutral"
      };
    }

    return {
      badge: "Tu turno",
      summary: "Bajá carta.",
      tone: "neutral"
    };
  }

  return {
    badge: "Tu turno",
    summary: `Vuelta ${match.displayVueltaNumber}.`,
    tone: "neutral"
  };
}

function getShortCardName(card) {
  return card?.name?.replace(" de ", " ") ?? "";
}

function getSuitClass(card) {
  return `suit-${(card?.suit ?? "neutral").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function TableCard({ card, label, order }) {
  const delta = card.powerDelta ?? 0;
  const modifierCopy = delta ? (delta > 0 ? "Potenciada" : "Debilitada") : null;
  const hasCardImage = Boolean(card.image);

  return (
    <article
      className={`table-card table-card-${card.side?.toLowerCase() ?? "neutral"} ${hasCardImage ? "table-card-image" : ""} ${getSuitClass(card)}`}
      style={{ "--card-accent": card.tone }}
    >
      <span className="table-card-order">{order}</span>
      {hasCardImage ? (
        <img className="table-card-art" src={card.image} alt="" draggable="false" />
      ) : (
        <>
          <span className="table-card-corner">
            <strong>{getCardRankNumber(card)}</strong>
            <small>{getCardSuitCode(card)}</small>
          </span>
          <span className="table-card-emblem" aria-hidden="true" />
          <strong className="table-card-name">{card.name}</strong>
          <small>{card.suit}</small>
          <span className="table-card-suit-mark">{getCardSuitCode(card)}</span>
        </>
      )}
      <span className="table-card-owner">{label}</span>
      {modifierCopy ? <span className="table-card-force">{modifierCopy}</span> : null}
    </article>
  );
}

function TableShowdown({ match }) {
  const lastTrick = match.tableCards.length >= 6 ? match.trickHistory[match.trickHistory.length - 1] : null;
  const resultCopy = getTableResultCopy(match, lastTrick);
  const isClosed = match.phase === "trick-closed" || match.tableCards.length >= 6;

  return (
    <section className={isClosed ? "table-showdown table-showdown-closed" : "table-showdown"}>
      <div className="table-showdown-head">
        <span className="panel-kicker">V{match.displayVueltaNumber} · derecha</span>
        <strong>{resultCopy}</strong>
      </div>

      <div className="table-card-row table-card-row-six">
        {match.tableCards.map((card, index) => (
          <TableCard key={`${card.seatId}-${card.handIndex}`} card={card} label={card.owner} order={index + 1} />
        ))}
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
    return `${match.tableCards.length}/6 · ${match.nextActorName ?? "Mesa"}.`;
  }

  if (match.nextActorName) return `Sale ${match.nextActorName}.`;
  if (match.handClosed) return "La mano ya cerro.";
  return "Mesa limpia.";
}

function TableSpotlight({ match }) {
  return null;
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
          const summary = winningCard?.card?.name ?? winningCard?.name ?? getShortCardName(trick.humanCard);
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
  if (match.phase === "role-select" || match.handClosed || match.matchWinner || !match.trickHistory.length) {
    return null;
  }

  return (
    <section className="status-strip">
      <article className="status-card status-card-wide">
        <TrickLedger match={match} />
      </article>
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
      <strong>Volvé a la mesa.</strong>
      <button className="action-button action-button-primary" onClick={onReturnToTable} type="button">
        Volver a la mesa
      </button>
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

  return createPortal(
    <footer className="bottom-dock bottom-dock-decision bottom-dock-truco">
      <section className="decision-panel truco-response-panel">
        <div className="decision-copy">
          <span className="panel-kicker">Truco</span>
          <strong>{pending.label}</strong>
          <p>Quiere: {pending.acceptedBet}. No quiere: {pending.rejectedPoints} para {callerName}.</p>
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
    </footer>,
    document.body
  );
}

const RIVAL_REJECT_LINES = [
  "Ni en pedo. Emparejá y hablamos.",
  "¿Me viste cara de gil? Mejorá la oferta.",
  "Última chance: no me saqués nada."
];

function AgreementPill({ match }) {
  const [deltaSelf, setDeltaSelf] = useState(0);
  const [deltaRival, setDeltaRival] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [rivalSays, setRivalSays] = useState(null);
  const [thinking, setThinking] = useState(false);

  const open =
    match.selectedRole === "Negociante" &&
    match.handClosed &&
    !match.matchWinner &&
    !match.agreementApplied &&
    Boolean(match.applyAgreement);

  if (!open) return null;

  const clamp = (value) => Math.max(-2, Math.min(2, value));
  const fmt = (value) => (value > 0 ? `+${value}` : `${value}`);
  const rivalName = match.activeLane.rival.name;
  const outOfChances = attempts >= RIVAL_REJECT_LINES.length;

  // la logica del voto: el rival firma solo si no pierde — no le sacas puntos
  // y no te das mas de lo que le das a el
  const rivalAccepts = deltaRival >= 0 && deltaSelf <= deltaRival + 0 && deltaSelf <= 1;

  const propose = () => {
    if (thinking) return;
    setThinking(true);
    setRivalSays(`${rivalName} lo piensa…`);
    window.setTimeout(() => {
      setThinking(false);
      if (rivalAccepts) {
        match.applyAgreement(deltaSelf, deltaRival);
      } else {
        setRivalSays(`${rivalName}: —${RIVAL_REJECT_LINES[Math.min(attempts, RIVAL_REJECT_LINES.length - 1)]}`);
        setAttempts((value) => value + 1);
      }
    }, 750);
  };

  return createPortal(
    <div className="agreement-pill">
      <div className="agreement-title">ACUERDO DE NEGOCIANTES</div>
      <div className="agreement-body">
        <div className="agreement-side">
          <span>Vos</span>
          <button className="agreement-step" onClick={() => setDeltaSelf((v) => clamp(v - 1))} type="button">−</button>
          <strong>{fmt(deltaSelf)}</strong>
          <button className="agreement-step" onClick={() => setDeltaSelf((v) => clamp(v + 1))} type="button">+</button>
        </div>
        <div className="agreement-side">
          <span>{rivalName}</span>
          <button className="agreement-step" onClick={() => setDeltaRival((v) => clamp(v - 1))} type="button">−</button>
          <strong>{fmt(deltaRival)}</strong>
          <button className="agreement-step" onClick={() => setDeltaRival((v) => clamp(v + 1))} type="button">+</button>
        </div>
        {outOfChances ? (
          <button className="canto-chip canto-chip-advance" onClick={() => match.applyAgreement(0, 0)} type="button">
            Cobro automático
          </button>
        ) : (
          <button className="canto-chip canto-chip-gold" disabled={thinking} onClick={propose} type="button">
            {thinking ? "…" : "Proponer"}
          </button>
        )}
      </div>
      {rivalSays ? <div className="agreement-says">{rivalSays}</div> : null}
    </div>,
    document.body
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
    return "Confirmá rol.";
  }

  if (match.matchWinner) {
    return "Partida cerrada.";
  }

  if (match.phase === "envido-resolution") {
    return "Resolver envido.";
  }

  if (match.canPlayCard) {
    if (match.canCallEnvido && match.canCallTruco) return `Envido, ${trucoActionLabel} o carta.`;
    if (match.canCallTruco) return `${trucoActionLabel} o carta.`;
    return "Elegí carta.";
  }

  if (match.phase === "table-auto-turn") {
    return `Juega ${match.nextActorName}.`;
  }

  if (match.canAdvance && match.phase === "rival-leads") {
    return `Sale ${match.activeLane.rival.name}.`;
  }

  if (match.phase === "pre-rival-lead") {
    return "Rol o pasar.";
  }

  if (match.canAdvance && match.phase === "trick-closed") {
    return "Vuelta cerrada.";
  }

  if (match.handClosed) {
    return "Mano cerrada.";
  }

  return "Esperá turno.";
}

function BottomDock({ match, handFocus, setHandFocus }) {
  const nextLabel = match.advanceLabel ?? (match.matchWinner ? "Nueva partida" : match.handClosed ? "Siguiente mano" : "Seguir");
  const advanceHandler = getAdvanceHandler(match);
  const showWeaponsPanel =
    match.handStarted &&
    !match.handClosed &&
    match.selectedRole === "Cartachin" &&
    (match.canUseWeapon || match.activeWeapon || match.weaponUsed);
  const showHandCards = match.handStarted && !match.handClosed && !match.matchWinner && match.humanHand.length > 0;
  const handPanelClassName = [
    "hand-panel",
    showHandCards ? "hand-panel-focus" : handFocus ? "hand-panel-focus" : "",
    showHandCards && match.canPlayCard ? "hand-panel-play" : "",
    showHandCards && !match.canPlayCard ? "hand-panel-preview" : ""
  ].filter(Boolean).join(" ");
  const handWinnerName = getTeamLabel(match.handWinner);
  const scoringWinnerName = getTeamLabel(match.scoringWinner);
  const showResultPanel = match.handStarted && (match.handClosed || match.matchWinner);
  const showUtilityPanel = showResultPanel || showWeaponsPanel;

  if (match.phase === "role-select") {
    return null;
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
            <span className="panel-kicker">{isPreDecision ? "Antes" : "Salida"}</span>
            <strong>{isPreDecision ? "Rol o pasar" : `Sale ${match.activeLane.rival.name}`}</strong>
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
            <span className="panel-kicker">Envido</span>
            <strong>{pending?.accepted ? `Cobra ${winnerName}` : `${match.activeLane.human.name} cobra 1`}</strong>
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
      ? `A ${match.config.winningScore}.`
      : match.pointsInverted
        ? `Cobra ${scoringWinnerName}.`
        : `${scoringWinnerName} cobra ${match.activeBet}.`;

    return (
      <>
        <AgreementPill match={match} />
        {createPortal(
          <footer className="bottom-dock bottom-dock-result result-dock-right">
            <section className={`hand-result-panel hand-result-panel-${resultTone}`}>
          <div className="hand-result-copy">
            <strong>{resultTitle}</strong>
            <p>{resultCopy}</p>
          </div>


          {match.canSwitchRole && !match.matchWinner ? (
            <div className="role-switch-row">
              <span className="role-switch-label">Rol para la próxima</span>
              {match.roleOptions.map((role) => (
                <button
                  key={role}
                  className={
                    role === match.selectedRole
                      ? "canto-chip canto-chip-role canto-chip-role-active"
                      : "canto-chip canto-chip-role"
                  }
                  onClick={() => match.selectRole(role)}
                  type="button"
                >
                  {role}
                </button>
              ))}
            </div>
          ) : null}

          <button
            className="action-button action-button-primary next-hand"
            disabled={!match.canAdvance || (match.selectedRole === "Negociante" && !match.matchWinner && !match.agreementApplied)}
            onClick={advanceHandler}
            type="button"
          >
            {match.selectedRole === "Negociante" && !match.matchWinner && !match.agreementApplied ? "Falta el acuerdo" : nextLabel}
          </button>
        </section>
          </footer>,
          document.body
        )}
      </>
    );
  }

  if (match.phase === "trick-closed") {
    const lastTrick = match.trickHistory[match.trickHistory.length - 1];
    const trickTone = lastTrick?.result === "tie" ? "draw" : lastTrick?.winner === "A" ? "win" : "lose";
    const nextLeader = getCurrentLeaderName(match);

    return (
      <footer className="bottom-dock bottom-dock-table-result">
        <section className={`table-result-panel table-result-panel-${trickTone}`}>
          <TableShowdown match={match} />

          <div className="table-result-copy">
            <span className="panel-kicker">Vuelta resuelta</span>
            <strong>{match.highlight}</strong>
            <p>Sigue {nextLeader}.</p>
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
    <footer className={showHandCards && match.canPlayCard ? "bottom-dock bottom-dock-play" : "bottom-dock"}>
      {match.handStarted && !match.handClosed && !match.matchWinner ? createPortal(
        <div className="canto-bar">
          <span className="canto-copy">{getHandPanelCopy(match)}</span>
          {match.canCallEnvido ? (
            <button className="canto-chip canto-chip-envido" onClick={match.callEnvido} type="button">
              Envido
            </button>
          ) : null}
          {match.canCallTruco ? (
            <button className="canto-chip canto-chip-truco" onClick={match.callTruco} type="button">
              {match.trucoCallLabel ?? "Truco"}
            </button>
          ) : null}
          {match.canUseWeapon
            ? match.weaponHand.map((weapon) => (
                <button
                  key={weapon.handIndex}
                  className="canto-chip canto-chip-weapon"
                  title={weapon.summary}
                  onClick={() => match.useWeapon(weapon.handIndex)}
                  type="button"
                >
                  {weapon.name}
                </button>
              ))
            : null}
          {!match.canPlayCard && match.canAdvance ? (
            <button className="canto-chip canto-chip-advance" onClick={advanceHandler} type="button">
              {nextLabel}
            </button>
          ) : null}
        </div>,
        document.body
      ) : null}
      <section className={handPanelClassName}>
        <div className="panel-header">
          <div>
            <span className="panel-kicker">{match.canPlayCard ? "Acción" : "Tu mano"}</span>
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
                  ? `Juega ${match.nextActorName}.`
                  : match.matchWinner
                    ? "Partida cerrada."
                    : "Mano cerrada."}
            </strong>
            <p>
              {match.phase === "role-select"
                ? "Repartí cartas."
                : match.phase === "table-auto-turn"
                  ? "Avanzá mesa."
                : match.matchWinner
                  ? "Marcador cerrado."
                  : "Siguiente mano."}
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

export function Hud({ match, cameraView = "table", onReturnToTable, multiplayer }) {
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
        <AmbientAudio />
      <Header match={match} />
        <RoleSelector match={match} multiplayer={multiplayer} />
      </div>

      <div className="hud-center">
        {isAwayFromTable ? (
          <AwayFromTablePanel match={match} onReturnToTable={onReturnToTable} />
        ) : (
          <>
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
