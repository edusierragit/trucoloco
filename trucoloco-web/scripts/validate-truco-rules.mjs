import assert from "node:assert/strict";
import { deck } from "../src/game/data/cards.js";
import {
  PARDA,
  applyHandPoints,
  buildEnvidoChain,
  getEnvidoAcceptedPoints,
  getEnvidoRejectedPoints,
  getEnvidoValue,
  getFaltaEnvidoPoints,
  getHandWinner,
  getManoTeam,
  getMatchWinner,
  getPardaCount,
  getWeaponPowerAdjustment,
  resolveEnvido,
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

assert.deepEqual(
  getWeaponPowerAdjustment({
    basePower: 5,
    seatId: "A-cartachin",
    selectedSeatId: "A-cartachin",
    oppositeSeatId: "B-cartachin",
    selectedRole: "Cartachin",
    activeWeapon: { id: "parca-utileria", name: "Parca de Utileria", effectValue: 2 }
  }),
  {
    power: 7,
    effect: {
      weaponId: "parca-utileria",
      weaponName: "Parca de Utileria",
      delta: 2,
      target: "self"
    }
  },
  "Parca debe subir la carta del Cartachin elegido en mesa 3v3."
);

assert.deepEqual(
  getWeaponPowerAdjustment({
    basePower: 2,
    seatId: "B-cartachin",
    selectedSeatId: "A-cartachin",
    oppositeSeatId: "B-cartachin",
    selectedRole: "Cartachin",
    activeWeapon: { id: "bocanada-humo", name: "Bocanada de Humo", effectValue: 4 }
  }),
  {
    power: 1,
    effect: {
      weaponId: "bocanada-humo",
      weaponName: "Bocanada de Humo",
      delta: -4,
      target: "rival"
    }
  },
  "Bocanada debe bajar la carta rival sin pasar de 1."
);

assert.deepEqual(
  getWeaponPowerAdjustment({
    basePower: 5,
    seatId: "A-cartachin",
    selectedSeatId: "A-cartachin",
    oppositeSeatId: "B-cartachin",
    selectedRole: "Negociante",
    activeWeapon: { id: "parca-utileria", name: "Parca de Utileria", effectValue: 2 }
  }),
  { power: 5, effect: null },
  "Las armas no deben afectar roles que no sean Cartachin."
);

console.log("Truco rules OK");


// ── auditoría de puntos de cantos (sesión 2026-07-03) ────────────────────────
// La escalera del truco: querido paga 2/3/4, no querido paga 1/2/3.
{
  const base = { A: 0, B: 0 };
  assert.deepEqual(applyHandPoints(base, "A", 2, false).scores, { A: 2, B: 0 }, "Truco querido paga 2.");
  assert.deepEqual(applyHandPoints(base, "A", 3, false).scores, { A: 3, B: 0 }, "Retruco querido paga 3.");
  assert.deepEqual(applyHandPoints(base, "A", 4, false).scores, { A: 4, B: 0 }, "Vale cuatro querido paga 4.");
  assert.deepEqual(applyHandPoints(base, "B", 1, false).scores, { A: 0, B: 1 }, "Truco no querido paga 1 al cantor.");
  assert.deepEqual(applyHandPoints(base, "B", 3, false).scores, { A: 0, B: 3 }, "Vale cuatro no querido paga 3 al cantor.");
  // cobro invertido (modificador trucoloco): el que gana no cobra, cobra el otro
  const inverted = applyHandPoints(base, "A", 4, true);
  assert.equal(inverted.scoringWinner, "B", "Con cobro invertido, vale cuatro lo cobra el rival.");
  assert.deepEqual(inverted.scores, { A: 0, B: 4 }, "Cobro invertido acredita los 4 al otro lado.");
}

// El envido: 20 + dos cartas del mismo palo; figuras valen 0.
{
  const mk = (name, suit, power) => ({ name, suit, power });
  const flor33 = [mk("Siete de Oro", "Oro", 11), mk("Seis de Oro", "Oro", 4), mk("Rey de Basto", "Basto", 6)];
  assert.equal(getEnvidoValue(flor33), 33, "7 y 6 del mismo palo = 33 de envido.");
  const negras = [mk("Rey de Espada", "Espada", 6), mk("Caballo de Espada", "Espada", 5), mk("Sota de Oro", "Oro", 4)];
  assert.equal(getEnvidoValue(negras), 20, "Dos figuras del mismo palo = 20 justas.");
  const sueltas = [mk("Cinco de Copa", "Copa", 2), mk("Tres de Basto", "Basto", 10), mk("Sota de Oro", "Oro", 4)];
  assert.equal(getEnvidoValue(sueltas), 5, "Sin palo repetido vale la carta más alta de envido.");
  // empate de envido lo gana el mano
  const r = resolveEnvido(negras, negras, "B");
  assert.equal(r.winner, "B", "Envido parejo lo cobra el que es mano.");
}

// Escalera real de envido: querido suma cadena; no querido cobra lo previo.
{
  const chain = (...calls) => calls.reduce((acc, call) => buildEnvidoChain(acc, call), []);

  assert.equal(getEnvidoAcceptedPoints(chain("envido"), { A: 0, B: 0 }), 2, "Envido querido paga 2.");
  assert.equal(getEnvidoRejectedPoints(chain("envido"), { A: 0, B: 0 }), 1, "Envido no querido paga 1.");
  assert.equal(getEnvidoAcceptedPoints(chain("envido", "envido"), { A: 0, B: 0 }), 4, "Envido + Envido querido paga 4.");
  assert.equal(getEnvidoRejectedPoints(chain("envido", "envido"), { A: 0, B: 0 }), 2, "Segundo envido no querido paga lo previo.");
  assert.equal(getEnvidoAcceptedPoints(chain("envido", "real"), { A: 0, B: 0 }), 5, "Real Envido sobre envido paga 5.");
  assert.equal(getEnvidoRejectedPoints(chain("envido", "real"), { A: 0, B: 0 }), 2, "Real no querido paga lo previo.");
  assert.equal(getFaltaEnvidoPoints({ A: 0, B: 0 }), 30, "Falta al inicio vale 30.");
  assert.equal(getFaltaEnvidoPoints({ A: 25, B: 20 }), 5, "Falta vale lo que le falta al lider.");
  assert.equal(getFaltaEnvidoPoints({ A: 28, B: 29 }), 1, "Falta nunca baja de 1.");
  assert.equal(getEnvidoAcceptedPoints(chain("falta"), { A: 0, B: 0 }), 30, "Falta querida en 0-0 paga 30.");
  assert.equal(getEnvidoAcceptedPoints(chain("envido", "falta"), { A: 25, B: 20 }), 5, "Falta querida usa marcador vigente.");
  assert.equal(getEnvidoAcceptedPoints(chain("envido", "falta"), { A: 28, B: 29 }), 1, "Falta querida en 28-29 paga 1.");
  assert.equal(getEnvidoRejectedPoints(chain("falta"), { A: 0, B: 0 }), 1, "Falta directa no querida paga minimo 1.");
  assert.equal(getEnvidoRejectedPoints(chain("envido", "falta"), { A: 25, B: 20 }), 2, "Falta no querida paga lo acumulado previo.");
  assert.equal(getEnvidoRejectedPoints(chain("envido", "real", "falta"), { A: 25, B: 20 }), 5, "Falta no querida luego de real paga 5.");
}

console.log("Cantos y puntos OK");
