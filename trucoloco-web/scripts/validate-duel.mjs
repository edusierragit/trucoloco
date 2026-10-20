import assert from "node:assert/strict";
import { BARDOS, BARDO_BY_ID } from "../src/game/conflict/duel/duelLines.js";
import {
  CHAMBERS,
  HAND_SIZE,
  cpuChooseBardo,
  cpuChooseRetort,
  createDuel,
  duelReducer,
  mulberry32,
  other
} from "../src/game/conflict/duel/duelEngine.js";

// Repertorio sano: ids y remates únicos (un remate repetido haría ambiguo el acierto).
assert.equal(new Set(BARDOS.map((b) => b.id)).size, BARDOS.length, "ids de bardo repetidos");
assert.equal(new Set(BARDOS.map((b) => b.remate)).size, BARDOS.length, "remates repetidos");
assert.ok(BARDOS.length >= 12, "repertorio demasiado corto");

// Juega un duelo completo con decisiones de CPU para los dos lados.
function playOut(seed, { alwaysRight = null } = {}) {
  const rng = mulberry32(seed);
  let state = createDuel({ rng, starter: "p1" });
  const seen = [];
  for (let guard = 0; guard < 200 && state.phase !== "over"; guard += 1) {
    seen.push(state);
    if (state.phase === "attack") {
      assert.equal(state.hands[state.attacker].length, HAND_SIZE, "mano incompleta");
      state = duelReducer(state, { type: "attack", actor: state.attacker, bardoId: cpuChooseBardo(state, rng) }, rng);
      assert.equal(state.exchange.options.length, 3);
      assert.ok(state.exchange.options.includes(BARDO_BY_ID[state.exchange.bardoId].remate), "falta el remate correcto");
    } else if (state.phase === "retort") {
      const correct = BARDO_BY_ID[state.exchange.bardoId].remate;
      const answer = alwaysRight === null ? cpuChooseRetort(state, rng) : alwaysRight ? correct : null;
      state = duelReducer(state, { type: "retort", actor: other(state.attacker), answer }, rng);
    } else if (state.phase === "pull") {
      state = duelReducer(state, { type: "pull", actor: state.puller }, rng);
    }
  }
  return { state, seen };
}

for (let seed = 1; seed <= 300; seed += 1) {
  const { state } = playOut(seed);
  assert.equal(state.phase, "over", `seed ${seed}: el duelo no terminó`);
  assert.ok(state.loser === "p1" || state.loser === "p2");
  assert.ok(state.revolver.fired <= CHAMBERS, "disparó más que las recámaras");
}

// Determinismo: misma semilla, mismo duelo (base para lockstep online).
assert.deepEqual(playOut(42).state, playOut(42).state, "el motor no es determinista");

// Remate bueno → aprieta el atacante y el defensor gana la iniciativa.
{
  const rng = mulberry32(7);
  let s = createDuel({ rng, starter: "p1" });
  s = duelReducer(s, { type: "attack", actor: "p1", bardoId: s.hands.p1[0] }, rng);
  s = duelReducer(s, { type: "retort", actor: "p2", answer: BARDO_BY_ID[s.exchange.bardoId].remate }, rng);
  assert.equal(s.exchange.outcome, "highlight");
  assert.equal(s.puller, "p1");
  s = { ...s, revolver: { cork: 5, fired: 0 } };
  s = duelReducer(s, { type: "pull", actor: "p1" }, rng);
  assert.equal(s.attacker, "p2", "el remate bueno no pasó la iniciativa");
}

// Timeout → "cagón" y aprieta el defensor; el atacante sigue.
{
  const rng = mulberry32(8);
  let s = createDuel({ rng, starter: "p1" });
  s = duelReducer(s, { type: "attack", actor: "p1", bardoId: s.hands.p1[0] }, rng);
  s = duelReducer(s, { type: "retort", actor: "p2", answer: null }, rng);
  assert.equal(s.exchange.outcome, "cagon");
  assert.equal(s.puller, "p2");
  s = { ...s, revolver: { cork: 5, fired: 0 } };
  s = duelReducer(s, { type: "pull", actor: "p2" }, rng);
  assert.equal(s.attacker, "p1");
}

// Acciones fuera de turno no cambian nada.
{
  const rng = mulberry32(9);
  const s = createDuel({ rng, starter: "p1" });
  assert.equal(duelReducer(s, { type: "attack", actor: "p2", bardoId: s.hands.p2[0] }, rng), s);
  assert.equal(duelReducer(s, { type: "pull", actor: "p1" }, rng), s);
}

// Girar el tambor: una sola vez y solo si ya se disparó algo.
{
  const rng = mulberry32(10);
  let s = createDuel({ rng, starter: "p1" });
  s = duelReducer(s, { type: "attack", actor: "p1", bardoId: s.hands.p1[0] }, rng);
  s = duelReducer(s, { type: "retort", actor: "p2", answer: null }, rng);
  assert.equal(duelReducer(s, { type: "spin", actor: "p2" }, rng), s, "giró con el tambor fresco");
  s = { ...s, revolver: { cork: 5, fired: 3 } };
  const spun = duelReducer(s, { type: "spin", actor: "p2" }, rng);
  assert.equal(spun.revolver.fired, 0);
  assert.equal(spun.spins.p2, 0);
  assert.equal(duelReducer({ ...spun, revolver: { cork: 5, fired: 2 } }, { type: "spin", actor: "p2" }, rng).spins.p2, 0);
}

// Con remates perfectos el duelo igual termina (el revólver no perdona).
assert.equal(playOut(99, { alwaysRight: true }).state.phase, "over");

console.log("Duelo de bardo OK");
