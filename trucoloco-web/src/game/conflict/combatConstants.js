import { weapons } from "../data/weapons";

export const RING_START_STATE = {
  mode: "ring",
  kind: "idle",
  token: 0,
  player: 0,
  rival: 0,
  playerHealth: 100,
  rivalHealth: 100,
  lastDamageToPlayer: 0,
  lastDamageToRival: 0,
  hitStrength: 0,
  fightIntro: 1.85,
  playerCooldown: 0,
  rivalCooldown: 0,
  playerActionPulse: 0,
  rivalActionPulse: 0,
  playerHitStun: 0,
  rivalHitStun: 0,
  playerPos: { x: -0.72, z: 0.18 },
  rivalPos: { x: 0.72, z: -0.18 },
  playerFacing: 0,
  rivalFacing: Math.PI,
  playerDash: 0,
  rivalDash: 0,
  playerMoving: 0,
  rivalMoving: 0,
  playerEngaged: false,
  rivalControlled: false,
  playerLane: -0.18,
  rivalLane: 0.18,
  playerStamina: 3,
  rivalStamina: 3,
  playerGuard: 0,
  rivalGuard: 0,
  rivalIntent: "neutral",
  rivalAttack: "none",
  rivalTargetLane: 0.18,
  vulnerable: false,
  streak: 0,
  crowdHeat: 0,
  pull: 0,
  playerTrigger: 0,
  rivalTrigger: 0,
  playerChamber: 4,
  rivalChamber: 5,
  turn: "player",
  resolved: false,
  lastMove: "Entraste al ring. WASD mueve, click/Q pega, E fuerte, R especial, Shift esquiva y F bloquea."
};

export const RING_BOUNDS = { x: 1.5, z: 1.12 };

export const HELD_COMBAT_KEYS = ["w", "a", "s", "d", "shift", "i", "j", "k", "l", "p"];

export const ARROW_COMBAT_KEYS = ["arrowleft", "arrowright", "arrowup", "arrowdown"];

const BASE_ACTION_CONFIGS = {
  remate: { label: "Especial", cost: 2.1, cooldown: 1.1, range: 0.92, damage: 34, stunDamage: 26, knockback: 0.36 },
  empujon: { label: "Fuerte", cost: 1.35, cooldown: 0.62, range: 0.78, damage: 22, stunDamage: 18, knockback: 0.3 },
  golpe: { label: "Piña", cost: 0.55, cooldown: 0.28, range: 0.64, damage: 12, stunDamage: 20, knockback: 0.16 }
};

function getActiveWeapon(activeWeapon) {
  if (!activeWeapon) return null;
  const id = typeof activeWeapon === "string" ? activeWeapon : activeWeapon.id;
  return weapons.find((weapon) => weapon.id === id) ?? null;
}

export function getCombatActionConfig(kind, weaponContext = {}) {
  const base = BASE_ACTION_CONFIGS[kind] ?? BASE_ACTION_CONFIGS.golpe;
  const role = weaponContext.role;
  const activeWeapon = getActiveWeapon(weaponContext.activeWeapon);

  if (role !== "Cartachin" || !activeWeapon) return base;

  if (activeWeapon.id === "parca-utileria") {
    return {
      ...base,
      damage: Math.round(base.damage + activeWeapon.effectValue * 3),
      stunDamage: Math.max(10, base.stunDamage - activeWeapon.effectValue * 2),
      knockback: base.knockback + 0.05,
      cooldown: Math.max(0.18, base.cooldown - 0.04)
    };
  }

  if (activeWeapon.id === "bocanada-humo") {
    return {
      ...base,
      range: base.range + activeWeapon.effectValue * 0.035,
      knockback: base.knockback + 0.04,
      cooldown: base.cooldown + 0.02
    };
  }

  return base;
}
