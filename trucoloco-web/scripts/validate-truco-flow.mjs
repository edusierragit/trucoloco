import assert from "node:assert/strict";
import { applyIntent, deriveView } from "../src/game/hooks/useTrucolocoMatch.js";
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
    trucoState: "none",
    trucoRaiseOwner: null,
    trucoPending: null,
    pendingAnimationKey: 0,
    eventLog: "",
    highlight: "",
    outcomeTone: "neutral",
    agreementApplied: false,
    ...overrides,
    handsBySeat
  };
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
  const truco = createCoreState({ currentTurnSeatId: "A-negociante" });
  const pending = applyIntent(truco, { seatId: "A-negociante", action: "callTruco" });
  assert.equal(pending.trucoPending.label, "Truco");
  assert.equal(pending.trucoPending.target, "B");
  assert.equal(applyIntent(pending, { seatId: "A-negociante", action: "acceptTruco" }), pending, "Only the target team can accept truco.");

  const accepted = applyIntent(pending, { seatId: "B-negociante", action: "acceptTruco" });
  assert.equal(accepted.activeBet, 2);
  assert.equal(accepted.trucoRaiseOwner, "B");

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
