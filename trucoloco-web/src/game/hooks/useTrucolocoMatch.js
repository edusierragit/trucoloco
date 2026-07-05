import { useMemo, useState } from "react";
import { MATCH_CONFIG } from "../config";
import { bonusCards, deck, modifiers } from "../data/cards";
import {
  characterOptionsByRole,
  roleDefinitions,
  roleOptions as availableRoles,
  tableSeats,
  teams
} from "../data/characters";
import { weaponPool } from "../data/weapons";
import {
  PARDA,
  applyHandPoints,
  awardPoints,
  getAdvantageTeam,
  getHandWinner,
  getMatchWinner,
  getPardaCount,
  getPlayerName,
  getWeaponPowerAdjustment,
  resolveEnvido
} from "../rules/truco";

const CLASSIC_MODIFIER = modifiers.find((modifier) => modifier.id === "modo-clasico") ?? modifiers[0];

const shuffle = (items) => {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
};

const getCharacterTeam = (characterId) => {
  if (teams.A.some((player) => player.id === characterId)) return "A";
  if (teams.B.some((player) => player.id === characterId)) return "B";
  return "A";
};

const getLanePair = (role, selectedHuman = null) => {
  const selectedTeam = selectedHuman ? getCharacterTeam(selectedHuman.id) : "A";
  const rivalTeam = selectedTeam === "A" ? "B" : "A";
  const fallbackHuman = teams.A.find((player) => player.role === role) ?? teams.A[0];
  const rival =
    teams[rivalTeam].find((player) => player.role === role && player.id !== selectedHuman?.id) ??
    teams[rivalTeam].find((player) => player.role === role) ??
    teams.B.find((player) => player.role === role) ??
    teams.B[0];

  return {
    role,
    human: selectedHuman ?? fallbackHuman,
    rival
  };
};

const getDefaultCharacterIdsByRole = () =>
  availableRoles.reduce((lookup, role) => {
    lookup[role] = characterOptionsByRole[role]?.[0]?.id ?? getLanePair(role).human.id;
    return lookup;
  }, {});

const getSelectedCharacterForRole = (role, characterId) => {
  const options = characterOptionsByRole[role] ?? [];
  return options.find((character) => character.id === characterId) ?? options[0] ?? getLanePair(role).human;
};

const getPlayersById = () =>
  [...teams.A, ...teams.B].reduce((lookup, player) => {
    lookup[player.id] = player;
    return lookup;
  }, {});

const getSeatByTeamRole = (team, role) =>
  tableSeats.find((seat) => seat.team === team && seat.role === role) ?? tableSeats[0];
const getSeatById = (seatId) => tableSeats.find((seat) => seat.seatId === seatId) ?? tableSeats[0];
const getPlayerBySeatId = (seatId) => {
  const seat = getSeatById(seatId);
  return getPlayersById()[seat.playerId];
};

const getSeatPlayerName = (seatId) => getPlayerBySeatId(seatId)?.name ?? "Jugador";

const getNextSeatId = (seatId) => {
  const orderedSeats = [...tableSeats].sort((a, b) => a.tableOrder - b.tableOrder);
  const currentIndex = Math.max(
    0,
    orderedSeats.findIndex((seat) => seat.seatId === seatId)
  );
  return orderedSeats[(currentIndex + 1) % orderedSeats.length].seatId;
};

const getPreviousSeatId = (seatId) => {
  const orderedSeats = [...tableSeats].sort((a, b) => a.tableOrder - b.tableOrder);
  const currentIndex = Math.max(
    0,
    orderedSeats.findIndex((seat) => seat.seatId === seatId)
  );
  return orderedSeats[(currentIndex - 1 + orderedSeats.length) % orderedSeats.length].seatId;
};

const getManoSeatForHand = (handNumber) => {
  const orderedSeats = [...tableSeats].sort((a, b) => a.tableOrder - b.tableOrder);
  return orderedSeats[(handNumber - 1) % orderedSeats.length] ?? orderedSeats[0];
};

const getSelectedSeatId = (role) => getSeatByTeamRole("A", role).seatId;
const getOppositeSeatId = (role) => getSeatByTeamRole("B", role).seatId;

const buildTableFlow = (state, activeLane, selectedRole, nextActorName) => {
  const playersById = getPlayersById();
  const manoSeat = state.manoSeatId ? getSeatById(state.manoSeatId) : getManoSeatForHand(state.handNumber);
  const dealerSeat = getSeatById(getPreviousSeatId(manoSeat.seatId));
  const actingSeat = state.currentTurnSeatId
    ? getSeatById(state.currentTurnSeatId)
    : tableSeats.find((seat) => playersById[seat.playerId]?.name === nextActorName);
  const orderedSeats = [...tableSeats].sort((a, b) => a.tableOrder - b.tableOrder);

  return {
    manoSeatId: manoSeat.seatId,
    dealerSeatId: dealerSeat.seatId,
    actingSeatId: actingSeat?.seatId ?? null,
    seats: orderedSeats.map((seat) => {
      const player = playersById[seat.playerId];

      return {
        ...seat,
        player,
        isSelectedDuel: seat.role === selectedRole,
        isMano: seat.seatId === manoSeat.seatId,
        isDealer: seat.seatId === dealerSeat.seatId,
        isActing: seat.seatId === actingSeat?.seatId
      };
    })
  };
};

const getRoleOpeningLog = (activeLane, whoStartsName) => {
  if (activeLane.role === "Negociante") {
    return `Sale ${whoStartsName}. Negociacion disponible.`;
  }

  if (activeLane.role === "Cartachin") {
    return `Sale ${whoStartsName}. Arma disponible.`;
  }

  return `Sale ${whoStartsName}. Mano limpia.`;
};

const buildSharedPool = () => shuffle(deck);

const buildHandIndex = (cardId, side, index) => `${cardId}-${side}-${index}-${Math.random()}`;

const drawWeapons = () =>
  shuffle(weaponPool)
    .slice(0, 2)
    .map((weapon, index) => ({
      ...weapon,
      handIndex: `${weapon.id}-${index}-${Math.random()}`
    }));

const dealSeatHands = (pool) => {
  const orderedSeats = [...tableSeats].sort((a, b) => a.tableOrder - b.tableOrder);

  const hands = orderedSeats.reduce((acc, seat, seatIndex) => {
    acc[seat.seatId] = pool.slice(seatIndex * 3, seatIndex * 3 + 3).map((card, cardIndex) => ({
      ...card,
      handIndex: buildHandIndex(card.id, seat.seatId, cardIndex)
    }));
    return acc;
  }, {});

  // Mazo Trucoloco: el Jugador Estrella de cada equipo recibe UNA carta
  // absurda que le gana el lugar a su carta mas baja (canon: solo una por
  // mano y reemplaza, no se suma)
  for (const seat of orderedSeats) {
    if (seat.role !== "Jugador Estrella") continue;
    const bonus = bonusCards[Math.floor(Math.random() * bonusCards.length)];
    const hand = hands[seat.seatId];
    const lowestIndex = hand.reduce(
      (lowest, cardItem, index) => (cardItem.power < hand[lowest].power ? index : lowest),
      0
    );
    hand[lowestIndex] = { ...bonus, handIndex: buildHandIndex(bonus.id, seat.seatId, 9) };
  }

  return hands;
};

