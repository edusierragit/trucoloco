// ─────────────────────────────────────────────────────────────────────────────
// DUELO DE BARDO · motor
//
// Reductor puro: (estado, acción, rng) → estado. Nada de timers ni de React.
// Con un rng sembrado es determinista, así que sirve para tests y, el día que
// vaya online, para lockstep igual que la mesa.
//
//   attack  → el atacante tira un bardo de su mano (3 cartas)
//   retort  → el defensor elige remate entre 3 (o se le acaba el tiempo)
//   pull    → el que perdió el intercambio se apunta y aprieta
//   over    → saltó el corcho
//
// El revólver NO se recarga entre rondas: las chances van 1/6, 1/5 … 1/1.
// Cada jugador puede girar el tambor UNA vez (vuelve a 1/6).
// ─────────────────────────────────────────────────────────────────────────────

import { BARDOS, BARDO_BY_ID } from "./duelLines.js";

export const CHAMBERS = 6;
export const HAND_SIZE = 3;
export const OPTION_COUNT = 3;

export const other = (side) => (side === "p1" ? "p2" : "p1");

// Tiempo para rematar: arranca holgado y se achica. "Tiempo arena activado".
export function retortTimeMs(round) {
  return Math.max(3600, 8000 - (round - 1) * 650);
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Roba hasta completar la mano; si el mazo se vacía, se rebaraja lo usado
// (menos lo que está en alguna mano).
function drawTo(hand, deck, used, handsInPlay, rng) {
  let nextHand = [...hand];
  let nextDeck = [...deck];
  let nextUsed = [...used];
  while (nextHand.length < HAND_SIZE) {
    if (!nextDeck.length) {
      const busy = new Set([...handsInPlay, ...nextHand]);
      nextDeck = shuffle(nextUsed.filter((id) => !busy.has(id)), rng);
      nextUsed = [];
      if (!nextDeck.length) break;
    }
    nextHand.push(nextDeck.shift());
  }
  return { hand: nextHand, deck: nextDeck, used: nextUsed };
}

export function chamberOdds(revolver) {
  return 1 / (CHAMBERS - revolver.fired);
}

export function createDuel({ rng = Math.random, starter, spins = 1 } = {}) {
  const deck = shuffle(BARDOS.map((entry) => entry.id), rng);
  const first = starter ?? (rng() < 0.5 ? "p1" : "p2");
  const p1 = deck.splice(0, HAND_SIZE);
  const p2 = deck.splice(0, HAND_SIZE);
  return {
    phase: "attack",
    round: 1,
    attacker: first,
    hands: { p1, p2 },
    deck,
    used: [],
    exchange: null,
    puller: null,
    revolver: { cork: Math.floor(rng() * CHAMBERS), fired: 0 },
    spins: { p1: spins, p2: spins },
    lastPull: null,
    loser: null,
    seq: 0
  };
}

function bump(state, patch) {
  return { ...state, ...patch, seq: state.seq + 1 };
}

export function duelReducer(state, action, rng = Math.random) {
  if (!state) return state;

  switch (action.type) {
    case "attack": {
      if (state.phase !== "attack" || action.actor !== state.attacker) return state;
      const hand = state.hands[state.attacker];
      if (!hand.includes(action.bardoId)) return state;
      const correct = BARDO_BY_ID[action.bardoId].remate;
      const decoys = shuffle(
        BARDOS.filter((entry) => entry.id !== action.bardoId).map((entry) => entry.remate),
        rng
      ).slice(0, OPTION_COUNT - 1);
      return bump(state, {
        phase: "retort",
        hands: { ...state.hands, [state.attacker]: hand.filter((id) => id !== action.bardoId) },
        used: [...state.used, action.bardoId],
        exchange: {
          bardoId: action.bardoId,
          by: state.attacker,
          options: shuffle([correct, ...decoys], rng),
          answer: null,
          outcome: null,
          timeMs: retortTimeMs(state.round)
        },
        lastPull: null
      });
    }

    case "retort": {
      const defender = other(state.attacker);
      if (state.phase !== "retort" || action.actor !== defender) return state;
      const answer = action.answer ?? null;
      const right = answer !== null && answer === BARDO_BY_ID[state.exchange.bardoId].remate;
      const outcome = right ? "highlight" : answer === null ? "cagon" : "miss";
      return bump(state, {
        phase: "pull",
        exchange: { ...state.exchange, answer, outcome },
        // remate bueno: el que bardeó se come el gatillo. Si no, el que defendía.
        puller: right ? state.attacker : defender
      });
    }

    case "spin": {
      if (state.phase !== "pull" || action.actor !== state.puller) return state;
      if (state.spins[action.actor] <= 0 || state.revolver.fired === 0) return state;
      return bump(state, {
        revolver: { cork: Math.floor(rng() * CHAMBERS), fired: 0 },
        spins: { ...state.spins, [action.actor]: state.spins[action.actor] - 1 },
        lastPull: { actor: action.actor, kind: "spin" }
      });
    }

    case "pull": {
      if (state.phase !== "pull" || action.actor !== state.puller) return state;
      const { cork, fired } = state.revolver;
      if (fired === cork) {
        return bump(state, {
          phase: "over",
          loser: action.actor,
          revolver: { cork, fired: fired + 1 },
          lastPull: { actor: action.actor, kind: "corchazo" }
        });
      }

      // Remate bueno = ganás la iniciativa (Monkey Island). Si no, el
      // atacante sigue bardeando.
      const nextAttacker = state.exchange.outcome === "highlight" ? other(state.attacker) : state.attacker;
      const otherHand = state.hands[other(nextAttacker)];
      const refill = drawTo(state.hands[nextAttacker], state.deck, state.used, otherHand, rng);
      return bump(state, {
        phase: "attack",
        round: state.round + 1,
        attacker: nextAttacker,
        hands: { ...state.hands, [nextAttacker]: refill.hand },
        deck: refill.deck,
        used: refill.used,
        puller: null,
        revolver: { cork, fired: fired + 1 },
        lastPull: { actor: action.actor, kind: "click" }
      });
    }

    default:
      return state;
  }
}

// ── CPU ─────────────────────────────────────────────────────────────────────
// Sabe más remates a medida que la noche avanza (y el alcohol ayuda).
export function cpuKnows(round, rng) {
  return rng() < Math.min(0.78, 0.42 + round * 0.06);
}

export function cpuChooseRetort(state, rng) {
  const correct = BARDO_BY_ID[state.exchange.bardoId].remate;
  if (cpuKnows(state.round, rng)) return correct;
  const wrong = state.exchange.options.filter((option) => option !== correct);
  return wrong[Math.floor(rng() * wrong.length)] ?? correct;
}

export function cpuChooseBardo(state, rng) {
  const hand = state.hands[state.attacker];
  return hand[Math.floor(rng() * hand.length)];
}

// Gira cuando las chances ya queman (1 en 3 o peor).
export function cpuWantsSpin(state, side) {
  return state.spins[side] > 0 && chamberOdds(state.revolver) >= 1 / 3;
}
