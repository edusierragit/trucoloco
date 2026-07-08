import assert from "node:assert/strict";
import { adjustScoreState, applyIntent, deriveView } from "../src/game/hooks/useTrucolocoMatch.js";
import { deck } from "../src/game/data/cards.js";
import { tableSeats } from "../src/game/data/characters.js";
import { getHandWinner, PARDA } from "../src/game/rules/truco.js";

const orderedSeats = [...tableSeats].sort((a, b) => a.tableOrder - b.tableOrder);
const getNextSeatId = (seatId) => {
  const index = orderedSeats.findIndex((seat) => seat.seatId === seatId);
  return orderedSeats[(index + 1) % orderedSeats.length].seatId;
};

const getSeat = (seatId) => orderedSeats.find((seat) => seat.seatId === seatId);

function dealDeterministicHands() {
  return orderedSeats.reduce((hands, seat, seatIndex) => {
    hands[seat.seatId] = deck.slice(seatIndex * 3, seatIndex * 3 + 3).map((card, cardIndex) => ({
      ...card,
      handIndex: `${seat.seatId}-${card.id}-${cardIndex}`
    }));
    return hands;
  }, {});
}

function dealTeamAWinsFastHands() {
  return orderedSeats.reduce((hands, seat, seatIndex) => {
    hands[seat.seatId] = [0, 1].map((_, cardIndex) => ({
      ...deck[(seatIndex * 3 + cardIndex) % deck.length],
      power: seat.team === "A" ? 30 - seatIndex - cardIndex : 1 + seatIndex + cardIndex,
      handIndex: `close-${seat.seatId}-${cardIndex}`
    }));
    return hands;
  }, {});
}

function createCoreState(overrides = {}) {
  const handsBySeat = overrides.handsBySeat ?? dealDeterministicHands();
  return {
    handStarted: true,
    handNumber: 1,
    selectedRole: "Negociante",
    scores: { A: 0, B: 0 },
    manoTeam: "A",
    manoSeatId: "A-negociante",
    leadTeam: "A",
    gameMode: "trucoloco",
    activeModifier: null,
    activeBet: 1,
    scoreMode: "auto",
    suggestedPoints: null,
    handsBySeat,
    currentLeadSeatId: "A-negociante",
    currentTurnSeatId: "A-negociante",
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
    pendingAnimationKey: 0,
    eventLog: "",
    highlight: "",
    outcomeTone: "neutral",
    agreementApplied: false,
    ...overrides,
    handsBySeat
  };
}

function playUntilClosed(state) {
  let current = state;
  let guard = 0;

  while (!current.handClosed && guard < 40) {
    if (current.currentTurnSeatId && current.tableCards.length < orderedSeats.length) {
      const card = current.handsBySeat[current.currentTurnSeatId]?.[0];
      assert.ok(card, `Seat ${current.currentTurnSeatId} should have a card.`);
      current = applyIntent(current, {
        seatId: current.currentTurnSeatId,
        action: "playCard",
        payload: { cardId: card.handIndex }
      });
    } else {
      current = applyIntent(current, { seatId: current.currentLeadSeatId ?? "A-negociante", action: "advance" });
    }
    guard += 1;
  }

  assert.equal(current.handClosed, true, "The hand should close during simulation.");
  return current;
}

function resolveSixSeatTrick(cards, manoTeam, trickHistory) {
  const maxPower = Math.max(...cards.map((play) => play.card.power));
  const topCards = cards.filter((play) => play.card.power === maxPower);

  if (topCards.length > 1) {
    const tiedTeams = new Set(topCards.map((play) => play.team));
    if (tiedTeams.size === 1) return { result: topCards[0].team, winner: topCards[0].team, winnerSeatId: topCards[0].seatId };

    const previousWinner = trickHistory.find((trick) => trick.result !== PARDA)?.winner;
    const winner = previousWinner ?? manoTeam;
    const winnerSeatId = topCards.find((play) => play.team === winner)?.seatId ?? cards.find((play) => play.team === winner)?.seatId;
    return { result: PARDA, winner, winnerSeatId };
  }

  return {
    result: topCards[0].team,
    winner: topCards[0].team,
    winnerSeatId: topCards[0].seatId
  };
}

