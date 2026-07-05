import { MATCH_CONFIG } from "../config.js";

export const PARDA = "tie";

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const envidoRankValue = {
  Ancho: 1,
  Dos: 2,
  Tres: 3,
  Cuatro: 4,
  Cinco: 5,
  Seis: 6,
  Siete: 7,
  Sota: 0,
  Caballo: 0,
  Rey: 0
};

export const getCardRankName = (card) => card.name.split(" de ")[0];

export const getEnvidoCardValue = (card) => envidoRankValue[getCardRankName(card)] ?? 0;

export const getEnvidoValue = (hand) => {
  const bySuit = hand.reduce((groups, card) => {
    groups[card.suit] = [...(groups[card.suit] ?? []), getEnvidoCardValue(card)];
    return groups;
  }, {});

  const sameSuitScores = Object.values(bySuit)
    .filter((values) => values.length >= 2)
    .map((values) => {
      const [first = 0, second = 0] = [...values].sort((a, b) => b - a);
      return 20 + first + second;
    });

  if (sameSuitScores.length) return Math.max(...sameSuitScores);
  return Math.max(...hand.map(getEnvidoCardValue), 0);
};

export const resolveEnvido = (humanHand, rivalHand, manoTeam) => {
  const humanValue = getEnvidoValue(humanHand);
  const rivalValue = getEnvidoValue(rivalHand);
  const winner = humanValue === rivalValue ? manoTeam : humanValue > rivalValue ? "A" : "B";

  return {
    humanValue,
    rivalValue,
    winner
  };
};

export const getPlayerName = (team, activeLane) => (team === "A" ? activeLane.human.name : activeLane.rival.name);

export const getMatchWinner = (scores) => {
  if (scores.A >= MATCH_CONFIG.winningScore) return "A";
  if (scores.B >= MATCH_CONFIG.winningScore) return "B";
  return null;
};

export const awardPoints = (scores, winner, points) => {
  const nextScores = { ...scores };
  nextScores[winner] = clamp(nextScores[winner] + points, 0, MATCH_CONFIG.winningScore);
  return nextScores;
};

export const getScoringWinner = (winner, pointsInverted) => {
  if (!winner) return null;
  return pointsInverted ? (winner === "A" ? "B" : "A") : winner;
};

export const applyHandPoints = (scores, winner, points, pointsInverted) => {
  const scoringWinner = getScoringWinner(winner, pointsInverted);
  return {
    scores: awardPoints(scores, scoringWinner, points),
    scoringWinner
  };
};

export const getManoTeam = (handNumber) => (handNumber % 2 === 1 ? "A" : "B");

export const getAdvantageTeam = (trickHistory, manoTeam) =>
  trickHistory.find((trick) => trick.result !== PARDA)?.result ?? manoTeam;

export const getPardaCount = (trickHistory) => trickHistory.filter((trick) => trick.result === PARDA).length;

export const getHandWinner = (trickHistory, manoTeam) => {
  const [first, second, third] = trickHistory.map((trick) => trick.result);

  if (!first || !second) return null;
  if (first === PARDA && second === PARDA) return manoTeam;
  if (first === PARDA) return second;
  if (second === PARDA) return first;
  if (first === second) return first;
  if (!third) return null;
  if (third === PARDA) return first;
  return third;
};

export const getWeaponPowerAdjustment = ({
  basePower,
  seatId,
  selectedSeatId,
  oppositeSeatId,
  selectedRole,
  activeWeapon
}) => {
  if (!activeWeapon || selectedRole !== "Cartachin") {
    return { power: basePower, effect: null };
  }

  if (activeWeapon.id === "parca-utileria" && seatId === selectedSeatId) {
    const delta = activeWeapon.effectValue ?? 2;

    return {
      power: basePower + delta,
      effect: {
        weaponId: activeWeapon.id,
        weaponName: activeWeapon.name,
        delta,
        target: "self"
      }
    };
  }

  if (activeWeapon.id === "bocanada-humo" && seatId === oppositeSeatId) {
    const delta = activeWeapon.effectValue ?? 2;

    return {
      power: Math.max(1, basePower - delta),
      effect: {
        weaponId: activeWeapon.id,
        weaponName: activeWeapon.name,
        delta: -delta,
        target: "rival"
      }
    };
  }

  return { power: basePower, effect: null };
};

export const resolveVuelta = (humanCard, rivalCard, activeWeapon, activeLane, manoTeam, trickHistory) => {
  let humanPower = humanCard.power;
  let rivalPower = rivalCard.power;
  const logs = [
    `${activeLane.human.name} baja ${humanCard.name}. ${activeLane.rival.name} responde con ${rivalCard.name}.`
  ];

  if (activeWeapon?.id === "parca-utileria") {
    humanPower += activeWeapon.effectValue ?? 2;
    logs.push("La Sustancia X le da poder ilegal a tu carta.");
  }

  if (activeWeapon?.id === "bocanada-humo") {
    rivalPower = Math.max(1, rivalPower - (activeWeapon.effectValue ?? 2));
    logs.push("El Pucho en el Ojo le nubla la carta al rival.");
  }

  if (humanPower === rivalPower) {
    const advantageTeam = getAdvantageTeam(trickHistory, manoTeam);
    const advantageName = getPlayerName(advantageTeam, activeLane);
    return {
      result: PARDA,
      winner: advantageTeam,
      humanPower,
      rivalPower,
      eventLog: `${logs.join(" ")} Parda. La ventaja queda para ${advantageName}.`,
      highlight: "Parda.",
      outcomeTone: "draw"
    };
  }

  const humanWon = humanPower > rivalPower;

  return {
    result: humanWon ? "A" : "B",
    winner: humanWon ? "A" : "B",
    humanPower,
    rivalPower,
    eventLog: humanWon
      ? `${logs.join(" ")} ${activeLane.human.name} levanta la vuelta.`
      : `${logs.join(" ")} ${activeLane.rival.name} se lleva la vuelta.`,
    highlight: humanWon ? "Ganaste la vuelta." : "Perdiste la vuelta.",
    outcomeTone: humanWon ? "win" : "lose"
  };
};