const pickAutoCard = (hand, currentTrickCards) => {
  if (!hand.length) return null;
  const sortedByPower = [...hand].sort((a, b) => a.power - b.power);
  const highestOnTable = Math.max(...currentTrickCards.map((play) => play.power ?? play.card.power), 0);
  return sortedByPower.find((card) => card.power > highestOnTable) ?? sortedByPower[0];
};

const resolveTableTrick = (tableCards, trickHistory, manoTeam, currentLeadSeatId) => {
  const maxPower = Math.max(...tableCards.map((play) => play.power ?? play.card.power), 0);
  const topCards = tableCards.filter((play) => (play.power ?? play.card.power) === maxPower);

  if (topCards.length > 1) {
    const tiedTeams = new Set(topCards.map((play) => play.team));

    if (tiedTeams.size === 1) {
      const [winningPlay] = topCards;

      return {
        result: winningPlay.team,
        winner: winningPlay.team,
        winnerSeatId: winningPlay.seatId,
        highlight: `${winningPlay.owner} gana la vuelta para su equipo.`,
        outcomeTone: winningPlay.team === "A" ? "win" : "lose"
      };
    }

    const winner = getAdvantageTeam(trickHistory, manoTeam);
    const winnerSeatId = tableCards.find((play) => play.team === winner)?.seatId ?? currentLeadSeatId;

    return {
      result: PARDA,
      winner,
      winnerSeatId,
      highlight: "Vuelta parda.",
      outcomeTone: "draw"
    };
  }

  const [winningPlay] = topCards;

  return {
    result: winningPlay.team,
    winner: winningPlay.team,
    winnerSeatId: winningPlay.seatId,
    highlight: `${winningPlay.owner} gana la vuelta.`,
    outcomeTone: winningPlay.team === "A" ? "win" : "lose"
  };
};

const getBestCardPower = (hand) => Math.max(...hand.map((card) => card.power), 0);

const syncLaneHands = (state, selectedRole) => {
  const selectedSeatId = getSelectedSeatId(selectedRole);
  const oppositeSeatId = getOppositeSeatId(selectedRole);

  return {
    ...state,
    humanHand: state.handsBySeat?.[selectedSeatId] ?? [],
    rivalHand: state.handsBySeat?.[oppositeSeatId] ?? []
  };
};

const describeWeaponEffect = (effect) => {
  if (!effect) return "";
  return effect.delta > 0 ? `${effect.weaponName} empuja esa carta.` : `${effect.weaponName} ensucia esa carta rival.`;
};

const joinEventParts = (...parts) => parts.filter(Boolean).join(" ");

const buildTablePlay = (seatId, card, tableIndex, activeWeapon, selectedRole) => {
  const seat = getSeatById(seatId);
  const player = getPlayerBySeatId(seatId);
  const weaponAdjustment = getWeaponPowerAdjustment({
    basePower: card.power,
    seatId,
    selectedSeatId: getSelectedSeatId(selectedRole),
    oppositeSeatId: getOppositeSeatId(selectedRole),
    selectedRole,
    activeWeapon
  });

  return {
    ...card,
    card,
    owner: player?.name ?? "Jugador",
    side: seat.team,
    team: seat.team,
    role: seat.role,
    seatId,
    seatLabel: seat.label,
    tableIndex,
    basePower: card.power,
    power: weaponAdjustment.power,
    weaponEffect: weaponAdjustment.effect
  };
};

const describeTableCards = (tableCards) => `${tableCards.length} cartas en mesa`;

const playSeatCard = (current, seatId, card, activeLane, selectedRole) => {
  if (!card || !current.handStarted || current.handClosed || current.envidoPending || current.trucoPending) {
    return current;
  }

  const seat = getSeatById(seatId);
  const nextHandsBySeat = {
    ...current.handsBySeat,
    [seatId]: (current.handsBySeat?.[seatId] ?? []).filter((item) => item.handIndex !== card.handIndex)
  };
  const playedCard = buildTablePlay(seatId, card, current.tableCards.length, current.activeWeapon, selectedRole);
  const nextTableCards = [...current.tableCards, playedCard];
  const currentVuelta = current.vueltaIndex + 1;

  if (nextTableCards.length < tableSeats.length) {
    const nextTurnSeatId = getNextSeatId(seatId);
    const weaponEffectLog = describeWeaponEffect(playedCard.weaponEffect);
    const nextState = {
      ...current,
      handsBySeat: nextHandsBySeat,
      currentTurnSeatId: nextTurnSeatId,
      tableCards: nextTableCards,
      eventLog: joinEventParts(
        `${getSeatPlayerName(seatId)} juega.`,
        weaponEffectLog,
        `Sigue ${getSeatPlayerName(nextTurnSeatId)}.`
      ),
      highlight: `Vuelta ${currentVuelta}. Actua ${getSeatPlayerName(nextTurnSeatId)}.`,
      outcomeTone: seat.team === "A" ? "neutral" : "neutral",
      pendingAnimationKey: current.pendingAnimationKey + 1
    };

    return syncLaneHands(nextState, selectedRole);
  }

  const resolution = resolveTableTrick(
    nextTableCards,
    current.trickHistory,
    current.manoTeam,
    current.currentLeadSeatId
  );
  const nextTrickWins =
    resolution.result === PARDA
      ? current.trickWins
      : {
          ...current.trickWins,
          [resolution.winner]: current.trickWins[resolution.winner] + 1
        };
  const selectedSeatId = getSelectedSeatId(selectedRole);
  const oppositeSeatId = getOppositeSeatId(selectedRole);
  const selectedPlay =
    nextTableCards.find((play) => play.seatId === selectedSeatId) ?? nextTableCards.find((play) => play.team === "A");
  const oppositePlay =
    nextTableCards.find((play) => play.seatId === oppositeSeatId) ?? nextTableCards.find((play) => play.team === "B");
  const trickHistory = [
    ...current.trickHistory,
    {
      index: currentVuelta,
      result: resolution.result,
      winner: resolution.winner,
      winnerSeatId: resolution.winnerSeatId,
      cards: nextTableCards,
      humanCard: selectedPlay?.card ?? selectedPlay,
      rivalCard: oppositePlay?.card ?? oppositePlay
    }
  ];
  const handWinner = getHandWinner(trickHistory, current.manoTeam);
  const baseResolvedState = {
    ...current,
    handsBySeat: nextHandsBySeat,
    tableCards: nextTableCards,
    trickHistory,
    trickWins: nextTrickWins,
    vueltaIndex: currentVuelta,
    lastWinner: resolution.winner,
    leadTeam: resolution.winner,
    currentLeadSeatId: resolution.winnerSeatId,
    currentTurnSeatId: null,
    activeWeapon: null,
    pendingAnimationKey: current.pendingAnimationKey + 1,
    eventLog: joinEventParts(
      `${describeTableCards(nextTableCards)}.`,
      nextTableCards
        .map((play) => describeWeaponEffect(play.weaponEffect))
        .filter(Boolean)
        .join(" "),
      resolution.highlight
    ),
    highlight: resolution.highlight,
    outcomeTone: resolution.outcomeTone
  };

  if (!handWinner) {
    return syncLaneHands(baseResolvedState, selectedRole);
  }

  const scoring = applyHandPoints(current.scores, handWinner, current.activeBet, current.pointsInverted);
  const matchWinner = getMatchWinner(scoring.scores);
  const handWinnerName = getPlayerName(handWinner, activeLane);
  const scoringWinnerName = getPlayerName(scoring.scoringWinner, activeLane);

  return syncLaneHands(
    {
      ...baseResolvedState,
      scores: scoring.scores,
      handClosed: true,
      handWinner,
      scoringWinner: scoring.scoringWinner,
      leadTeam: handWinner,
      trucoRaiseOwner: null,
      trucoPending: null,
      eventLog: `Mano para ${handWinnerName}.${current.pointsInverted ? ` Cobra ${scoringWinnerName}.` : ""}`,
      highlight: matchWinner
        ? matchWinner === "A"
          ? "Partida para la casa."
          : "Partida para la visita."
        : handWinner === "A"
          ? "Ganaste la mano."
          : "Perdiste la mano.",
      outcomeTone: scoring.scoringWinner === "A" ? "win" : "lose",
      matchWinner
    },
    selectedRole
  );
};

