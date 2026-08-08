import assert from "node:assert/strict";
import { applyCombatAction, createDebateState, stepArenaCombat } from "../src/game/conflict/combatState.js";

{
  const start = createDebateState({
    fightIntro: 0,
    playerPos: { x: -0.2, z: 0 },
    rivalPos: { x: 0.2, z: 0 }
  });
  const hit = applyCombatAction(start, "player", "golpe");
  assert.equal(hit.rivalHealth, 88, "A close light punch should damage the rival.");
  assert.ok(hit.lastDamageToRival > 0, "A landed hit should drive impact feedback.");
}

{
  let state = createDebateState({ fightIntro: 0 });
  let sawWindup = false;
  let sawDamage = false;

  for (let frame = 0; frame < 500 && !state.resolved; frame += 1) {
    state = stepArenaCombat(state, new Set(), 0.05);
    sawWindup ||= state.rivalIntent === "windup";
    sawDamage ||= state.playerHealth < 100;
  }

  assert.equal(state.rivalControlled, false, "The CPU should remain active until local P2 takes control.");
  assert.equal(sawWindup, true, "The CPU should telegraph an attack before striking.");
  assert.equal(sawDamage, true, "The CPU should approach and eventually land a hit.");
}

{
  const start = createDebateState({ fightIntro: 0 });
  const manual = stepArenaCombat(start, new Set(["j"]), 0.05);
  assert.equal(manual.rivalControlled, true, "P2 movement should disable the CPU and enable local control.");
  assert.equal(manual.rivalIntent, "manual");
}

console.log("Conflict combat OK");
