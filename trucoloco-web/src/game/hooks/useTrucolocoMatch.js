import { useEffect, useMemo, useRef, useState } from "react";
import { GAME_MODES, MATCH_CONFIG } from "../config.js";
import { bonusCards, deck, modifiers } from "../data/cards.js";
import { characterOptionsByRole, roleDefinitions, roleOptions as availableRoles, tableSeats, teams } from "../data/characters.js";
import { weaponPool } from "../data/weapons.js";
import {
  PARDA,
  applyHandPoints,
  awardPoints,
  buildEnvidoChain,
  clamp,
  getAdvantageTeam,
  getEnvidoAcceptedPoints,
  getEnvidoRejectedPoints,
  getEnvidoValue,
  getHandWinner,
  getMatchWinner,
  getPardaCount,
  getPlayerName,
  getWeaponPowerAdjustment,
  shouldAutoAcceptEnvido,
  shouldAutoRaiseEnvido
} from "../rules/truco.js";

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
  const rival = teams[rivalTeam].find((player) => player.role === role && player.id !== selectedHuman?.id)
    ?? teams[rivalTeam].find((player) => player.role === role)
    ?? teams.B.find((player) => player.role === role)
    ?? teams.B[0];

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

const getSeatByTeamRole = (team, role) => tableSeats.find((seat) => seat.team === team && seat.role === role) ?? tableSeats[0];
const getSeatById = (seatId) => tableSeats.find((seat) => seat.seatId === seatId) ?? tableSeats[0];
const getPlayerBySeatId = (seatId) => {
  const seat = getSeatById(seatId);
  return getPlayersById()[seat.playerId];
};

const getSeatPlayerName = (seatId) => getPlayerBySeatId(seatId)?.name ?? "Jugador";

const getNextSeatId = (seatId) => {
  const orderedSeats = [...tableSeats].sort((a, b) => a.tableOrder - b.tableOrder);
  const currentIndex = Math.max(0, orderedSeats.findIndex((seat) => seat.seatId === seatId));
  return orderedSeats[(currentIndex + 1) % orderedSeats.length].seatId;
};

const getPreviousSeatId = (seatId) => {
  const orderedSeats = [...tableSeats].sort((a, b) => a.tableOrder - b.tableOrder);
  const currentIndex = Math.max(0, orderedSeats.findIndex((seat) => seat.seatId === seatId));
  return orderedSeats[(currentIndex - 1 + orderedSeats.length) % orderedSeats.length].seatId;
};

const getManoSeatForHand = (handNumber) => {
  const orderedSeats = [...tableSeats].sort((a, b) => a.tableOrder - b.tableOrder);
  return orderedSeats[(handNumber - 1) % orderedSeats.length] ?? orderedSeats[0];
};

const isValidSeatId = (seatId) => tableSeats.some((seat) => seat.seatId === seatId);
const getDefaultSeatIdForRole = (role) => getSeatByTeamRole("A", role).seatId;
const getPerspectiveSeatId = (mySeatId, role = MATCH_CONFIG.defaultRole) =>
  isValidSeatId(mySeatId) ? mySeatId : getDefaultSeatIdForRole(role);
const getOppositeSeatIdForSeat = (seatId) => {
  const seat = getSeatById(seatId);
  return seat.oppositeSeatId ?? getSeatByTeamRole(seat.team === "A" ? "B" : "A", seat.role).seatId;
};
const getLanePairForSeat = (seatId) => {
  const selectedSeat = getSeatById(seatId);
  const oppositeSeat = getSeatById(getOppositeSeatIdForSeat(selectedSeat.seatId));

  return {
    role: selectedSeat.role,
    human: getPlayerBySeatId(selectedSeat.seatId) ?? teams[selectedSeat.team][0],
    rival: getPlayerBySeatId(oppositeSeat.seatId) ?? teams[oppositeSeat.team][0]
  };
};

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
  shuffle(weaponPool).slice(0, 2).map((weapon, index) => ({
    ...weapon,
    handIndex: `${weapon.id}-${index}-${Math.random()}`
  }));