const getNextTrucoCall = (activeBet) => {
  if (activeBet <= 1) return { label: "Truco", acceptedBet: 2, rejectedPoints: 1 };
  if (activeBet === 2) return { label: "Retruco", acceptedBet: 3, rejectedPoints: 2 };
  if (activeBet === 3) return { label: "Vale cuatro", acceptedBet: 4, rejectedPoints: 3 };
  return null;
};

const shouldRivalAcceptTruco = (rivalHand, currentBet, trickWins) => {
  const bestPower = getBestCardPower(rivalHand);
  if (currentBet <= 1) return bestPower >= 9 || trickWins.B > trickWins.A;
  if (currentBet === 2) return bestPower >= 11 || trickWins.B > trickWins.A;
  if (currentBet === 3) return bestPower >= 13 || trickWins.B >= 1;
  return false;
};

const shouldRivalRaiseTruco = (rivalHand, currentBet, trickWins) => {
  const nextRaise = getNextTrucoCall(currentBet <= 1 ? 2 : currentBet + 1);
  const bestPower = getBestCardPower(rivalHand);

  if (!nextRaise) return false;
  if (currentBet <= 1) return bestPower >= 12 && trickWins.B >= trickWins.A;
  if (currentBet === 2) return bestPower >= 13 && trickWins.B >= 1;
  return false;
};

const getTrucoSlug = (label) => label.toLowerCase().replace(" ", "-");

// ── Multiplayer host-autoritativo ────────────────────────────────────────────
// El host corre la única verdad del match. Los guests mandan intents
// {action, seatId, payload} (ver src/game/net/room.js) y el host los valida
// acá con los MISMOS gates que usa para sus propias jugadas; un intent
// inválido se ignora en silencio. Tras cada mutación el host emite un
// snapshot que los guests hidratan, cerrando el ciclo intent→estado→snapshot.

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

// El snapshot viene de la red: no se confía en su shape. Solo se validan los
// campos que rompen el juego si llegan corruptos (scores no numéricos, manos
// que no son arrays, etc.); el resto del estado es presentacional.
// exportado para tests (snapshot forjado/malformado no debe pisar el estado)
export const isValidSnapshotState = (state) => {
  if (!state || typeof state !== "object" || Array.isArray(state)) return false;
  if (typeof state.handStarted !== "boolean" || typeof state.handClosed !== "boolean") return false;
  if (!isFiniteNumber(state.handNumber) || state.handNumber < 1) return false;
  if (!state.scores || !isFiniteNumber(state.scores.A) || !isFiniteNumber(state.scores.B)) return false;
  if (!state.trickWins || !isFiniteNumber(state.trickWins.A) || !isFiniteNumber(state.trickWins.B)) return false;
  if (!isFiniteNumber(state.vueltaIndex) || !isFiniteNumber(state.activeBet)) return false;
  if (!Array.isArray(state.tableCards) || !Array.isArray(state.trickHistory)) return false;
  if (typeof state.handsBySeat !== "object" || state.handsBySeat === null || Array.isArray(state.handsBySeat))
    return false;
  if (!Object.values(state.handsBySeat).every((hand) => Array.isArray(hand))) return false;
  return true;
};

// Envido genérico por silla: la comparación siempre es entre las dos sillas
// del rol del cantor (lane A vs lane B) para que el mapeo de equipos de
// resolveEnvido no dependa de quién canta. El que responde es el otro equipo.
const applyEnvidoCallBySeat = (current, seat, activeLane) => {
  const laneSeatA = getSeatByTeamRole("A", seat.role);
  const laneSeatB = getSeatByTeamRole("B", seat.role);
  const resolution = resolveEnvido(
    current.handsBySeat?.[laneSeatA.seatId] ?? [],
    current.handsBySeat?.[laneSeatB.seatId] ?? [],
    current.manoTeam
  );
  const callerTeam = seat.team;
  const callerValue = callerTeam === "A" ? resolution.humanValue : resolution.rivalValue;
  const responderValue = callerTeam === "A" ? resolution.rivalValue : resolution.humanValue;
  const responderWants = responderValue >= 24 || responderValue >= callerValue - 2;
  const winner = responderWants ? resolution.winner : callerTeam;
  const points = responderWants ? 2 : 1;
  const winnerName = getPlayerName(winner, activeLane);

  return {
    ...current,
    envidoPending: {
      accepted: responderWants,
      humanValue: resolution.humanValue,
      rivalValue: resolution.rivalValue,
      winner,
      points
    },
    eventLog: responderWants
      ? `Envido querido. ${resolution.humanValue}-${resolution.rivalValue}.`
      : "Envido no querido.",
    highlight: responderWants
      ? `${resolution.humanValue}-${resolution.rivalValue}. Gana ${winnerName}.`
      : "Envido no querido.",
    outcomeTone: winner === "A" ? "win" : "lose"
  };
};

