import assert from "node:assert/strict";
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

function resolveSixSeatTrick(cards, manoTeam, trickHistory) {
  const maxPower = Math.max(...cards.map((play) => play.card.power));
  const topCards = cards.filter((play) => play.card.power === maxPower);

  if (topCards.length > 1) {
    const tiedTeams = new Set(topCards.map((play) => play.team));
    if (tiedTeams.size === 1)
      return { result: topCards[0].team, winner: topCards[0].team, winnerSeatId: topCards[0].seatId };

    const previousWinner = trickHistory.find((trick) => trick.result !== PARDA)?.winner;
    const winner = previousWinner ?? manoTeam;
    const winnerSeatId =
      topCards.find((play) => play.team === winner)?.seatId ?? cards.find((play) => play.team === winner)?.seatId;
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
  assert.ok(
    trickHistory.every((trick) => trick.cards.length === orderedSeats.length),
    "Every trick should include all six seats."
  );

  return { handWinner, totalPlays, trickCount: trickHistory.length };
}

for (const seat of orderedSeats) {
  const result = simulateHand(seat.seatId);
  assert.ok(result.trickCount >= 2 && result.trickCount <= 3, `Unexpected trick count for ${seat.seatId}.`);
}

console.log("Truco flow OK");