function simulateHand(manoSeatId) {
  const hands = dealDeterministicHands();
  const manoTeam = getSeat(manoSeatId).team;
  const trickHistory = [];
  let currentLeadSeatId = manoSeatId;
  let totalPlays = 0;

  while (!getHandWinner(trickHistory, manoTeam) && trickHistory.length < 3) {
    const tableCards = [];
    let currentSeatId = currentLeadSeatId;

    while (tableCards.length < orderedSeats.length) {
      const hand = hands[currentSeatId];
      assert.ok(hand?.length, `Seat ${currentSeatId} should have a card to play.`);
      const card = hand.shift();
      const seat = getSeat(currentSeatId);
      tableCards.push({ seatId: currentSeatId, team: seat.team, card });
      totalPlays += 1;
      currentSeatId = getNextSeatId(currentSeatId);
    }

    const resolution = resolveSixSeatTrick(tableCards, manoTeam, trickHistory);
    trickHistory.push({
      index: trickHistory.length + 1,
      result: resolution.result,
      winner: resolution.winner,
      winnerSeatId: resolution.winnerSeatId,
      cards: tableCards
    });
    currentLeadSeatId = resolution.winnerSeatId;
  }

  const handWinner = getHandWinner(trickHistory, manoTeam);
  assert.ok(handWinner, "The hand should close in at most three tricks.");
  assert.ok(totalPlays <= 18, "A hand should never require more than 18 card plays.");
  assert.ok(trickHistory.every((trick) => trick.cards.length === orderedSeats.length), "Every trick should include all six seats.");

  return { handWinner, totalPlays, trickCount: trickHistory.length };
}

for (const seat of orderedSeats) {
  const result = simulateHand(seat.seatId);
  assert.ok(result.trickCount >= 2 && result.trickCount <= 3, `Unexpected trick count for ${seat.seatId}.`);
}

{
  const state = createCoreState();
  const cartachinView = deriveView(state, "A-cartachin");
  const negocianteView = deriveView(state, "B-negociante");

  assert.deepEqual(cartachinView.humanHand, state.handsBySeat["A-cartachin"], "A-cartachin should see its own hand.");
  assert.deepEqual(negocianteView.humanHand, state.handsBySeat["B-negociante"], "B-negociante should see its own hand.");
  assert.notDeepEqual(cartachinView.humanHand, negocianteView.humanHand, "Different seats should not share perspective hands.");
  assert.equal(cartachinView.selectedSeatId, "A-cartachin");
  assert.equal(negocianteView.selectedSeatId, "B-negociante");
}

{
  const state = createCoreState({ currentTurnSeatId: "B-negociante" });
  const snapshot = JSON.parse(JSON.stringify(state));
  assert.deepEqual(deriveView(snapshot, "B-negociante"), deriveView(state, "B-negociante"), "Hydrated snapshots should derive the same view.");
}

{
  const outOfTurn = createCoreState({ currentTurnSeatId: "B-negociante" });
  const invalid = applyIntent(outOfTurn, {
    seatId: "A-cartachin",
    action: "playCard",
    payload: { cardId: outOfTurn.handsBySeat["A-cartachin"][0].handIndex }
  });
  assert.equal(invalid, outOfTurn, "Out-of-turn card intents should be ignored.");

  const inTurn = createCoreState({ selectedRole: "Cartachin", currentTurnSeatId: "A-cartachin" });
  const card = inTurn.handsBySeat["A-cartachin"][0];
  const played = applyIntent(inTurn, { seatId: "A-cartachin", action: "playCard", payload: { cardId: card.handIndex } });
  assert.notEqual(played, inTurn, "Valid card intents should produce a new state.");
  assert.equal(played.handsBySeat["A-cartachin"].length, inTurn.handsBySeat["A-cartachin"].length - 1);
  assert.equal(played.tableCards.at(-1).seatId, "A-cartachin");
  assert.equal(played.tableCards.at(-1).card.handIndex, card.handIndex);
}