// Truco genérico por equipo. Si canta la casa (A), la visita responde con la
// heurística de bot existente. Si canta la visita (un guest sentado en B),
// queda un trucoPending target=A y responde la casa por UI (QUIERO/NO QUIERO).
const applyTrucoCallByTeam = (current, callerTeam, activeLane) => {
  const nextCall = getNextTrucoCall(current.activeBet);
  const callerCanRaise = !current.trucoRaiseOwner || current.trucoRaiseOwner === callerTeam;
  if (current.envidoPending || current.trucoPending || !nextCall || !callerCanRaise) return current;

  if (callerTeam === "B") {
    return {
      ...current,
      trucoPending: {
        caller: "B",
        target: "A",
        label: nextCall.label,
        acceptedBet: nextCall.acceptedBet,
        rejectedPoints: nextCall.rejectedPoints
      },
      trucoState: `${getTrucoSlug(nextCall.label)}-pending`,
      eventLog: `${activeLane.rival.name} canta ${nextCall.label}.`,
      highlight: `${activeLane.rival.name} canta ${nextCall.label}.`,
      outcomeTone: "neutral"
    };
  }

  const rivalWants = shouldRivalAcceptTruco(current.rivalHand, current.activeBet, current.trickWins);
  const rivalRaises = rivalWants && shouldRivalRaiseTruco(current.rivalHand, current.activeBet, current.trickWins);
  const counterCall = rivalRaises ? getNextTrucoCall(nextCall.acceptedBet) : null;

  if (counterCall) {
    return {
      ...current,
      trucoPending: {
        caller: "B",
        target: "A",
        label: counterCall.label,
        acceptedBet: counterCall.acceptedBet,
        rejectedPoints: counterCall.rejectedPoints,
        sourceLabel: nextCall.label
      },
      trucoState: `${getTrucoSlug(nextCall.label)}-countered`,
      eventLog: `${nextCall.label}. Resube ${counterCall.label}.`,
      highlight: `${activeLane.rival.name} canta ${counterCall.label}.`,
      outcomeTone: "neutral"
    };
  }

  if (rivalWants) {
    return {
      ...current,
      activeBet: nextCall.acceptedBet,
      trucoState: getTrucoSlug(nextCall.label),
      trucoRaiseOwner: "B",
      eventLog: `${nextCall.label} querido. Vale ${nextCall.acceptedBet}.`,
      highlight: `${nextCall.label} querido.`,
      outcomeTone: "neutral"
    };
  }

  const scoring = applyHandPoints(current.scores, "A", nextCall.rejectedPoints, current.pointsInverted);
  const matchWinner = getMatchWinner(scoring.scores);

  return {
    ...current,
    scores: scoring.scores,
    handClosed: true,
    handWinner: "A",
    scoringWinner: scoring.scoringWinner,
    lastWinner: "A",
    trucoState: `${getTrucoSlug(nextCall.label)}-rejected`,
    trucoRaiseOwner: null,
    trucoPending: null,
    eventLog: `${nextCall.label} no querido. Cobra ${nextCall.rejectedPoints}.`,
    highlight: `${nextCall.label} no querido.`,
    outcomeTone: scoring.scoringWinner === "A" ? "win" : "lose",
    matchWinner
  };
};

const buildRoleSelectState = (handNumber, scores, activeLane) => {
  const manoSeat = getManoSeatForHand(handNumber);
  const manoTeam = manoSeat.team;
  const whoStartsName = getSeatPlayerName(manoSeat.seatId);

  return {
    handStarted: false,
    handNumber,
    scores,
    manoTeam,
    manoSeatId: manoSeat.seatId,
    leadTeam: manoTeam,
    activeModifier: CLASSIC_MODIFIER,
    activeBet: 1,
    handsBySeat: {},
    currentLeadSeatId: null,
    currentTurnSeatId: null,
    humanHand: [],
    rivalHand: [],
    weaponHand: [],
    activeWeapon: null,
    weaponUsed: false,
    handClosed: false,
    matchWinner: null,
    tableCards: [],
    trickHistory: [],
    vueltaIndex: 0,
    trickWins: { A: 0, B: 0 },
    lastWinner: null,
    handWinner: null,
    scoringWinner: null,
    pointsInverted: false,
    negotiationUsed: false,
    negotiationDice: null,
    envidoResolved: false,
    envidoResult: null,
    envidoPending: null,
    trucoState: "none",
    trucoRaiseOwner: null,
    trucoPending: null,
    pendingAnimationKey: 0,
    eventLog: `Sale ${whoStartsName}.`,
    highlight: `Elegi ${activeLane.role}.`,
    outcomeTone: "neutral"
  };
};

const buildOpeningState = (handNumber, scores, activeLane) => {
  const pool = buildSharedPool();
  const manoSeat = getManoSeatForHand(handNumber);
  const manoTeam = manoSeat.team;
  const whoStartsName = getSeatPlayerName(manoSeat.seatId);
  const handsBySeat = dealSeatHands(pool);
  const selectedSeatId = getSelectedSeatId(activeLane.role);
  const oppositeSeatId = getOppositeSeatId(activeLane.role);

  return {
    handStarted: true,
    handNumber,
    scores,
    manoTeam,
    manoSeatId: manoSeat.seatId,
    leadTeam: manoTeam,
    activeModifier: CLASSIC_MODIFIER,
    activeBet: 1,
    handsBySeat,
    currentLeadSeatId: manoSeat.seatId,
    currentTurnSeatId: manoSeat.seatId,
    humanHand: handsBySeat[selectedSeatId] ?? [],
    rivalHand: handsBySeat[oppositeSeatId] ?? [],
    weaponHand: drawWeapons(),
    activeWeapon: null,
    weaponUsed: false,
    handClosed: false,
    matchWinner: null,
    tableCards: [],
    trickHistory: [],
    vueltaIndex: 0,
    trickWins: { A: 0, B: 0 },
    lastWinner: null,
    handWinner: null,
    scoringWinner: null,
    pointsInverted: false,
    negotiationUsed: false,
    negotiationDice: null,
    envidoResolved: false,
    envidoResult: null,
    envidoPending: null,
    trucoState: "none",
    trucoRaiseOwner: null,
    trucoPending: null,
    pendingAnimationKey: 0,
    eventLog: getRoleOpeningLog(activeLane, whoStartsName),
    highlight: `Mano ${handNumber}. Sale ${whoStartsName}.`,
    outcomeTone: "neutral"
  };
};

const revealRivalLead = (state, activeLane, selectedRole) => {
  if (!state.currentTurnSeatId || state.currentTurnSeatId === getSelectedSeatId(selectedRole)) {
    return state;
  }

  const hand = state.handsBySeat?.[state.currentTurnSeatId] ?? [];
  const card = pickAutoCard(hand, state.tableCards);
  return playSeatCard(state, state.currentTurnSeatId, card, activeLane, selectedRole);
};

const clearResolvedTrick = (state, activeLane, selectedRole) => {
  if (state.tableCards.length < tableSeats.length || state.handClosed) {
    return state;
  }

  const nextVuelta = state.vueltaIndex + 1;
  const nextTurnSeatId =
    state.currentLeadSeatId ?? state.manoSeatId ?? getSeatByTeamRole(state.leadTeam, selectedRole).seatId;
  const nextLeaderName = getSeatPlayerName(nextTurnSeatId);

  return syncLaneHands(
    {
      ...state,
      tableCards: [],
      currentLeadSeatId: nextTurnSeatId,
      currentTurnSeatId: nextTurnSeatId,
      eventLog: `Vuelta ${nextVuelta}. Sale ${nextLeaderName}.`,
      highlight: `Vuelta ${nextVuelta}. Sale ${nextLeaderName}.`,
      outcomeTone: "neutral"
    },
    selectedRole
  );
};

