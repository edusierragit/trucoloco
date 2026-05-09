import assert from "node:assert/strict";
import { deck } from "../src/game/data/cards.js";
import {
  PARDA,
  applyHandPoints,
  getEnvidoValue,
  getHandWinner,
  getManoTeam,
  getMatchWinner,
  getPardaCount,
  resolveVuelta
} from "../src/game/rules/truco.js";

const activeLane = {
  human: { name: "Pochex" },
  rival: { name: "Cartachin Norte" }
};

const card = (name, power) => ({ id: name, name, suit: "Espada", power });
const trick = (result) => ({ result });

assert.equal(deck.length, 40, "El mazo tradicional debe tener 40 cartas.");
assert.equal(new Set(deck.map((item) => item.id)).size, 40, "Las cartas tradicionales no deben repetirse.");
assert.equal(getManoTeam(1), "A", "La primera mano la abre el equipo A.");
assert.equal(getManoTeam(2), "B", "La segunda mano alterna al equipo B.");

assert.equal(getHandWinner([trick("A"), trick("A")], "B"), "A", "Dos vueltas ganadas cierran mano.");
assert.equal(getHandWinner([trick("A"), trick("B")], "A"), null, "Una vuelta por lado fuerza tercera.");
assert.equal(getHandWinner([trick("A"), trick("B"), trick("A")], "B"), "A", "La tercera define si van uno y uno.");
assert.equal(getHandWinner([trick(PARDA), trick(PARDA)], "B"), "B", "Dos pardas favorecen a mano.");
assert.equal(getHandWinner([trick(PARDA), trick("A")], "B"), "A", "Primera parda: la segunda define.");
assert.equal(getHandWinner([trick("A"), trick(PARDA)], "B"), "A", "Segunda parda: la primera define.");
assert.equal(getHandWinner([trick("B"), trick("A"), trick(PARDA)], "A"), "B", "Tercera parda: la primera ventaja define.");
assert.equal(getPardaCount([trick(PARDA), trick("A"), trick(PARDA)]), 2, "Cuenta pardas jugadas.");

assert.equal(
  getEnvidoValue([
    { name: "Siete de Oro", suit: "Oro" },
    { name: "Seis de Oro", suit: "Oro" },
    { name: "Rey de Copa", suit: "Copa" }
  ]),
  33,
  "Envido usa las dos mejores del mismo palo mas 20."
);
assert.equal(
  getEnvidoValue([
    { name: "Rey de Oro", suit: "Oro" },
    { name: "Caballo de Copa", suit: "Copa" },
    { name: "Sota de Basto", suit: "Basto" }
  ]),
  0,
  "Figuras sin palo compartido valen cero para envido."
);

assert.deepEqual(applyHandPoints({ A: 0, B: 0 }, "A", 1, false), {
  scores: { A: 1, B: 0 },
  scoringWinner: "A"
});
assert.deepEqual(applyHandPoints({ A: 0, B: 0 }, "A", 1, true), {
  scores: { A: 0, B: 1 },
  scoringWinner: "B"
});
assert.equal(getMatchWinner({ A: 30, B: 12 }), "A", "La partida cierra al llegar a 30.");

const humanWins = resolveVuelta(card("Ancho de Espada", 14), card("Cuatro de Copa", 1), null, activeLane, "A", []);
assert.equal(humanWins.result, "A", "La carta mas fuerte gana la vuelta.");
assert.equal(humanWins.humanPower, 14);

const parda = resolveVuelta(card("Tres de Oro", 10), card("Tres de Copa", 10), null, activeLane, "B", []);
assert.equal(parda.result, PARDA, "Igual fuerza produce parda.");
assert.equal(parda.winner, "B", "Si no hubo ventaja previa, la parda queda para mano.");

const boosted = resolveVuelta(
  card("Sota de Basto", 5),
  card("Caballo de Espada", 6),
  { id: "parca-utileria", effectValue: 2 },
  activeLane,
  "A",
  []
);
assert.equal(boosted.result, "A", "Parca de Utileria debe poder cambiar una vuelta.");
assert.equal(boosted.humanPower, 7);

console.log("Truco rules OK");