const dealSeatHands = (pool, gameMode = "trucoloco") => {
  const orderedSeats = [...tableSeats].sort((a, b) => a.tableOrder - b.tableOrder);

  const hands = orderedSeats.reduce((acc, seat, seatIndex) => {
    acc[seat.seatId] = pool.slice(seatIndex * 3, seatIndex * 3 + 3).map((card, cardIndex) => ({
      ...card,
      handIndex: buildHandIndex(card.id, seat.seatId, cardIndex)
    }));
    return acc;
  }, {});

  // truco común: mazo español puro, sin cartas absurdas
  if (gameMode === "comun") return hands;

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
  const maxPower = Math.max(...tableCards.map((play) => play.power ?? play.card.power));
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

const syncLaneHands = (state, selectedRole, mySeatId = getDefaultSeatIdForRole(selectedRole)) => {
  const selectedSeatId = getPerspectiveSeatId(mySeatId, selectedRole);
  const oppositeSeatId = getOppositeSeatIdForSeat(selectedSeatId);

  return {
    ...state,
    humanHand: state.handsBySeat?.[selectedSeatId] ?? [],
    rivalHand: state.handsBySeat?.[oppositeSeatId] ?? []
  };
};

const describeWeaponEffect = (effect) => {
  if (!effect) return "";
  return effect.delta > 0
    ? `${effect.weaponName} empuja esa carta.`
    : `${effect.weaponName} ensucia esa carta rival.`;
};

const joinEventParts = (...parts) => parts.filter(Boolean).join(" ");

const buildTablePlay = (seatId, card, tableIndex, activeWeapon, selectedRole, mySeatId = getDefaultSeatIdForRole(selectedRole)) => {
  const seat = getSeatById(seatId);
  const player = getPlayerBySeatId(seatId);
  const selectedSeatId = getPerspectiveSeatId(mySeatId, selectedRole);
  const oppositeSeatId = getOppositeSeatIdForSeat(selectedSeatId);
  const weaponAdjustment = getWeaponPowerAdjustment({
    basePower: card.power,
    seatId,
    selectedSeatId,
    oppositeSeatId,
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

const playSeatCard = (current, seatId, card, activeLane, selectedRole, mySeatId = getDefaultSeatIdForRole(selectedRole)) => {
  if (!card || !current.handStarted || current.handClosed || current.envidoPending || current.trucoPending) {
    return current;
  }

  const seat = getSeatById(seatId);
  const nextHandsBySeat = {
    ...current.handsBySeat,
    [seatId]: (current.handsBySeat?.[seatId] ?? []).filter((item) => item.handIndex !== card.handIndex)
  };
  const playedCard = buildTablePlay(seatId, card, current.tableCards.length, current.activeWeapon, selectedRole, mySeatId);
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
      eventLog: joinEventParts(`${getSeatPlayerName(seatId)} juega.`, weaponEffectLog, `Sigue ${getSeatPlayerName(nextTurnSeatId)}.`),
      highlight: `Vuelta ${currentVuelta}. Actua ${getSeatPlayerName(nextTurnSeatId)}.`,
      outcomeTone: seat.team === "A" ? "neutral" : "neutral",
      pendingAnimationKey: current.pendingAnimationKey + 1
    };

    return syncLaneHands(nextState, selectedRole, mySeatId);
  }

  const resolution = resolveTableTrick(nextTableCards, current.trickHistory, current.manoTeam, current.currentLeadSeatId);
  const nextTrickWins =
    resolution.result === PARDA
      ? current.trickWins
      : {
          ...current.trickWins,
          [resolution.winner]: current.trickWins[resolution.winner] + 1
        };
  const selectedSeatId = getPerspectiveSeatId(mySeatId, selectedRole);
  const oppositeSeatId = getOppositeSeatIdForSeat(selectedSeatId);
  const selectedPlay = nextTableCards.find((play) => play.seatId === selectedSeatId) ?? nextTableCards.find((play) => play.team === "A");
  const oppositePlay = nextTableCards.find((play) => play.seatId === oppositeSeatId) ?? nextTableCards.find((play) => play.team === "B");
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
      nextTableCards.map((play) => describeWeaponEffect(play.weaponEffect)).filter(Boolean).join(" "),
      resolution.highlight
    ),
    highlight: resolution.highlight,
    outcomeTone: resolution.outcomeTone
  };

  if (!handWinner) {
    return syncLaneHands(baseResolvedState, selectedRole, mySeatId);
  }

  const scoring = applyHandAward(current, handWinner, current.activeBet, "hand");
  const matchWinner = scoring.matchWinner;
  const handWinnerName = getPlayerName(handWinner, activeLane);
  const scoringWinnerName = getPlayerName(scoring.scoringWinner, activeLane);

  return syncLaneHands(
    {
      ...baseResolvedState,
      scores: scoring.scores,
      suggestedPoints: scoring.suggestedPoints,
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
    selectedRole,
    mySeatId
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
const BOT_TRUCO_THINKING_MS = 700;

const normalizeScoreMode = (mode) => (mode === "manual" ? "manual" : "auto");
const getScoreMode = (state) => normalizeScoreMode(state?.scoreMode);

const buildSuggestedPoints = ({ kind, winner, scoringWinner = winner, points, scores, deltaA = 0, deltaB = 0 }) => ({
  kind,
  winner,
  scoringWinner,
  points,
  scores,
  deltaA,
  deltaB
});

const applyPointAward = (state, { kind, winner, points, pointsInverted = false }) => {
  const scoring = pointsInverted
    ? applyHandPoints(state.scores, winner, points, pointsInverted)
    : { scores: awardPoints(state.scores, winner, points), scoringWinner: winner };
  const suggestedPoints = buildSuggestedPoints({
    kind,
    winner,
    scoringWinner: scoring.scoringWinner,
    points,
    scores: scoring.scores
  });

  if (getScoreMode(state) === "manual") {
    return {
      scores: state.scores,
      scoringWinner: scoring.scoringWinner,
      suggestedPoints,
      matchWinner: getMatchWinner(state.scores)
    };
  }

  return {
    scores: scoring.scores,
    scoringWinner: scoring.scoringWinner,
    suggestedPoints: null,
    matchWinner: getMatchWinner(scoring.scores)
  };
};

const applyHandAward = (state, winner, points, kind = "hand") =>
  applyPointAward(state, { kind, winner, points, pointsInverted: state.pointsInverted });

export const adjustScoreState = (state, team, delta) => {
  if (!state || (team !== "A" && team !== "B")) return state;

  const numericDelta = Number.isFinite(Number(delta)) ? Math.trunc(Number(delta)) : 0;
  const scores = {
    ...state.scores,
    [team]: clamp((state.scores?.[team] ?? 0) + numericDelta, 0, MATCH_CONFIG.winningScore)
  };

  return {
    ...state,
    scores,
    suggestedPoints: null,
    matchWinner: getMatchWinner(scores)
  };
};

const buildRoleSelectState = (handNumber, scores, activeLane, options = {}) => {
  const manoSeat = getManoSeatForHand(handNumber);
  const manoTeam = manoSeat.team;
  const whoStartsName = getSeatPlayerName(manoSeat.seatId);
  const scoreMode = normalizeScoreMode(options.scoreMode);

  return {
    handStarted: false,
    handNumber,
    scores,
    scoreMode,
    suggestedPoints: null,
    manoTeam,
    manoSeatId: manoSeat.seatId,
    leadTeam: manoTeam,
    gameMode: "trucoloco",
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
    envidoChain: [],
    trucoState: "none",
    trucoRaiseOwner: null,
    trucoPending: null,
    trucoResponse: null,
    agreementApplied: false,
    pendingAnimationKey: 0,
    eventLog: `Sale ${whoStartsName}.`,
    highlight: `Elegi ${activeLane.role}.`,
    outcomeTone: "neutral"
  };
};

const buildOpeningState = (
  handNumber,
  scores,
  activeLane,
  gameMode = "trucoloco",
  mySeatId = getDefaultSeatIdForRole(activeLane.role),
  options = {}
) => {
  const pool = buildSharedPool();
  const manoSeat = getManoSeatForHand(handNumber);
  const manoTeam = manoSeat.team;
  const whoStartsName = getSeatPlayerName(manoSeat.seatId);
  const handsBySeat = dealSeatHands(pool, gameMode);
  const selectedSeatId = getPerspectiveSeatId(mySeatId, activeLane.role);
  const oppositeSeatId = getOppositeSeatIdForSeat(selectedSeatId);
  const scoreMode = normalizeScoreMode(options.scoreMode);

  return {
    handStarted: true,
    handNumber,
    scores,
    scoreMode,
    suggestedPoints: null,
    manoTeam,
    manoSeatId: manoSeat.seatId,
    leadTeam: manoTeam,
    gameMode,
    activeModifier: CLASSIC_MODIFIER,
    activeBet: 1,
    handsBySeat,
    currentLeadSeatId: manoSeat.seatId,
    currentTurnSeatId: manoSeat.seatId,
    humanHand: handsBySeat[selectedSeatId] ?? [],
    rivalHand: handsBySeat[oppositeSeatId] ?? [],
    weaponHand: gameMode === "comun" ? [] : drawWeapons(),
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
    envidoChain: [],
    trucoState: "none",
    trucoRaiseOwner: null,
    trucoPending: null,
    trucoResponse: null,
    agreementApplied: false,
    pendingAnimationKey: 0,
    eventLog: getRoleOpeningLog(activeLane, whoStartsName),
    highlight: `Mano ${handNumber}. Sale ${whoStartsName}.`,
    outcomeTone: "neutral"
  };
};

const revealRivalLead = (state, activeLane, selectedRole, mySeatId = getDefaultSeatIdForRole(selectedRole)) => {
  if (!state.currentTurnSeatId || state.currentTurnSeatId === getPerspectiveSeatId(mySeatId, selectedRole)) {
    return state;
  }

  const hand = state.handsBySeat?.[state.currentTurnSeatId] ?? [];
  const card = pickAutoCard(hand, state.tableCards);
  return playSeatCard(state, state.currentTurnSeatId, card, activeLane, selectedRole, mySeatId);
};

const clearResolvedTrick = (state, activeLane, selectedRole, mySeatId = getDefaultSeatIdForRole(selectedRole)) => {
  if (state.tableCards.length < tableSeats.length || state.handClosed) {
    return state;
  }

  const nextVuelta = state.vueltaIndex + 1;
  const nextTurnSeatId = state.currentLeadSeatId ?? state.manoSeatId ?? getSeatByTeamRole(state.leadTeam, selectedRole).seatId;
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
    selectedRole,
    mySeatId
  );
};

const getPhaseData = (state, activeLane, mySeatId = getDefaultSeatIdForRole(activeLane.role)) => {
  const isNegociante = activeLane.role === "Negociante";
  const isCartachin = activeLane.role === "Cartachin";
  const roleDefinition = roleDefinitions[activeLane.role] ?? roleDefinitions.Cartachin;
  const openingWindow = state.handStarted && state.vueltaIndex === 0 && state.tableCards.length === 0 && !state.handClosed;
  const firstCardWindow = state.handStarted && state.vueltaIndex === 0 && state.tableCards.length === 0 && state.trickHistory.length === 0 && !state.handClosed;
  const displayVueltaNumber =
    !state.handStarted
      ? 1
      : state.handClosed || state.tableCards.length >= tableSeats.length
      ? Math.max(1, state.trickHistory.length)
      : Math.min(state.trickHistory.length + 1, 3);
  const pardaCount = getPardaCount(state.trickHistory);

  const whoStartsName = getSeatPlayerName(state.manoSeatId ?? state.currentLeadSeatId ?? getManoSeatForHand(state.handNumber).seatId);
  const leadPlayerName = getSeatPlayerName(state.currentLeadSeatId ?? state.manoSeatId ?? getManoSeatForHand(state.handNumber).seatId);
  const selectedSeatId = getPerspectiveSeatId(mySeatId, activeLane.role);
  const selectedTeam = getSeatById(selectedSeatId).team;
  const currentTurnSeat = state.currentTurnSeatId ? getSeatById(state.currentTurnSeatId) : null;
  const currentActorName = state.currentTurnSeatId ? getSeatPlayerName(state.currentTurnSeatId) : null;
  const isSelectedSeatTurn = state.currentTurnSeatId === selectedSeatId;
  const tableTrickOpen = Boolean(
    state.handStarted && !state.handClosed && state.currentTurnSeatId && state.tableCards.length < tableSeats.length
  );
  const roleExtrasEnabled = state.gameMode !== "comun";
  const handEndsCopy = "Gana 2 vueltas.";
  const nextTrucoCall = getNextTrucoCall(state.activeBet);
  const humanHasTrucoRaise = !state.trucoRaiseOwner || state.trucoRaiseOwner === selectedTeam;
  const canRaiseTruco = Boolean(nextTrucoCall) && tableTrickOpen && isSelectedSeatTurn && humanHasTrucoRaise && !state.trucoPending;

  if (state.trucoPending) {
    const callerName = getPlayerName(state.trucoPending.caller, activeLane);
    const targetName = getPlayerName(state.trucoPending.target, activeLane);
    const thinking = Boolean(state.trucoPending.thinking);

    return {
      phase: "truco-response",
      phaseLabel: thinking ? `${targetName} lo piensa` : `Responder ${state.trucoPending.label}`,
      phaseHint: thinking ? `${targetName} esta pensando la respuesta.` : `${callerName}: ${state.trucoPending.label}.`,
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
      canRespondTruco: !thinking && state.trucoPending.target === selectedTeam,
      canRaiseTrucoResponse: !thinking && Boolean(getNextTrucoCall(state.trucoPending.acceptedBet)) && state.trucoPending.target === selectedTeam,
      trucoResponseRaiseLabel: getNextTrucoCall(state.trucoPending.acceptedBet)?.label,
      displayVueltaNumber,
      pardaCount,
      whoStartsName,
      leadPlayerName,
      nextActorName: thinking ? targetName : callerName,
      handEndsCopy,
      rolePowerName: roleDefinition.powerName,
      rolePowerSummary: roleDefinition.powerSummary,
      rolePowerStatus: thinking ? "Esperando respuesta." : "Responder truco.",
      rolePowerButtonLabel: roleDefinition.powerName
    };
  }

  if (state.envidoPending && !state.envidoResolved) {
    const envidoReadyToSettle = state.envidoPending.points != null;
    const envidoLabel = getEnvidoChainLabel(state.envidoPending.chain ?? state.envidoChain);
    const callerName = getPlayerName(state.envidoPending.caller, activeLane);

    return {
      phase: "envido-resolution",
      phaseLabel: envidoReadyToSettle ? "Resolver envido" : `Responder ${envidoLabel}`,
      phaseHint: envidoReadyToSettle
        ? state.envidoPending.accepted
          ? "Tantos."
          : "No querido."
        : `${callerName} canta ${envidoLabel}.`,
      stepNumber: 1,
      stepTitle: envidoReadyToSettle ? "Anotar envido" : "Responder envido",
      advanceLabel: envidoReadyToSettle ? "Anotar envido" : null,
      canPlayCard: false,
      canUseWeapon: false,
      canCallEnvido: false,
      canCallTruco: false,
      canAdvance: envidoReadyToSettle,
      canUseRolePower: false,
      canSwitchRole: false,
      canRespondEnvido: !envidoReadyToSettle && state.envidoPending.target === selectedTeam,
      canRaiseEnvidoResponse:
        !envidoReadyToSettle && state.envidoPending.target === selectedTeam && !(state.envidoPending.chain ?? []).some((call) => call.type === "falta"),
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
    const nextLeaderName = getSeatPlayerName(state.currentLeadSeatId ?? state.manoSeatId ?? getManoSeatForHand(state.handNumber).seatId);
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
    const cartachinPowerAvailable = roleExtrasEnabled && rolePowerWindow && isCartachin && !state.weaponUsed;
    const negociantePowerAvailable = roleExtrasEnabled && rolePowerWindow && isNegociante && !state.negotiationUsed;
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
      advanceLabel: isSelectedSeatTurn ? null : roleOpeningDecisionAvailable ? `Dejar jugar a ${currentActorName}` : `${currentActorName} juega`,
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

const getPerspectiveState = (coreState, mySeatId) => {
  const role = getSeatById(getPerspectiveSeatId(mySeatId, coreState?.selectedRole ?? MATCH_CONFIG.defaultRole)).role;
  const selectedSeatId = getPerspectiveSeatId(mySeatId, role);
  const oppositeSeatId = getOppositeSeatIdForSeat(selectedSeatId);

  return {
    ...coreState,
    humanHand: coreState?.handsBySeat?.[selectedSeatId] ?? [],
    rivalHand: coreState?.handsBySeat?.[oppositeSeatId] ?? []
  };
};

export const deriveView = (coreState, mySeatId) => {
  const roleHint = coreState?.selectedRole ?? MATCH_CONFIG.defaultRole;
  const selectedSeatId = getPerspectiveSeatId(mySeatId, roleHint);
  const selectedSeat = getSeatById(selectedSeatId);
  const oppositeSeatId = getOppositeSeatIdForSeat(selectedSeatId);
  const activeLane = getLanePairForSeat(selectedSeatId);
  const perspectiveState = getPerspectiveState(coreState, selectedSeatId);
  const phaseData = getPhaseData(perspectiveState, activeLane, selectedSeatId);
  const tableFlow = buildTableFlow(perspectiveState, activeLane, selectedSeat.role, phaseData.nextActorName);
  const dealerSeat = tableFlow.seats.find((seat) => seat.isDealer);

  return {
    ...phaseData,
    selectedSeatId,
    oppositeSeatId,
    selectedRole: selectedSeat.role,
    activeLane,
    humanHand: perspectiveState.humanHand,
    rivalHand: perspectiveState.rivalHand,
    tableFlow,
    dealerTeam: dealerSeat?.team ?? (perspectiveState.manoTeam === "A" ? "B" : "A"),
    dealerName:
      dealerSeat?.player?.name ??
      getSeatPlayerName(getPreviousSeatId(perspectiveState.manoSeatId ?? getManoSeatForHand(perspectiveState.handNumber).seatId))
  };
};

const canSeatPlayCard = (state, seatId) =>
  Boolean(
    state?.handStarted &&
      !state.handClosed &&
      !state.envidoPending &&
      !state.trucoPending &&
      state.currentTurnSeatId === seatId &&
      state.tableCards.length < tableSeats.length
  );

const canSeatCallEnvido = (state, seatId) =>
  Boolean(
    state?.handStarted &&
      !state.handClosed &&
      !state.envidoResolved &&
      !state.envidoPending &&
      !state.trucoPending &&
      state.activeBet === 1 &&
      state.vueltaIndex === 0 &&
      state.trickHistory.length === 0 &&
      state.currentTurnSeatId === seatId &&
      !state.tableCards.some((play) => play.seatId === seatId)
  );

const canSeatCallTruco = (state, seatId) => {
  const seat = getSeatById(seatId);
  return Boolean(
    state?.handStarted &&
      !state.handClosed &&
      !state.envidoPending &&
      !state.trucoPending &&
      state.currentTurnSeatId === seatId &&
      state.tableCards.length < tableSeats.length &&
      getNextTrucoCall(state.activeBet) &&
      (!state.trucoRaiseOwner || state.trucoRaiseOwner === seat.team)
  );
};

const getEnvidoChainLabel = (chain = []) => {
  const calls = chain.length ? chain : buildEnvidoChain([], "envido");
  return calls.map((call) => call.label).join(" + ");
};

const resolveEnvidoForSeat = (state, seatId, chain = buildEnvidoChain([], "envido"), accepted = true, rejectWinner = null) => {
  const seat = getSeatById(seatId);
  const oppositeSeatId = getOppositeSeatIdForSeat(seatId);
  const oppositeSeat = getSeatById(oppositeSeatId);
  const humanValue = getEnvidoValue(state.handsBySeat?.[seatId] ?? []);
  const rivalValue = getEnvidoValue(state.handsBySeat?.[oppositeSeatId] ?? []);
  const potentialWinner = humanValue === rivalValue ? state.manoTeam : humanValue > rivalValue ? seat.team : oppositeSeat.team;
  const calls = chain.length ? chain : buildEnvidoChain([], "envido");

  return {
    accepted,
    chain: calls,
    humanValue,
    rivalValue,
    potentialWinner,
    winner: accepted ? potentialWinner : rejectWinner ?? seat.team,
    points: accepted ? getEnvidoAcceptedPoints(calls, state.scores) : getEnvidoRejectedPoints(calls, state.scores),
    caller: seat.team,
    target: oppositeSeat.team,
    originSeatId: seatId,
    lastCaller: rejectWinner ?? seat.team
  };
};

const buildPendingEnvido = (state, seatId, callType = "envido") => {
  const previousChain = state.envidoPending?.chain ?? state.envidoChain ?? [];
  const chain = buildEnvidoChain(previousChain, callType);
  const seat = getSeatById(seatId);
  const oppositeSeat = getSeatById(getOppositeSeatIdForSeat(seatId));
  const originSeatId = state.envidoPending?.originSeatId ?? seatId;
  const resolution = resolveEnvidoForSeat(state, originSeatId, chain, true, seat.team);

  return {
    ...resolution,
    accepted: null,
    points: null,
    winner: resolution.potentialWinner,
    caller: seat.team,
    target: state.envidoPending?.lastCaller ?? oppositeSeat.team,
    lastCaller: seat.team,
    originSeatId,
    chain
  };
};

const finalizeEnvidoState = (state, responderSeatId, accepted, activeLane) => {
  const pending = state.envidoPending;
  if (!pending || state.envidoResolved || pending.points != null) return state;

  const responderTeam = getSeatById(responderSeatId).team;
  if (pending.target && pending.target !== responderTeam) return state;

  const resolution = resolveEnvidoForSeat(
    state,
    pending.originSeatId ?? responderSeatId,
    pending.chain ?? state.envidoChain ?? buildEnvidoChain([], "envido"),
    accepted,
    pending.lastCaller
  );
  const responderName = getSeatPlayerName(responderSeatId);
  const winnerName = getPlayerName(resolution.winner, activeLane);
  const label = getEnvidoChainLabel(resolution.chain);

  return {
    ...state,
    envidoPending: resolution,
    envidoChain: resolution.chain,
    eventLog: accepted
      ? `${responderName} quiere. ${winnerName} queda para cobrar ${resolution.points}.`
      : `${responderName} no quiere. ${winnerName} queda para cobrar ${resolution.points}.`,
    highlight: accepted ? `${label} querido: ${winnerName} cobra ${resolution.points}.` : `${label} no querido: ${winnerName} cobra ${resolution.points}.`,
    outcomeTone: resolution.winner === "A" ? "win" : "lose"
  };
};

const settleEnvidoState = (state, activeLane) => {
  if (!state.envidoPending || state.envidoResolved || state.envidoPending.points == null) return state;

  const { winner, points } = state.envidoPending;
  const scoring = applyPointAward(state, { kind: "envido", winner, points });
  const winnerName = getPlayerName(winner, activeLane);

  return {
    ...state,
    scores: scoring.scores,
    suggestedPoints: scoring.suggestedPoints,
    envidoResolved: true,
    envidoResult: state.envidoPending,
    envidoPending: null,
    eventLog: `${winnerName} cobra ${points}.`,
    highlight: `Envido anotado para ${winnerName}.`,
    scoringWinner: scoring.scoringWinner,
    outcomeTone: scoring.scoringWinner === "A" ? "win" : "lose",
    matchWinner: scoring.matchWinner
  };
};

const resolveTrucoPendingForSeat = (state, pending, responderSeatId, activeLane) => {
  if (!pending || state.handClosed) return state;

  const responderSeat = getSeatById(responderSeatId);
  const responderTeam = responderSeat.team;
  const responderHand = state.handsBySeat?.[responderSeatId] ?? [];
  const sourceBet = pending.sourceBet ?? state.activeBet;
  const wants = shouldRivalAcceptTruco(responderHand, sourceBet, state.trickWins);
  const raises = wants && shouldRivalRaiseTruco(responderHand, sourceBet, state.trickWins);
  const counterCall = raises ? getNextTrucoCall(pending.acceptedBet) : null;

  if (counterCall) {
    return {
      ...state,
      trucoPending: {
        caller: responderTeam,
        target: pending.caller,
        label: counterCall.label,
        acceptedBet: counterCall.acceptedBet,
        rejectedPoints: counterCall.rejectedPoints,
        sourceLabel: pending.label,
        sourceBet: pending.acceptedBet
      },
      trucoState: `${getTrucoSlug(pending.label)}-countered`,
      trucoResponse: {
        responder: responderTeam,
        accepted: true,
        raised: true,
        label: pending.label,
        raiseLabel: counterCall.label
      },
      eventLog: `${pending.label}. Resube ${counterCall.label}.`,
      highlight: `${getPlayerName(responderTeam, activeLane)} canta ${counterCall.label}.`,
      outcomeTone: "neutral"
    };
  }

  if (wants) {
    return {
      ...state,
      activeBet: pending.acceptedBet,
      trucoState: getTrucoSlug(pending.label),
      trucoRaiseOwner: responderTeam,
      trucoPending: null,
      trucoResponse: {
        responder: responderTeam,
        accepted: true,
        label: pending.label,
        points: pending.acceptedBet
      },
      eventLog: `${pending.label} querido. Vale ${pending.acceptedBet}.`,
      highlight: `${pending.label} querido.`,
      outcomeTone: "neutral"
    };
  }

  const scoring = applyPointAward(state, {
    kind: "truco",
    winner: pending.caller,
    points: pending.rejectedPoints,
    pointsInverted: state.pointsInverted
  });

  return {
    ...state,
    scores: scoring.scores,
    suggestedPoints: scoring.suggestedPoints,
    handClosed: true,
    handWinner: pending.caller,
    scoringWinner: scoring.scoringWinner,
    lastWinner: pending.caller,
    trucoState: `${getTrucoSlug(pending.label)}-rejected`,
    trucoRaiseOwner: null,
    trucoPending: null,
    trucoResponse: {
      responder: responderTeam,
      accepted: false,
      label: pending.label,
      points: pending.rejectedPoints
    },
    eventLog: `${pending.label} no querido. Cobra ${getPlayerName(pending.caller, activeLane)}.`,
    highlight: `${pending.label} no querido.`,
    outcomeTone: scoring.scoringWinner === "A" ? "win" : "lose",
    matchWinner: scoring.matchWinner
  };
};

export const applyIntent = (coreState, intent = {}) => {
  if (!coreState || !intent.seatId || !isValidSeatId(intent.seatId)) return coreState;

  const seatId = intent.seatId;
  const seat = getSeatById(seatId);
  const activeLane = getLanePairForSeat(seatId);
  const selectedRole = seat.role;
  const selectedTeam = seat.team;
  const oppositeTeam = getSeatById(getOppositeSeatIdForSeat(seatId)).team;
  const payload = intent.payload ?? {};

  switch (intent.action) {
    case "playCard": {
      if (!canSeatPlayCard(coreState, seatId)) return coreState;

      const hand = coreState.handsBySeat?.[seatId] ?? [];
      const card =
        hand.find((item) => item.handIndex === payload.cardId || item.id === payload.cardId || item.handIndex === payload.handIndex) ??
        hand[payload.index ?? 0];

      if (!card) return coreState;
      return playSeatCard(coreState, seatId, card, activeLane, selectedRole, seatId);
    }

    case "callEnvido": {
      if (!canSeatCallEnvido(coreState, seatId)) return coreState;

      const pending = buildPendingEnvido(coreState, seatId, payload.callType ?? "envido");
      const nextState = {
        ...coreState,
        envidoPending: pending,
        envidoChain: pending.chain
      };

      if (typeof payload.accepted === "boolean") {
        return finalizeEnvidoState(nextState, getOppositeSeatIdForSeat(seatId), payload.accepted, activeLane);
      }

      return {
        ...nextState,
        eventLog: `${getSeatPlayerName(seatId)} canta ${pending.chain.at(-1)?.label ?? "Envido"}.`,
        highlight: getEnvidoChainLabel(pending.chain),
        outcomeTone: "neutral"
      };
    }

    case "raiseEnvido": {
      const pending = coreState.envidoPending;
      if (!pending || pending.target !== selectedTeam || coreState.envidoResolved || coreState.handClosed) return coreState;

      const raised = buildPendingEnvido(coreState, seatId, payload.callType ?? "envido");

      return {
        ...coreState,
        envidoPending: raised,
        envidoChain: raised.chain,
        eventLog: `${getSeatPlayerName(seatId)} sube a ${raised.chain.at(-1)?.label ?? "Envido"}.`,
        highlight: getEnvidoChainLabel(raised.chain),
        outcomeTone: "neutral"
      };
    }

    case "acceptEnvido":
      return finalizeEnvidoState(coreState, seatId, true, activeLane);

    case "rejectEnvido":
      return finalizeEnvidoState(coreState, seatId, false, activeLane);

    case "callTruco": {
      if (!canSeatCallTruco(coreState, seatId)) return coreState;

      const nextCall = getNextTrucoCall(coreState.activeBet);
      return {
        ...coreState,
        trucoPending: {
          caller: selectedTeam,
          target: oppositeTeam,
          label: nextCall.label,
          acceptedBet: nextCall.acceptedBet,
          rejectedPoints: nextCall.rejectedPoints,
          sourceBet: coreState.activeBet
        },
        trucoState: `${getTrucoSlug(nextCall.label)}-pending`,
        trucoResponse: null,
        eventLog: `${nextCall.label}. Responde ${getPlayerName(oppositeTeam, activeLane)}.`,
        highlight: `${getPlayerName(selectedTeam, activeLane)} canta ${nextCall.label}.`,
        outcomeTone: "neutral"
      };
    }

    case "acceptTruco": {
      const pending = coreState.trucoPending;
      if (!pending || pending.target !== selectedTeam || coreState.handClosed) return coreState;

      return {
        ...coreState,
        activeBet: pending.acceptedBet,
        trucoState: getTrucoSlug(pending.label),
        trucoRaiseOwner: selectedTeam,
        trucoPending: null,
        trucoResponse: {
          responder: selectedTeam,
          accepted: true,
          label: pending.label,
          points: pending.acceptedBet
        },
        eventLog: `${pending.label} querido. Vale ${pending.acceptedBet}.`,
        highlight: `${pending.label} querido.`,
        outcomeTone: "neutral"
      };
    }

    case "rejectTruco": {
      const pending = coreState.trucoPending;
      if (!pending || pending.target !== selectedTeam || coreState.handClosed) return coreState;

      const scoring = applyPointAward(coreState, {
        kind: "truco",
        winner: pending.caller,
        points: pending.rejectedPoints,
        pointsInverted: coreState.pointsInverted
      });
      const callerName = getPlayerName(pending.caller, activeLane);

      return {
        ...coreState,
        scores: scoring.scores,
        suggestedPoints: scoring.suggestedPoints,
        handClosed: true,
        handWinner: pending.caller,
        scoringWinner: scoring.scoringWinner,
        lastWinner: pending.caller,
        trucoState: `${getTrucoSlug(pending.label)}-rejected`,
        trucoRaiseOwner: null,
        trucoPending: null,
        trucoResponse: {
          responder: selectedTeam,
          accepted: false,
          label: pending.label,
          points: pending.rejectedPoints
        },
        eventLog: `${pending.label} no querido. Cobra ${callerName}.`,
        highlight: `${pending.label} no querido.`,
        outcomeTone: scoring.scoringWinner === "A" ? "win" : "lose",
        matchWinner: scoring.matchWinner
      };
    }

    case "raiseTruco": {
      const pending = coreState.trucoPending;
      if (pending) {
        if (pending.target !== selectedTeam || coreState.handClosed) return coreState;

        const nextCall = getNextTrucoCall(pending.acceptedBet);
        if (!nextCall) return coreState;

        return {
          ...coreState,
          trucoPending: {
            caller: selectedTeam,
            target: pending.caller,
            label: nextCall.label,
            acceptedBet: nextCall.acceptedBet,
            rejectedPoints: nextCall.rejectedPoints,
            sourceLabel: pending.label,
            sourceBet: pending.acceptedBet
          },
          trucoState: `${getTrucoSlug(pending.label)}-countered`,
          trucoResponse: null,
          eventLog: `${pending.label}. Resube ${nextCall.label}.`,
          highlight: `${getPlayerName(selectedTeam, activeLane)} canta ${nextCall.label}.`,
          outcomeTone: "neutral"
        };
      }

      return canSeatCallTruco(coreState, seatId) ? applyIntent(coreState, { seatId, action: "callTruco" }) : coreState;
    }

    case "advance": {
      if (coreState.envidoPending && !coreState.envidoResolved) return settleEnvidoState(coreState, activeLane);
      if (coreState.tableCards.length >= tableSeats.length && !coreState.handClosed) {
        return clearResolvedTrick(coreState, activeLane, selectedRole, seatId);
      }
      return coreState;
    }

    default:
      return coreState;
  }
};

export function useTrucolocoMatch(options = {}) {
  const requestedMySeatId = typeof options === "string" ? options : options?.mySeatId;
  const [selectedRole, setSelectedRole] = useState(MATCH_CONFIG.defaultRole);
  // modo de juego: "comun" (truco puro) o "trucoloco" (con todo el delirio).
  // ?modo=comun en la URL permite probarlo sin UI; el snapshot P2P lo propaga.
  const [gameMode, setGameModeState] = useState(() => {
    if (typeof window !== "undefined") {
      const fromUrl = new URLSearchParams(window.location.search).get("modo");
      if (fromUrl === "comun" || fromUrl === "trucoloco") return fromUrl;
    }
    return MATCH_CONFIG.defaultGameMode ?? "trucoloco";
  });
  const gameModeRef = useRef(gameMode);
  gameModeRef.current = gameMode;
  const [selectedCharacterIdsByRole, setSelectedCharacterIdsByRole] = useState(() => getDefaultCharacterIdsByRole());
  const selectedRoleCharacters = useMemo(() => characterOptionsByRole[selectedRole] ?? [], [selectedRole]);
  const selectedCharacter = useMemo(
    () => getSelectedCharacterForRole(selectedRole, selectedCharacterIdsByRole[selectedRole]),
    [selectedCharacterIdsByRole, selectedRole]
  );
  const mySeatId = useMemo(() => getPerspectiveSeatId(requestedMySeatId, selectedRole), [requestedMySeatId, selectedRole]);
  const activeLane = useMemo(() => getLanePairForSeat(mySeatId), [mySeatId]);
  const roster = useMemo(() => ({ A: teams.A, B: teams.B }), []);
  const [state, setState] = useState(() =>
    buildRoleSelectState(1, { A: 0, B: 0 }, getLanePairForSeat(getDefaultSeatIdForRole(MATCH_CONFIG.defaultRole)))
  );

  useEffect(() => {
    const pending = state.trucoPending;
    if (!pending?.thinking) return undefined;

    const responderSeatId = pending.responderSeatId ?? getSeatByTeamRole(pending.target, activeLane.role).seatId;
    const thinkingStartedAt = pending.thinkingStartedAt;

    const timer = window.setTimeout(() => {
      setState((current) => {
        const livePending = current.trucoPending;
        if (!livePending?.thinking || livePending.thinkingStartedAt !== thinkingStartedAt) return current;
        return resolveTrucoPendingForSeat(current, livePending, responderSeatId, activeLane);
      });
    }, BOT_TRUCO_THINKING_MS);

    return () => window.clearTimeout(timer);
  }, [activeLane, state.trucoPending]);

  const negotiatePoints = () => {
    setState((current) => {
      const openingWindow = current.handStarted && current.vueltaIndex === 0 && current.tableCards.length === 0 && !current.handClosed;

      if (activeLane.role !== "Negociante" || current.negotiationUsed || current.envidoPending || current.trucoPending || !openingWindow) {
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
        eventLog: success ? `Dados ${humanDie}+${rivalDie}. Cobro invertido.` : `Dados ${humanDie}+${rivalDie}. Cobro normal.`,
        highlight: success ? "Negociacion aprobada." : "Negociacion rechazada.",
        outcomeTone: success ? "neutral" : "lose"
      };
    });
  };

  const useWeapon = (weaponId) => {
    setState((current) => {
      const openingWindow = current.handStarted && current.vueltaIndex === 0 && current.tableCards.length === 0 && !current.handClosed;

      if (activeLane.role !== "Cartachin" || current.weaponUsed || current.envidoPending || current.trucoPending || !openingWindow) {
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

  const callEnvido = (callType = "envido") => {
    setState((current) => {
      if (!canSeatCallEnvido(current, mySeatId)) return current;

      const selectedTeam = getSeatById(mySeatId).team;
      const pending = buildPendingEnvido(current, mySeatId, callType);
      let nextState = {
        ...current,
        envidoPending: pending,
        envidoChain: pending.chain,
        eventLog: `${getSeatPlayerName(mySeatId)} canta ${pending.chain.at(-1)?.label ?? "Envido"}.`,
        highlight: getEnvidoChainLabel(pending.chain),
        outcomeTone: "neutral"
      };

      const rivalSeatId = getOppositeSeatIdForSeat(mySeatId);
      const rivalValue = getEnvidoValue(nextState.handsBySeat?.[rivalSeatId] ?? []);
      const ownValue = getEnvidoValue(nextState.handsBySeat?.[mySeatId] ?? []);

      if (shouldAutoRaiseEnvido(rivalValue, pending.chain)) {
        const raised = buildPendingEnvido(nextState, rivalSeatId, "real");
        nextState = {
          ...nextState,
          envidoPending: raised,
          envidoChain: raised.chain,
          eventLog: `${getSeatPlayerName(rivalSeatId)} sube a Real Envido.`,
          highlight: getEnvidoChainLabel(raised.chain),
          outcomeTone: "neutral"
        };
        return finalizeEnvidoState(nextState, mySeatId, shouldAutoAcceptEnvido(ownValue, rivalValue), activeLane);
      }

      return finalizeEnvidoState(nextState, rivalSeatId, shouldAutoAcceptEnvido(rivalValue, ownValue), activeLane);
    });
  };

  const raiseEnvido = (callType = "envido") => {
    setState((current) => applyIntent(current, { seatId: mySeatId, action: "raiseEnvido", payload: { callType } }));
  };

  const acceptEnvido = () => {
    setState((current) => applyIntent(current, { seatId: mySeatId, action: "acceptEnvido" }));
  };

  const rejectEnvido = () => {
    setState((current) => applyIntent(current, { seatId: mySeatId, action: "rejectEnvido" }));
  };

  const settleEnvido = () => {
    setState((current) => settleEnvidoState(current, activeLane));
  };

  const callTruco = () => {
    setState((current) => {
      const selectedSeatId = mySeatId;
      const selectedTeam = getSeatById(selectedSeatId).team;
      const oppositeSeatId = getOppositeSeatIdForSeat(selectedSeatId);
      const oppositeTeam = getSeatById(oppositeSeatId).team;
      const humanActionWindow =
        current.handStarted &&
        !current.handClosed &&
        current.currentTurnSeatId === selectedSeatId &&
        current.tableCards.length < tableSeats.length;

      const nextCall = getNextTrucoCall(current.activeBet);
      const humanCanRaise = !current.trucoRaiseOwner || current.trucoRaiseOwner === selectedTeam;
      if (current.envidoPending || current.trucoPending || !humanActionWindow || !nextCall || !humanCanRaise) return current;

      return {
        ...current,
        trucoPending: {
          caller: selectedTeam,
          target: oppositeTeam,
          label: nextCall.label,
          acceptedBet: nextCall.acceptedBet,
          rejectedPoints: nextCall.rejectedPoints,
          sourceBet: current.activeBet,
          thinking: true,
          responderSeatId: oppositeSeatId,
          thinkingStartedAt: Date.now()
        },
        trucoState: `${getTrucoSlug(nextCall.label)}-pending`,
        trucoResponse: null,
        eventLog: `${nextCall.label}. ${getSeatPlayerName(oppositeSeatId)} lo piensa...`,
        highlight: `${getSeatPlayerName(oppositeSeatId)} lo piensa...`,
        outcomeTone: "neutral"
      };
    });
  };

  const acceptTruco = () => {
    setState((current) => applyIntent(current, { seatId: mySeatId, action: "acceptTruco" }));
  };

  const rejectTruco = () => {
    setState((current) => applyIntent(current, { seatId: mySeatId, action: "rejectTruco" }));
  };

  const raiseTrucoResponse = () => {
    setState((current) => {
      const pending = current.trucoPending;
      const selectedTeam = getSeatById(mySeatId).team;
      if (!pending || pending.target !== selectedTeam || pending.thinking || current.handClosed) return current;

      const nextCall = getNextTrucoCall(pending.acceptedBet);
      if (!nextCall) return current;
      const oppositeSeatId = getOppositeSeatIdForSeat(mySeatId);

      return {
        ...current,
        trucoPending: {
          caller: selectedTeam,
          target: pending.caller,
          label: nextCall.label,
          acceptedBet: nextCall.acceptedBet,
          rejectedPoints: nextCall.rejectedPoints,
          sourceLabel: pending.label,
          sourceBet: pending.acceptedBet,
          thinking: true,
          responderSeatId: oppositeSeatId,
          thinkingStartedAt: Date.now()
        },
        trucoState: `${getTrucoSlug(pending.label)}-countered`,
        trucoResponse: {
          responder: selectedTeam,
          accepted: true,
          raised: true,
          label: pending.label,
          raiseLabel: nextCall.label
        },
        eventLog: `${pending.label}. ${getSeatPlayerName(oppositeSeatId)} piensa ${nextCall.label}...`,
        highlight: `${getSeatPlayerName(oppositeSeatId)} lo piensa...`,
        outcomeTone: "neutral"
      };
    });
  };

  const playCard = (cardId) => {
    setState((current) => {
      const selectedSeatId = mySeatId;

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

      return playSeatCard(current, selectedSeatId, humanCard, activeLane, activeLane.role, mySeatId);
    });
  };

  const startHand = () => {
    setState((current) => {
      if (current.handStarted || current.matchWinner) return current;
      return buildOpeningState(current.handNumber, current.scores, activeLane, gameModeRef.current, mySeatId, {
        scoreMode: current.scoreMode
      });
    });
  };

  const revealRivalLeadAction = () => {
    setState((current) => {
      if (!current.handStarted || current.envidoPending || current.trucoPending || current.handClosed) {
        return current;
      }

      return revealRivalLead(current, activeLane, activeLane.role, mySeatId);
    });
  };

  const clearTrick = () => {
    setState((current) => clearResolvedTrick(current, activeLane, activeLane.role, mySeatId));
  };

  // Acto de acuerdo de negociantes: al cierre de la mano, ambos equipos
  // confirman el cobro (con ajuste chico si negocian). Una sola vez por mano.
  const applyAgreement = (deltaA = 0, deltaB = 0) => {
    setState((current) => {
      if (!current.handClosed || current.matchWinner || current.agreementApplied) return current;
      const da = Math.max(-2, Math.min(2, Math.round(deltaA)));
      const db = Math.max(-2, Math.min(2, Math.round(deltaB)));
      const scores = {
        A: clamp(current.scores.A + da, 0, MATCH_CONFIG.winningScore),
        B: clamp(current.scores.B + db, 0, MATCH_CONFIG.winningScore)
      };
      const manual = getScoreMode(current) === "manual";
      const suggestedPoints = buildSuggestedPoints({
        kind: "agreement",
        winner: null,
        scoringWinner: null,
        points: Math.abs(da) + Math.abs(db),
        scores,
        deltaA: da,
        deltaB: db
      });
      return {
        ...current,
        scores: manual ? current.scores : scores,
        suggestedPoints: manual ? suggestedPoints : null,
        matchWinner: manual ? current.matchWinner : getMatchWinner(scores),
        agreementApplied: true,
        eventLog: da || db
          ? `Acuerdo sellado: ${da >= 0 ? `+${da}` : da} casa, ${db >= 0 ? `+${db}` : db} visita.`
          : "Acuerdo sellado: cobro automático.",
        highlight: manual ? "Acuerdo sugerido. Anotador manual decide." : da || db ? "Los negociantes movieron la aguja." : "Cobro confirmado."
      };
    });
  };

  const startNextHand = () => {
    setState((current) => {
      if (!current.handClosed || current.matchWinner) return current;
      return buildOpeningState(current.handNumber + 1, current.scores, activeLane, gameModeRef.current, mySeatId, {
        scoreMode: current.scoreMode
      });
    });
  };

  const restartMatch = () => {
    setState((current) => {
      if (!current.matchWinner) return current;

      return {
        ...buildRoleSelectState(1, { A: 0, B: 0 }, activeLane, { scoreMode: current.scoreMode }),
        eventLog: "Nueva partida.",
        highlight: "Nueva partida."
      };
    });
  };

  const returnToRoleSelect = () => {
    setState((current) => ({
      ...buildRoleSelectState(current.handNumber, current.scores, activeLane, { scoreMode: current.scoreMode }),
      eventLog: "Volviste a elegir rol.",
      highlight: "Elegí rol y personaje antes de repartir."
    }));
  };

  const advance = () => {
    setState((current) => {
      if (current.matchWinner) {
        return {
          ...buildRoleSelectState(1, { A: 0, B: 0 }, activeLane, { scoreMode: current.scoreMode }),
          eventLog: "Nueva partida.",
          highlight: "Nueva partida."
        };
      }

      if (current.envidoPending && !current.envidoResolved) {
        return settleEnvidoState(current, activeLane);
      }

      if (current.trucoPending) {
        return current;
      }

      if (!current.handStarted) {
        return buildOpeningState(current.handNumber, current.scores, activeLane, gameModeRef.current, mySeatId, {
          scoreMode: current.scoreMode
        });
      }

      if (
        current.currentTurnSeatId &&
        current.currentTurnSeatId !== mySeatId &&
        current.tableCards.length < tableSeats.length &&
        !current.handClosed &&
        !current.trucoPending
      ) {
        return revealRivalLead(current, activeLane, activeLane.role, mySeatId);
      }

      if (current.tableCards.length >= tableSeats.length && !current.handClosed) {
        return clearResolvedTrick(current, activeLane, activeLane.role, mySeatId);
      }

      if (!current.handClosed) {
        return current;
      }

      return buildOpeningState(current.handNumber + 1, current.scores, activeLane, gameModeRef.current, mySeatId, {
        scoreMode: current.scoreMode
      });
    });
  };

  const setScoreMode = (mode) => {
    setState((current) => ({
      ...current,
      scoreMode: normalizeScoreMode(mode),
      suggestedPoints: null
    }));
  };

  const adjustScore = (team, delta) => {
    setState((current) => adjustScoreState(current, team, delta));
  };

  const setGameMode = (mode) => {
    if (mode !== "comun" && mode !== "trucoloco") return;
    if (state.handStarted && !state.matchWinner) return;
    setGameModeState(mode);
  };

  const selectRole = (role) => {
    if (!availableRoles.includes(role)) return;
    if (state.handStarted && !state.matchWinner) return;

    setSelectedRole(role);
    setState((current) =>
      buildRoleSelectState(1, { A: 0, B: 0 }, getLanePairForSeat(getPerspectiveSeatId(requestedMySeatId, role)), {
        scoreMode: current.scoreMode
      })
    );
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

  const view = deriveView({ ...state, selectedRole: activeLane.role }, mySeatId);

  return {
    ...state,
    roster,
    config: MATCH_CONFIG,
    roleOptions: availableRoles,
    gameMode,
    gameModeInfo: GAME_MODES[gameMode],
    setGameMode,
    selectedRole,
    selectedCharacter,
    selectedRoleCharacters,
    activeLane: view.activeLane,
    selectedSeatId: view.selectedSeatId,
    oppositeSeatId: view.oppositeSeatId,
    humanHand: view.humanHand,
    rivalHand: view.rivalHand,
    dealerTeam: view.dealerTeam,
    dealerName: view.dealerName,
    tableFlow: view.tableFlow,
    ...view,
    // truco común: se apaga todo lo que no es truco (armas, poderes, acuerdo).
    // El acuerdo se reporta sellado apenas cierra la mano para no gatear nada.
    ...(gameMode === "comun"
      ? {
          canUseWeapon: false,
          canUseRolePower: false,
          weaponHand: [],
          agreementApplied: state.handClosed ? true : state.agreementApplied
        }
      : null),
    playCard,
    useWeapon,
    negotiatePoints,
    callEnvido,
    settleEnvido,
    callTruco,
    acceptTruco,
    rejectTruco,
    raiseTrucoResponse,
    raiseEnvido,
    acceptEnvido,
    rejectEnvido,
    setScoreMode,
    adjustScore,
    startHand,
    revealRivalLead: revealRivalLeadAction,
    clearTrick,
    startNextHand,
    applyAgreement,
    // multiplayer v2: el host aplica la jugada que un guest PROPONE desde su
    // silla. applyIntent valida turno/derechos; una jugada inválida no muta.
    applyRemoteIntent: (intent) => {
      setState((current) => applyIntent(current, intent));
    },
    // espejo multiplayer v1: el host serializa, los guests hidratan
    getSnapshot: () => JSON.parse(JSON.stringify({ state, selectedRole, selectedCharacterIdsByRole, gameMode })),
    hydrate: (snap) => {
      if (!snap || typeof snap !== "object" || !snap.state) return;
      if (snap.selectedRole) setSelectedRole(snap.selectedRole);
      if (snap.selectedCharacterIdsByRole) setSelectedCharacterIdsByRole(snap.selectedCharacterIdsByRole);
      if (snap.gameMode === "comun" || snap.gameMode === "trucoloco") setGameModeState(snap.gameMode);
      setState(snap.state);
    },
    restartMatch,
    returnToRoleSelect,
    advance,
    nextHand: advance,
    selectRole,
    selectCharacter
  };
}