const getPhaseData = (state, activeLane) => {
  const isNegociante = activeLane.role === "Negociante";
  const isCartachin = activeLane.role === "Cartachin";
  const roleDefinition = roleDefinitions[activeLane.role] ?? roleDefinitions.Cartachin;
  const openingWindow =
    state.handStarted && state.vueltaIndex === 0 && state.tableCards.length === 0 && !state.handClosed;
  const firstCardWindow =
    state.handStarted &&
    state.vueltaIndex === 0 &&
    state.tableCards.length === 0 &&
    state.trickHistory.length === 0 &&
    !state.handClosed;
  const displayVueltaNumber = !state.handStarted
    ? 1
    : state.handClosed || state.tableCards.length >= tableSeats.length
      ? Math.max(1, state.trickHistory.length)
      : Math.min(state.trickHistory.length + 1, 3);
  const pardaCount = getPardaCount(state.trickHistory);

  const whoStartsName = getSeatPlayerName(
    state.manoSeatId ?? state.currentLeadSeatId ?? getManoSeatForHand(state.handNumber).seatId
  );
  const leadPlayerName = getSeatPlayerName(
    state.currentLeadSeatId ?? state.manoSeatId ?? getManoSeatForHand(state.handNumber).seatId
  );
  const selectedSeatId = getSelectedSeatId(activeLane.role);
  const currentTurnSeat = state.currentTurnSeatId ? getSeatById(state.currentTurnSeatId) : null;
  const currentActorName = state.currentTurnSeatId ? getSeatPlayerName(state.currentTurnSeatId) : null;
  const isSelectedSeatTurn = state.currentTurnSeatId === selectedSeatId;
  const tableTrickOpen = Boolean(
    state.handStarted && !state.handClosed && state.currentTurnSeatId && state.tableCards.length < tableSeats.length
  );
  const handEndsCopy = "Gana 2 vueltas.";
  const nextTrucoCall = getNextTrucoCall(state.activeBet);
  const humanHasTrucoRaise = !state.trucoRaiseOwner || state.trucoRaiseOwner === "A";
  const canRaiseTruco =
    Boolean(nextTrucoCall) && tableTrickOpen && isSelectedSeatTurn && humanHasTrucoRaise && !state.trucoPending;

  if (state.trucoPending) {
    const callerName = getPlayerName(state.trucoPending.caller, activeLane);

    return {
      phase: "truco-response",
      phaseLabel: `Responder ${state.trucoPending.label}`,
      phaseHint: `${callerName}: ${state.trucoPending.label}.`,
      stepNumber: 2,
      stepTitle: "Responder truco",
      advanceLabel: null,
      canPlayCard: false,
      canUseWeapon: false,
      canCallEnvido: false,
      canCallTruco: false,
      canAdvance: false,
      canUseRolePower: false,
      canSwitchRole: false,
      canRespondTruco: state.trucoPending.target === "A",
      canRaiseTrucoResponse:
        Boolean(getNextTrucoCall(state.trucoPending.acceptedBet)) && state.trucoPending.target === "A",
      trucoResponseRaiseLabel: getNextTrucoCall(state.trucoPending.acceptedBet)?.label,
      displayVueltaNumber,
      pardaCount,
      whoStartsName,
      leadPlayerName,
      nextActorName: callerName,
      handEndsCopy,
      rolePowerName: roleDefinition.powerName,
      rolePowerSummary: roleDefinition.powerSummary,
      rolePowerStatus: "Responder truco.",
      rolePowerButtonLabel: roleDefinition.powerName
    };
  }

  if (state.envidoPending && !state.envidoResolved) {
    return {
      phase: "envido-resolution",
      phaseLabel: "Resolver envido",
      phaseHint: state.envidoPending.accepted ? "Tantos." : "No querido.",
      stepNumber: 1,
      stepTitle: "Anotar envido",
      advanceLabel: "Anotar envido",
      canPlayCard: false,
      canUseWeapon: false,
      canCallEnvido: false,
      canCallTruco: false,
      canAdvance: true,
      canUseRolePower: false,
      canSwitchRole: false,
      displayVueltaNumber,
      pardaCount,
      whoStartsName,
      leadPlayerName,
      nextActorName: null,
      handEndsCopy,
      rolePowerName: roleDefinition.powerName,
      rolePowerSummary: roleDefinition.powerSummary,
      rolePowerStatus: "Resolver envido.",
      rolePowerButtonLabel: roleDefinition.powerName
    };
  }

  if (!state.handStarted) {
    return {
      phase: "role-select",
      phaseLabel: "Elegir rol",
      phaseHint: `Sale ${whoStartsName}.`,
      stepNumber: 1,
      stepTitle: "Elegir rol",
      advanceLabel: "Confirmar y repartir",
      canPlayCard: false,
      canUseWeapon: false,
      canCallEnvido: false,
      canCallTruco: false,
      canAdvance: true,
      canUseRolePower: false,
      canSwitchRole: true,
      displayVueltaNumber,
      pardaCount,
      whoStartsName,
      leadPlayerName,
      nextActorName: null,
      handEndsCopy,
      rolePowerName: roleDefinition.powerName,
      rolePowerSummary: roleDefinition.powerSummary,
      rolePowerStatus: isNegociante ? "Negociar puntos." : isCartachin ? "Cargar arma." : "Cartas.",
      rolePowerButtonLabel: roleDefinition.powerName
    };
  }

  if (state.matchWinner) {
    return {
      phase: "match-end",
      phaseLabel: "Partida cerrada",
      phaseHint: "Partida cerrada.",
      stepNumber: 5,
      stepTitle: "Nueva partida",
      advanceLabel: "Nueva partida",
      canPlayCard: false,
      canUseWeapon: false,
      canCallEnvido: false,
      canCallTruco: false,
      canAdvance: true,
      canUseRolePower: false,
      canSwitchRole: true,
      displayVueltaNumber,
      pardaCount,
      whoStartsName,
      leadPlayerName,
      nextActorName: null,
      handEndsCopy,
      rolePowerName: roleDefinition.powerName,
      rolePowerSummary: roleDefinition.powerSummary,
      rolePowerStatus: "Partida cerrada.",
      rolePowerButtonLabel: roleDefinition.powerName
    };
  }

  if (state.handClosed) {
    return {
      phase: "hand-end",
      phaseLabel: "Cerrar mano",
      phaseHint: "Cobrar mano.",
      stepNumber: 4,
      stepTitle: "Cobrar la mano",
      advanceLabel: "Siguiente mano",
      canPlayCard: false,
      canUseWeapon: false,
      canCallEnvido: false,
      canCallTruco: false,
      canAdvance: true,
      canUseRolePower: false,
      canSwitchRole: true,
      displayVueltaNumber,
      pardaCount,
      whoStartsName,
      leadPlayerName,
      nextActorName: null,
      handEndsCopy,
      rolePowerName: roleDefinition.powerName,
      rolePowerSummary: roleDefinition.powerSummary,
      rolePowerStatus: state.pointsInverted ? "Cobro invertido." : "Cobro normal.",
      rolePowerButtonLabel: roleDefinition.powerName
    };
  }

  if (state.tableCards.length >= tableSeats.length) {
    const nextLeaderName = getSeatPlayerName(
      state.currentLeadSeatId ?? state.manoSeatId ?? getManoSeatForHand(state.handNumber).seatId
    );
    const nextLeaderCopy = `Sigue ${nextLeaderName}.`;

    return {
      phase: "trick-closed",
      phaseLabel: `Vuelta ${state.vueltaIndex} resuelta`,
      phaseHint: nextLeaderCopy,
      stepNumber: 3,
      stepTitle: "Limpiar la mesa",
      advanceLabel: "Limpiar mesa",
      canPlayCard: false,
      canUseWeapon: false,
      canCallEnvido: false,
      canCallTruco: false,
      canAdvance: true,
      canUseRolePower: false,
      canSwitchRole: false,
      displayVueltaNumber,
      pardaCount,
      whoStartsName,
      leadPlayerName,
      nextActorName: null,
      handEndsCopy,
      rolePowerName: roleDefinition.powerName,
      rolePowerSummary: roleDefinition.powerSummary,
      rolePowerStatus: "Mano activa.",
      rolePowerButtonLabel: roleDefinition.powerName
    };
  }

  if (tableTrickOpen) {
    const firstCardWindowForSeat = firstCardWindow && isSelectedSeatTurn;
    const rolePowerWindow = openingWindow && firstCardWindow;
    const cartachinPowerAvailable = rolePowerWindow && isCartachin && !state.weaponUsed;
    const negociantePowerAvailable = rolePowerWindow && isNegociante && !state.negotiationUsed;
    const roleOpeningDecisionAvailable = cartachinPowerAvailable || negociantePowerAvailable;

    return {
      phase: isSelectedSeatTurn ? "table-human-turn" : "table-auto-turn",
      phaseLabel: isSelectedSeatTurn ? `Tu turno · ${activeLane.human.name}` : `Turno de ${currentActorName}`,
      phaseHint: isSelectedSeatTurn
        ? roleOpeningDecisionAvailable
          ? "Rol o carta."
          : `Carta. V${displayVueltaNumber}.`
        : roleOpeningDecisionAvailable
          ? `Antes de ${currentActorName}.`
          : `Juega ${currentActorName}.`,
      stepNumber: 2,
      stepTitle: isSelectedSeatTurn ? "Bajar carta" : "Avanzar mesa",
      advanceLabel: isSelectedSeatTurn
        ? null
        : roleOpeningDecisionAvailable
          ? `Dejar jugar a ${currentActorName}`
          : `${currentActorName} juega`,
      canPlayCard: isSelectedSeatTurn,
      canUseWeapon: cartachinPowerAvailable,
      canCallEnvido: firstCardWindowForSeat && !state.envidoResolved && state.activeBet === 1,
      canCallTruco: canRaiseTruco,
      canAdvance: !isSelectedSeatTurn,
      canUseRolePower: negociantePowerAvailable,
      canSwitchRole: false,
      displayVueltaNumber,
      pardaCount,
      whoStartsName,
      leadPlayerName,
      nextActorName: currentActorName,
      nextActorSeatId: state.currentTurnSeatId,
      handEndsCopy,
      rolePowerName: roleDefinition.powerName,
      rolePowerSummary: roleDefinition.powerSummary,
      rolePowerStatus: negociantePowerAvailable
        ? "Negociar puntos."
        : cartachinPowerAvailable
          ? "Cargar arma."
          : currentTurnSeat?.role
            ? currentTurnSeat.label
            : "Orden de mesa.",
      rolePowerButtonLabel: roleDefinition.powerName,
      trucoCallLabel: nextTrucoCall?.label
    };
  }

  return {
    phase: "play",
    phaseLabel: `Jugar vuelta ${state.vueltaIndex + 1}`,
    phaseHint: "Elegí carta.",
    stepNumber: 2,
    stepTitle: "Bajar carta",
    advanceLabel: null,
    canPlayCard: true,
    canUseWeapon: false,
    canCallEnvido: false,
    canCallTruco: canRaiseTruco,
    canAdvance: false,
    canUseRolePower: false,
    canSwitchRole: false,
    displayVueltaNumber,
    pardaCount,
    whoStartsName,
    leadPlayerName,
    nextActorName: activeLane.human.name,
    handEndsCopy,
    rolePowerName: roleDefinition.powerName,
    rolePowerSummary: roleDefinition.powerSummary,
    rolePowerStatus: state.pointsInverted ? "Cobro invertido." : isCartachin ? "Arma cerrada." : "Cartas.",
    rolePowerButtonLabel: roleDefinition.powerName,
    trucoCallLabel: nextTrucoCall?.label
  };
};