{
  const firstTurn = createCoreState({ currentTurnSeatId: "A-negociante" });
  assert.equal(deriveView(firstTurn, "A-negociante").canCallEnvido, true, "Envido should be available before the first own card.");
  assert.equal(deriveView({ ...firstTurn, vueltaIndex: 1 }, "A-negociante").canCallEnvido, false, "Envido should only be available on first vuelta.");
  assert.equal(
    deriveView(
      {
        ...firstTurn,
        tableCards: [{ seatId: "A-negociante", team: "A", card: firstTurn.handsBySeat["A-negociante"][0] }]
      },
      "A-negociante"
    ).canCallEnvido,
    false,
    "Envido should not be available after the seat already played."
  );
  assert.equal(
    deriveView(
      {
        ...firstTurn,
        trucoPending: { caller: "B", target: "A", label: "Truco", acceptedBet: 2, rejectedPoints: 1 }
      },
      "A-negociante"
    ).canCallEnvido,
    false,
    "Envido should not be available with truco pending."
  );

  const tieHands = dealDeterministicHands();
  tieHands["A-negociante"] = tieHands["B-negociante"].map((card, index) => ({ ...card, handIndex: `tie-A-${index}` }));
  const tieState = createCoreState({ handsBySeat: tieHands, manoTeam: "B", manoSeatId: "B-negociante", currentTurnSeatId: "A-negociante" });
  const envido = applyIntent(tieState, { seatId: "A-negociante", action: "callEnvido" });
  assert.equal(envido.envidoPending.winner, "B", "Envido ties should respect mano.");
}

{
  const pending = applyIntent(createCoreState({ currentTurnSeatId: "A-negociante" }), {
    seatId: "A-negociante",
    action: "callEnvido"
  });
  assert.equal(pending.envidoPending.points, null, "Envido waits for a response before settling.");
  assert.equal(pending.envidoChain.map((call) => call.type).join(">"), "envido");

  const raised = applyIntent(pending, {
    seatId: "B-negociante",
    action: "raiseEnvido",
    payload: { callType: "real" }
  });
  assert.equal(raised.envidoChain.map((call) => call.type).join(">"), "envido>real", "Envido can be raised to real.");

  const rejected = applyIntent(raised, { seatId: "A-negociante", action: "rejectEnvido" });
  assert.equal(rejected.envidoPending.accepted, false);
  assert.equal(rejected.envidoPending.points, 2, "Real no querido after envido pays previous accumulated points.");

  const settled = applyIntent(rejected, { seatId: "A-negociante", action: "advance" });
  assert.equal(settled.envidoResolved, true);
  assert.equal(settled.scores[rejected.envidoPending.winner], 2);
}

{
  const truco = createCoreState({ currentTurnSeatId: "A-negociante" });
  const pending = applyIntent(truco, { seatId: "A-negociante", action: "callTruco" });
  assert.equal(pending.trucoPending.label, "Truco");
  assert.equal(pending.trucoPending.target, "B");
  assert.equal(applyIntent(pending, { seatId: "A-negociante", action: "acceptTruco" }), pending, "Only the target team can accept truco.");

  const accepted = applyIntent(pending, { seatId: "B-negociante", action: "acceptTruco" });
  assert.equal(accepted.activeBet, 2);
  assert.equal(accepted.trucoRaiseOwner, "B");
  assert.equal(accepted.handClosed, false, "Truco querido must not close the hand.");
  assert.equal(accepted.trucoResponse.accepted, true);

  const followCard = accepted.handsBySeat["A-negociante"][0];
  const followed = applyIntent(accepted, {
    seatId: "A-negociante",
    action: "playCard",
    payload: { cardId: followCard.handIndex }
  });
  assert.equal(followed.tableCards.length, 1, "After truco querido, the current player can keep playing.");

  const rejectedTruco = applyIntent(pending, { seatId: "B-negociante", action: "rejectTruco" });
  assert.equal(rejectedTruco.handClosed, true);
  assert.equal(rejectedTruco.scores.A, 1, "Truco no querido pays 1 to caller.");
  assert.equal(rejectedTruco.trucoResponse.accepted, false);

  const wrongRaiseState = { ...accepted, currentTurnSeatId: "A-negociante" };
  assert.equal(
    applyIntent(wrongRaiseState, { seatId: "A-negociante", action: "callTruco" }),
    wrongRaiseState,
    "The same team should not raise twice in a row."
  );

  const retrucoPending = applyIntent({ ...accepted, currentTurnSeatId: "B-negociante" }, { seatId: "B-negociante", action: "callTruco" });
  assert.equal(retrucoPending.trucoPending.label, "Retruco");
  assert.equal(retrucoPending.trucoPending.target, "A");
  assert.equal(
    applyIntent(retrucoPending, { seatId: "B-negociante", action: "rejectTruco" }),
    retrucoPending,
    "Only the target team can reject truco."
  );

  const valeCuatroPending = applyIntent(retrucoPending, { seatId: "A-negociante", action: "raiseTruco" });
  assert.equal(valeCuatroPending.trucoPending.label, "Vale cuatro");
  assert.equal(valeCuatroPending.trucoPending.target, "B");

  const retrucoRejected = applyIntent(retrucoPending, { seatId: "A-negociante", action: "rejectTruco" });
  assert.equal(retrucoRejected.scores.B, 2, "Retruco no querido pays 2 to caller.");

  const valeCuatroAccepted = applyIntent(valeCuatroPending, { seatId: "B-negociante", action: "acceptTruco" });
  assert.equal(valeCuatroAccepted.activeBet, 4, "Vale cuatro querido sets hand value to 4.");

  const valeCuatroRejected = applyIntent(valeCuatroPending, { seatId: "B-negociante", action: "rejectTruco" });
  assert.equal(valeCuatroRejected.scores.A, 3, "Vale cuatro no querido pays 3 to caller.");
}