export function useTrucolocoMatch() {
  const [selectedRole, setSelectedRole] = useState(MATCH_CONFIG.defaultRole);
  const [selectedCharacterIdsByRole, setSelectedCharacterIdsByRole] = useState(() => getDefaultCharacterIdsByRole());
  const selectedRoleCharacters = useMemo(() => characterOptionsByRole[selectedRole] ?? [], [selectedRole]);
  const selectedCharacter = useMemo(
    () => getSelectedCharacterForRole(selectedRole, selectedCharacterIdsByRole[selectedRole]),
    [selectedCharacterIdsByRole, selectedRole]
  );
  const activeLane = useMemo(() => getLanePair(selectedRole, selectedCharacter), [selectedCharacter, selectedRole]);
  const roster = useMemo(() => ({ A: teams.A, B: teams.B }), []);
  const [state, setState] = useState(() =>
    buildRoleSelectState(1, { A: 0, B: 0 }, getLanePair(MATCH_CONFIG.defaultRole))
  );

  const negotiatePoints = () => {
    setState((current) => {
      const openingWindow =
        current.handStarted && current.vueltaIndex === 0 && current.tableCards.length === 0 && !current.handClosed;

      if (
        activeLane.role !== "Negociante" ||
        current.negotiationUsed ||
        current.envidoPending ||
        current.trucoPending ||
        !openingWindow
      ) {
        return current;
      }

      const humanDie = Math.floor(Math.random() * 6) + 1;
      const rivalDie = Math.floor(Math.random() * 6) + 1;
      const success = humanDie + rivalDie >= 8;

      return {
        ...current,
        negotiationUsed: true,
        pointsInverted: success,
        negotiationDice: { humanDie, rivalDie, success },
        eventLog: success
          ? `Dados ${humanDie}+${rivalDie}. Cobro invertido.`
          : `Dados ${humanDie}+${rivalDie}. Cobro normal.`,
        highlight: success ? "Negociacion aprobada." : "Negociacion rechazada.",
        outcomeTone: success ? "neutral" : "lose"
      };
    });
  };

  const useWeapon = (weaponId) => {
    setState((current) => {
      const openingWindow =
        current.handStarted && current.vueltaIndex === 0 && current.tableCards.length === 0 && !current.handClosed;

      if (
        activeLane.role !== "Cartachin" ||
        current.weaponUsed ||
        current.envidoPending ||
        current.trucoPending ||
        !openingWindow
      ) {
        return current;
      }

      const weapon = current.weaponHand.find((item) => item.handIndex === weaponId);
      if (!weapon) return current;

      return {
        ...current,
        weaponUsed: true,
        activeWeapon: weapon,
        weaponHand: current.weaponHand.filter((item) => item.handIndex !== weaponId),
        eventLog: `${weapon.name} lista.`,
        highlight: `${weapon.name} lista.`,
        outcomeTone: "neutral"
      };
    });
  };

  const callEnvido = () => {
    setState((current) => {
      const firstCardWindow =
        current.handStarted &&
        current.vueltaIndex === 0 &&
        current.tableCards.length === 0 &&
        current.trickHistory.length === 0 &&
        current.currentTurnSeatId === getSelectedSeatId(activeLane.role) &&
        !current.handClosed;

      if (!firstCardWindow || current.envidoResolved || current.activeBet !== 1 || current.trucoPending) return current;

      return applyEnvidoCallBySeat(current, getSeatById(getSelectedSeatId(activeLane.role)), activeLane);
    });
  };

  const settleEnvido = () => {
    setState((current) => {
      if (!current.envidoPending || current.envidoResolved) return current;

      const { winner, points } = current.envidoPending;
      const scores = awardPoints(current.scores, winner, points);
      const matchWinner = getMatchWinner(scores);
      const winnerName = getPlayerName(winner, activeLane);

      return {
        ...current,
        scores,
        envidoResolved: true,
        envidoResult: current.envidoPending,
        envidoPending: null,
        eventLog: `${winnerName} cobra ${points}.`,
        highlight: `Envido anotado para ${winnerName}.`,
        outcomeTone: winner === "A" ? "win" : "lose",
        matchWinner
      };
    });
  };

  const callTruco = () => {
    setState((current) => {
      const selectedSeatId = getSelectedSeatId(activeLane.role);
      const humanActionWindow =
        current.handStarted &&
        !current.handClosed &&
        current.currentTurnSeatId === selectedSeatId &&
        current.tableCards.length < tableSeats.length;

      if (!humanActionWindow) return current;

      return applyTrucoCallByTeam(current, "A", activeLane);
    });
  };

  const acceptTruco = () => {
    setState((current) => {
      const pending = current.trucoPending;
      if (!pending || pending.target !== "A" || current.handClosed) return current;

      return {
        ...current,
        activeBet: pending.acceptedBet,
        trucoState: getTrucoSlug(pending.label),
        trucoRaiseOwner: "A",
        trucoPending: null,
        eventLog: `${pending.label} querido. Vale ${pending.acceptedBet}.`,
        highlight: `${pending.label} querido.`,
        outcomeTone: "neutral"
      };
    });
  };

  const rejectTruco = () => {
    setState((current) => {
      const pending = current.trucoPending;
      if (!pending || pending.target !== "A" || current.handClosed) return current;

      const scoring = applyHandPoints(current.scores, pending.caller, pending.rejectedPoints, current.pointsInverted);
      const matchWinner = getMatchWinner(scoring.scores);
      const callerName = getPlayerName(pending.caller, activeLane);

      return {
        ...current,
        scores: scoring.scores,
        handClosed: true,
        handWinner: pending.caller,
        scoringWinner: scoring.scoringWinner,
        lastWinner: pending.caller,
        trucoState: `${getTrucoSlug(pending.label)}-rejected`,
        trucoRaiseOwner: null,
        trucoPending: null,
        eventLog: `${pending.label} no querido. Cobra ${callerName}.`,
        highlight: `${pending.label} no querido.`,
        outcomeTone: scoring.scoringWinner === "A" ? "win" : "lose",
        matchWinner
      };
    });
  };

  const raiseTrucoResponse = () => {
    setState((current) => {
      const pending = current.trucoPending;
      if (!pending || pending.target !== "A" || current.handClosed) return current;

      const nextCall = getNextTrucoCall(pending.acceptedBet);
      if (!nextCall) return current;

      const rivalWants = shouldRivalAcceptTruco(current.rivalHand, pending.acceptedBet, current.trickWins);

      if (rivalWants) {
        return {
          ...current,
          activeBet: nextCall.acceptedBet,
          trucoState: getTrucoSlug(nextCall.label),
          trucoRaiseOwner: "B",
          trucoPending: null,
          eventLog: `${nextCall.label} querido. Vale ${nextCall.acceptedBet}.`,
          highlight: `${nextCall.label} querido.`,
          outcomeTone: "neutral"
        };
      }

      const scoring = applyHandPoints(current.scores, "A", nextCall.rejectedPoints, current.pointsInverted);
      const matchWinner = getMatchWinner(scoring.scores);

      return {
        ...current,
        scores: scoring.scores,
        handClosed: true,
        handWinner: "A",
        scoringWinner: scoring.scoringWinner,
        lastWinner: "A",
        trucoState: `${getTrucoSlug(nextCall.label)}-rejected`,
        trucoRaiseOwner: null,
        trucoPending: null,
        eventLog: `${nextCall.label} no querido. Cobra ${nextCall.rejectedPoints}.`,
        highlight: `${nextCall.label} no querido.`,
        outcomeTone: scoring.scoringWinner === "A" ? "win" : "lose",
        matchWinner
      };
    });
  };

  const playCard = (cardId) => {
    setState((current) => {
      const selectedSeatId = getSelectedSeatId(activeLane.role);

      if (
        !current.handStarted ||
        current.envidoPending ||
        current.trucoPending ||
        current.handClosed ||
        current.currentTurnSeatId !== selectedSeatId ||
        current.tableCards.length >= tableSeats.length
      ) {
        return current;
      }

      const humanCard = (current.handsBySeat?.[selectedSeatId] ?? []).find((card) => card.handIndex === cardId);
      if (!humanCard) return current;

      return playSeatCard(current, selectedSeatId, humanCard, activeLane, activeLane.role);
    });
  };

  const startHand = () => {
    setState((current) => {
      if (current.handStarted || current.matchWinner) return current;
      return buildOpeningState(current.handNumber, current.scores, activeLane);
    });
  };

  const revealRivalLeadAction = () => {
    setState((current) => {
      if (!current.handStarted || current.envidoPending || current.trucoPending || current.handClosed) {
        return current;
      }

      return revealRivalLead(current, activeLane, activeLane.role);
    });
  };

  const clearTrick = () => {
    setState((current) => clearResolvedTrick(current, activeLane, activeLane.role));
  };

  // Acto de acuerdo de negociantes: al cierre de la mano, ambos equipos
  // confirman el cobro (con ajuste chico si negocian). Una sola vez por mano.
  const applyAgreement = (deltaA = 0, deltaB = 0) => {
    setState((current) => {
      if (!current.handClosed || current.matchWinner || current.agreementApplied) return current;
      const da = Math.max(-2, Math.min(2, Math.round(deltaA)));
      const db = Math.max(-2, Math.min(2, Math.round(deltaB)));
      const scores = { A: Math.max(0, current.scores.A + da), B: Math.max(0, current.scores.B + db) };
      const matchWinner = getMatchWinner(scores);
      return {
        ...current,
        scores,
        matchWinner,
        agreementApplied: true,
        eventLog:
          da || db
            ? `Acuerdo sellado: ${da >= 0 ? `+${da}` : da} casa, ${db >= 0 ? `+${db}` : db} visita.`
            : "Acuerdo sellado: cobro automático.",
        highlight: da || db ? "Los negociantes movieron la aguja." : "Cobro confirmado."
      };
    });
  };

  const startNextHand = () => {
    setState((current) => {
      if (!current.handClosed || current.matchWinner) return current;
      return buildOpeningState(current.handNumber + 1, current.scores, activeLane);
    });
  };

  const restartMatch = () => {
    setState((current) => {
      if (!current.matchWinner) return current;

      return {
        ...buildRoleSelectState(1, { A: 0, B: 0 }, activeLane),
        eventLog: "Nueva partida.",
        highlight: "Nueva partida."
      };
    });
  };

  const advance = () => {
    setState((current) => {
      if (current.matchWinner) {
        return {
          ...buildRoleSelectState(1, { A: 0, B: 0 }, activeLane),
          eventLog: "Nueva partida.",
          highlight: "Nueva partida."
        };
      }

      if (current.envidoPending && !current.envidoResolved) {
        const { winner, points } = current.envidoPending;
        const scores = awardPoints(current.scores, winner, points);
        const matchWinner = getMatchWinner(scores);
        const winnerName = getPlayerName(winner, activeLane);

        return {
          ...current,
          scores,
          envidoResolved: true,
          envidoResult: current.envidoPending,
          envidoPending: null,
          eventLog: `${winnerName} cobra ${points}.`,
          highlight: `Envido anotado para ${winnerName}.`,
          outcomeTone: winner === "A" ? "win" : "lose",
          matchWinner
        };
      }

      if (current.trucoPending) {
        return current;
      }

      if (!current.handStarted) {
        return buildOpeningState(current.handNumber, current.scores, activeLane);
      }

      if (
        current.currentTurnSeatId &&
        current.currentTurnSeatId !== getSelectedSeatId(activeLane.role) &&
        current.tableCards.length < tableSeats.length &&
        !current.handClosed &&
        !current.trucoPending
      ) {
        return revealRivalLead(current, activeLane, activeLane.role);
      }

      if (current.tableCards.length >= tableSeats.length && !current.handClosed) {
        return clearResolvedTrick(current, activeLane, activeLane.role);
      }

      if (!current.handClosed) {
        return current;
      }

      return buildOpeningState(current.handNumber + 1, current.scores, activeLane);
    });
  };

  const selectRole = (role) => {
    if (!availableRoles.includes(role)) return;
    if (state.handStarted && !state.matchWinner) return;

    setSelectedRole(role);
    setState(buildRoleSelectState(1, { A: 0, B: 0 }, getLanePair(role)));
  };

  const selectCharacter = (characterId) => {
    if (state.handStarted && !state.matchWinner) return;

    const character = getSelectedCharacterForRole(selectedRole, characterId);
    if (!character || character.role !== selectedRole) return;

    setSelectedCharacterIdsByRole((current) => ({
      ...current,
      [selectedRole]: character.id
    }));

    setState((current) => ({
      ...current,
      eventLog: `${character.name} listo.`,
      highlight: `${character.name} listo para ${selectedRole}.`
    }));
  };

  const phaseData = getPhaseData(state, activeLane);
  const tableFlow = buildTableFlow(state, activeLane, selectedRole, phaseData.nextActorName);
  const dealerSeat = tableFlow.seats.find((seat) => seat.isDealer);
  const dealerTeam = dealerSeat?.team ?? (state.manoTeam === "A" ? "B" : "A");
  const dealerName =
    dealerSeat?.player?.name ??
    getSeatPlayerName(getPreviousSeatId(state.manoSeatId ?? getManoSeatForHand(state.handNumber).seatId));

  return {
    ...state,
    roster,
    config: MATCH_CONFIG,
    roleOptions: availableRoles,
    selectedRole,
    selectedCharacter,
    selectedRoleCharacters,
    activeLane,
    dealerTeam,
    dealerName,
    tableFlow,
    ...phaseData,
    playCard,
    useWeapon,
    negotiatePoints,
    callEnvido,
    settleEnvido,
    callTruco,
    acceptTruco,
    rejectTruco,
    raiseTrucoResponse,
    startHand,
    revealRivalLead: revealRivalLeadAction,
    clearTrick,
    startNextHand,
    applyAgreement,
    // multiplayer host-autoritativo: el host serializa (getSnapshot) y aplica
    // intents remotos (applyIntent); los guests hidratan (hydrate) y nada más
    getSnapshot: () => JSON.parse(JSON.stringify({ state, selectedRole, selectedCharacterIdsByRole })),
    hydrate: (snap) => {
      // el snapshot llega por la red: shape validado antes de pisar el estado
      if (!snap || typeof snap !== "object") return;
      if (!isValidSnapshotState(snap.state)) return;
      if (availableRoles.includes(snap.selectedRole)) setSelectedRole(snap.selectedRole);
      if (
        snap.selectedCharacterIdsByRole &&
        typeof snap.selectedCharacterIdsByRole === "object" &&
        !Array.isArray(snap.selectedCharacterIdsByRole)
      ) {
        setSelectedCharacterIdsByRole(snap.selectedCharacterIdsByRole);
      }
      setState(snap.state);
    },
    // jugada remota de un guest, ya autenticada por silla en App.jsx; acá se
    // valida contra los gates del match (turno, fase, carta en mano) y se
    // aplica. Un intent que no pasa los gates deja el estado como estaba.
    applyIntent: (intent) => {
      if (!intent || typeof intent !== "object") return;
      const seat = tableSeats.find((item) => item.seatId === intent.seatId);
      if (!seat || typeof intent.action !== "string") return;

      setState((current) => {
        const seatTurnOpen =
          current.handStarted &&
          !current.handClosed &&
          !current.envidoPending &&
          !current.trucoPending &&
          current.currentTurnSeatId === seat.seatId &&
          current.tableCards.length < tableSeats.length;

        switch (intent.action) {
          case "playCard": {
            if (!seatTurnOpen) return current;
            const card = (current.handsBySeat?.[seat.seatId] ?? []).find(
              (item) => item.handIndex === intent.payload?.handIndex
            );
            if (!card) return current;
            return playSeatCard(current, seat.seatId, card, activeLane, selectedRole);
          }
          case "callEnvido": {
            const firstCardWindow =
              seatTurnOpen &&
              current.vueltaIndex === 0 &&
              current.tableCards.length === 0 &&
              current.trickHistory.length === 0;
            if (!firstCardWindow || current.envidoResolved || current.activeBet !== 1) return current;
            return applyEnvidoCallBySeat(current, seat, activeLane);
          }
          case "callTruco": {
            if (!seatTurnOpen) return current;
            return applyTrucoCallByTeam(current, seat.team, activeLane);
          }
          case "acceptTruco": {
            const pending = current.trucoPending;
            if (!pending || pending.target !== seat.team || current.handClosed) return current;
            return {
              ...current,
              activeBet: pending.acceptedBet,
              trucoState: getTrucoSlug(pending.label),
              trucoRaiseOwner: seat.team,
              trucoPending: null,
              eventLog: `${pending.label} querido. Vale ${pending.acceptedBet}.`,
              highlight: `${pending.label} querido.`,
              outcomeTone: "neutral"
            };
          }
          case "rejectTruco": {
            const pending = current.trucoPending;
            if (!pending || pending.target !== seat.team || current.handClosed) return current;
            const scoring = applyHandPoints(
              current.scores,
              pending.caller,
              pending.rejectedPoints,
              current.pointsInverted
            );
            const matchWinner = getMatchWinner(scoring.scores);
            const callerName = getPlayerName(pending.caller, activeLane);
            return {
              ...current,
              scores: scoring.scores,
              handClosed: true,
              handWinner: pending.caller,
              scoringWinner: scoring.scoringWinner,
              lastWinner: pending.caller,
              trucoState: `${getTrucoSlug(pending.label)}-rejected`,
              trucoRaiseOwner: null,
              trucoPending: null,
              eventLog: `${pending.label} no querido. Cobra ${callerName}.`,
              highlight: `${pending.label} no querido.`,
              outcomeTone: scoring.scoringWinner === "A" ? "win" : "lose",
              matchWinner
            };
          }
          default:
            return current;
        }
      });
    },
    restartMatch,
    advance,
    nextHand: advance,
    selectRole,
    selectCharacter
  };
}