{
  let manual = createCoreState({ scoreMode: "manual", currentTurnSeatId: "A-negociante" });
  manual = adjustScoreState(manual, "A", 35);
  assert.deepEqual(manual.scores, { A: 30, B: 0 }, "Manual adjust clamps up to 30.");
  assert.equal(manual.matchWinner, "A", "Manual adjust can close match.");
  manual = adjustScoreState(manual, "A", -50);
  assert.deepEqual(manual.scores, { A: 0, B: 0 }, "Manual adjust clamps down to 0.");
  assert.equal(manual.matchWinner, null);

  const manualTrucoPending = applyIntent(createCoreState({ scoreMode: "manual", currentTurnSeatId: "A-negociante" }), {
    seatId: "A-negociante",
    action: "callTruco"
  });
  const manualTrucoRejected = applyIntent(manualTrucoPending, { seatId: "B-negociante", action: "rejectTruco" });
  assert.deepEqual(manualTrucoRejected.scores, { A: 0, B: 0 }, "Manual mode does not auto-score rejected truco.");
  assert.equal(manualTrucoRejected.suggestedPoints.kind, "truco");
  assert.equal(manualTrucoRejected.suggestedPoints.points, 1);
  assert.equal(manualTrucoRejected.suggestedPoints.scoringWinner, "A");

  const manualEnvidoPending = applyIntent(createCoreState({ scoreMode: "manual", currentTurnSeatId: "A-negociante" }), {
    seatId: "A-negociante",
    action: "callEnvido",
    payload: { accepted: false }
  });
  const manualEnvidoSettled = applyIntent(manualEnvidoPending, { seatId: "A-negociante", action: "advance" });
  assert.deepEqual(manualEnvidoSettled.scores, { A: 0, B: 0 }, "Manual mode does not auto-score envido.");
  assert.equal(manualEnvidoSettled.suggestedPoints.kind, "envido");

  const closedManual = playUntilClosed(
    createCoreState({
      scoreMode: "manual",
      handsBySeat: dealTeamAWinsFastHands()
    })
  );
  assert.deepEqual(closedManual.scores, { A: 0, B: 0 }, "Manual mode does not auto-score hand close.");
  assert.equal(closedManual.suggestedPoints.kind, "hand");
  assert.equal(closedManual.suggestedPoints.points, 1);
}

{
  const comun = createCoreState({
    selectedRole: "Cartachin",
    gameMode: "comun",
    currentTurnSeatId: "A-cartachin",
    weaponHand: []
  });
  const view = deriveView(comun, "A-cartachin");
  assert.equal(view.canUseWeapon, false, "Truco comun should not expose Cartachin weapons.");
  assert.equal(comun.weaponHand.length, 0, "Truco comun core state should carry no weapon hand.");
}

console.log("Truco flow OK");
