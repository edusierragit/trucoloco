import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from "three";
import { TrucolocoScene } from "./game/scene/TrucolocoScene";
import { Hud } from "./game/ui/Hud";
import { useTrucolocoMatch } from "./game/hooks/useTrucolocoMatch";

const cameraViews = [
  { id: "entry", label: "Puerta", hint: "1 · entrar" },
  { id: "table", label: "Mesa", hint: "2 · mirar" },
  { id: "seat", label: "Silla", hint: "3 · sentarte" },
  { id: "walk", label: "Caminar", hint: "4 · WASD" }
];

const RING_START_STATE = {
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

function createDebateState(overrides = {}) {
  return {
    ...RING_START_STATE,
    playerChamber: 1 + Math.floor(Math.random() * 6),
    rivalChamber: 1 + Math.floor(Math.random() * 6),
    ...overrides
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const RING_BOUNDS = { x: 1.5, z: 1.12 };

function clampRingPos(pos) {
  return {
    x: clamp(pos?.x ?? 0, -RING_BOUNDS.x, RING_BOUNDS.x),
    z: clamp(pos?.z ?? 0, -RING_BOUNDS.z, RING_BOUNDS.z)
  };
}

function getCombatPos(state, actor) {
  const fallbackX = actor === "player" ? -0.72 : 0.72;
  const fallbackLane = actor === "player" ? state.playerLane ?? -0.18 : state.rivalLane ?? 0.18;
  return clampRingPos(actor === "player"
    ? state.playerPos ?? { x: fallbackX, z: fallbackLane * 0.84 }
    : state.rivalPos ?? { x: fallbackX, z: fallbackLane * 0.84 });
}

function getCombatVector(from, to) {
  const dx = (to?.x ?? 0) - (from?.x ?? 0);
  const dz = (to?.z ?? 0) - (from?.z ?? 0);
  const distance = Math.hypot(dx, dz) || 0.0001;
  return { x: dx / distance, z: dz / distance, distance };
}

function getFacing(from, to) {
  return Math.atan2((to?.x ?? 0) - (from?.x ?? 0), (to?.z ?? 0) - (from?.z ?? 0));
}

function laneFromPos(pos) {
  return clamp((pos?.z ?? 0) / 0.84, -0.72, 0.72);
}

function withActorPos(state, actor, pos, facingTarget) {
  const nextPos = clampRingPos(pos);
  const facing = facingTarget ? getFacing(nextPos, facingTarget) : actor === "player" ? state.playerFacing : state.rivalFacing;

  return actor === "player"
    ? {
      ...state,
      playerPos: nextPos,
      playerLane: laneFromPos(nextPos),
      playerFacing: Number.isFinite(facing) ? facing : state.playerFacing
    }
    : {
      ...state,
      rivalPos: nextPos,
      rivalLane: laneFromPos(nextPos),
      rivalFacing: Number.isFinite(facing) ? facing : state.rivalFacing
    };
}

function getRingRead(distance, stamina) {
  const range = distance <= 0.5 ? "encimados" : distance <= 0.78 ? "a tiro" : "fuera de rango";
  const air = stamina >= 2.5 ? "aire lleno" : stamina >= 1 ? "aire justo" : "sin aire";
  return `${range} · ${air}`;
}

function getRivalAttackName(attack) {
  if (attack === "barrida") return "Barrida";
  if (attack === "hombro") return "Hombro";
  return "Carga";
}

function pickRivalAttack(token) {
  return token % 3 === 0 ? "barrida" : "hombro";
}

function getRingTableLine(kind, token) {
  const lines = {
    punish: [
      "La mesa hace silencio de escribano trucho.",
      "Alguien golpea la baranda: eso cuenta como jurisprudencia.",
      "Se escucha un 'uhhh' desde la mesa grande."
    ],
    remate: [
      "Remate con firma y moño. Nadie quiere revisar el reglamento.",
      "Cerraste la discusión como si tuvieras testigos.",
      "La mesa quedó mirando el piso, oficialmente convencida."
    ],
    hit: [
      "Pegó donde duele: en la interpretación.",
      "La discusión se inclinó medio metro para tu lado.",
      "No fue elegante, pero fue vinculante."
    ],
    fail: [
      "Pegaste al aire y el aire no estaba en la discusión.",
      "Te apuraste y la mesa olió sangre.",
      "Mucho gesto, poca sentencia."
    ]
  };
  const bucket = lines[kind] ?? lines.hit;
  return bucket[token % bucket.length];
}

function isInAttackLine(playerLane, targetLane) {
  return Math.abs(playerLane - targetLane) <= 0.18;
}

function getCombatActionConfig(kind) {
  if (kind === "remate") {
    return { label: "Especial", cost: 2.1, cooldown: 1.1, range: 0.92, damage: 34, stunDamage: 26, knockback: 0.36 };
  }

  if (kind === "empujon") {
    return { label: "Fuerte", cost: 1.35, cooldown: 0.62, range: 0.78, damage: 22, stunDamage: 18, knockback: 0.3 };
  }

  return { label: "Piña", cost: 0.55, cooldown: 0.28, range: 0.64, damage: 12, stunDamage: 20, knockback: 0.16 };
}

function getDebateTitle(state) {
  if (state.mode === "ruleta") return state.resolved ? "Corcho cantado" : "Ruleta de corchos";
  if (state.resolved) return (state.rivalHealth ?? 100) <= 0 ? "KO: ganaste la disputa" : "KO: la mesa te sacó";
  if ((state.fightIntro ?? 0) > 0) return "Entrás al ring";
  if ((state.playerHitStun ?? 0) > 0) return "Te tambalearon";
  if ((state.rivalHitStun ?? 0) > 0) return "El rival quedó abierto";
  if ((state.playerDash ?? 0) > 0) return "Esquive";
  if ((state.playerGuard ?? 0) > 0) return "Guardia";
  if (state.kind === "remate") return "Especial conectado";
  if (state.kind === "empujon") return "Fuerte conectado";
  if (state.kind === "golpe") return "Piña conectada";
  if (state.kind?.startsWith("rival")) return "Te atacan";
  if (!state.playerEngaged) return "Probá el cuerpo";
  return "Arena libre: pegá con click";
}

function getDebateGoal(state) {
  if (state.mode === "ruleta") {
    if (state.resolved) return "Disputa resuelta. Podés resetear, volver al ring o salir al antro.";
    return state.turn === "player"
      ? "Tu turno: apretá el tambor. Si salta el corcho, perdés la discusión."
      : "Turno de la mesa: mirá cómo aprieta y bancate el silencio.";
  }

  if (state.resolved) return "La pelea terminó. Revancha con Q o volvé al antro con Esc.";
  if ((state.fightIntro ?? 0) > 0) return "P1: WASD + click/Q/E/R/F. P2 local: IJKL + H/U/O/P.";
  if (!state.playerEngaged) return "El rival espera. Movete con WASD o tirá la primera piña con click. P2 puede entrar con IJKL.";
  if (state.playerGuard > 0) return "Estás bloqueando. Soltá F o movete para volver a pegar.";
  if ((state.playerDash ?? 0) > 0) return "Esquive activo: reposicionate y entrá con click o Q.";
  return state.rivalControlled
    ? "Arena local P1 vs P2: los dos se mueven y pegan en tiempo real."
    : "Arena real-time: movete libre, entrá al rango, pegá y salí antes de que te contesten.";
}

function applyCombatAction(current, actor, kind, options = {}) {
  const isPlayer = actor === "player";
  const playerStarted = isPlayer ? { playerEngaged: true } : {};
  const rivalStarted = !isPlayer ? { rivalControlled: true, playerEngaged: true } : {};
  const attacker = isPlayer ? "player" : "rival";
  const defender = isPlayer ? "rival" : "player";
  const attackerPos = getCombatPos(current, attacker);
  const defenderPos = getCombatPos(current, defender);
  const vector = getCombatVector(attackerPos, defenderPos);
  const nextToken = (current.token ?? 0) + 1;
  const attackerCooldownKey = isPlayer ? "playerCooldown" : "rivalCooldown";
  const defenderCooldownKey = isPlayer ? "rivalCooldown" : "playerCooldown";
  const attackerStaminaKey = isPlayer ? "playerStamina" : "rivalStamina";
  const defenderStaminaKey = isPlayer ? "rivalStamina" : "playerStamina";
  const attackerGuardKey = isPlayer ? "playerGuard" : "rivalGuard";
  const defenderGuardKey = isPlayer ? "rivalGuard" : "playerGuard";
  const attackerHitStunKey = isPlayer ? "playerHitStun" : "rivalHitStun";
  const defenderHitStunKey = isPlayer ? "rivalHitStun" : "playerHitStun";
  const attackerHealthKey = isPlayer ? "playerHealth" : "rivalHealth";
  const defenderHealthKey = isPlayer ? "rivalHealth" : "playerHealth";
  const attackerDashKey = isPlayer ? "playerDash" : "rivalDash";

  if ((current[attackerHitStunKey] ?? 0) > 0 && kind !== "guardia") {
    return {
      ...current,
      ...playerStarted,
      ...rivalStarted,
      kind: isPlayer ? "stun" : "rival-stun",
      token: nextToken,
      lastDamageToPlayer: 0,
      lastDamageToRival: 0,
      hitStrength: 0,
      lastMove: isPlayer ? "Estás aturdido. Movete para recuperar postura." : "El rival quedó aturdido."
    };
  }

  if (kind === "guardia") {
    return {
      ...current,
      ...playerStarted,
      ...rivalStarted,
      kind: isPlayer ? "guardia" : "rival-guard",
      token: nextToken,
      [attackerGuardKey]: 0.55,
      [attackerStaminaKey]: clamp((current[attackerStaminaKey] ?? 3) + 0.25, 0, 3),
      lastDamageToPlayer: 0,
      lastDamageToRival: 0,
      hitStrength: 0.08,
      lastMove: isPlayer ? "Guardia arriba. Reducís daño frontal, pero si te rodean te la cobran." : "El rival levanta guardia."
    };
  }

  if (kind === "esquive") {
    const away = getCombatVector(defenderPos, attackerPos);
    const dashPos = clampRingPos({
      x: attackerPos.x + away.x * 0.54,
      z: attackerPos.z + away.z * 0.54
    });
    const withPos = withActorPos(current, attacker, dashPos, defenderPos);

    return {
      ...withPos,
      ...playerStarted,
      ...rivalStarted,
      kind: isPlayer ? "dash" : "rival-dash",
      token: nextToken,
      [attackerDashKey]: 0.28,
      [attackerGuardKey]: 0,
      [attackerStaminaKey]: clamp((current[attackerStaminaKey] ?? 3) - 0.55, 0, 3),
      lastDamageToPlayer: 0,
      lastDamageToRival: 0,
      hitStrength: 0,
      lastMove: isPlayer ? "Esquive corto. Saliste del eje: entrá con click si quedó cerca." : "El rival esquiva y busca otro ángulo."
    };
  }

  const actionConfig = getCombatActionConfig(kind);
  const cooldown = current[attackerCooldownKey] ?? 0;
  const stamina = current[attackerStaminaKey] ?? 3;
  const hasAir = stamina >= actionConfig.cost;
  const canAttack = cooldown <= 0 && hasAir;
  const hitLanded = canAttack && vector.distance <= actionConfig.range;
  const defenderGuard = current[defenderGuardKey] ?? 0;
  const guarded = hitLanded && defenderGuard > 0.05 && kind !== "remate";
  const guardBroken = hitLanded && defenderGuard > 0.05 && kind === "remate";
  const rawDamage = hitLanded
    ? guarded
      ? Math.max(3, Math.round(actionConfig.damage * 0.34))
      : actionConfig.damage + (guardBroken ? 8 : 0)
    : 0;
  const damage = options.ai ? Math.max(1, Math.round(rawDamage * 0.38)) : rawDamage;
  const counterDamage = guarded ? 4 : 0;
  const nextDefenderHealth = clamp((current[defenderHealthKey] ?? 100) - damage, 0, 100);
  const nextAttackerHealth = clamp((current[attackerHealthKey] ?? 100) - counterDamage, 0, 100);
  const defenderKnockback = damage > 0 ? actionConfig.knockback * (guarded ? 0.45 : 1) : 0;
  const nextDefenderPos = damage > 0
    ? clampRingPos({
      x: defenderPos.x + vector.x * defenderKnockback,
      z: defenderPos.z + vector.z * defenderKnockback
    })
    : defenderPos;
  const nextStateWithDefenderPos = withActorPos(current, defender, nextDefenderPos, attackerPos);
  const attackerWon = nextDefenderHealth <= 0;
  const defenderWon = nextAttackerHealth <= 0;
  const kindPrefix = isPlayer ? "" : "rival-";
  const actionKind = `${kindPrefix}${kind}`;

  return {
    ...nextStateWithDefenderPos,
    ...playerStarted,
    ...rivalStarted,
    kind: actionKind,
    token: nextToken,
    [attackerHealthKey]: nextAttackerHealth,
    [defenderHealthKey]: nextDefenderHealth,
    [attackerStaminaKey]: clamp(stamina - (canAttack ? actionConfig.cost : 0), 0, 3),
    [defenderStaminaKey]: clamp((current[defenderStaminaKey] ?? 3) + (guarded ? 0.12 : 0), 0, 3),
    [attackerCooldownKey]: canAttack ? actionConfig.cooldown * (options.ai ? 2.55 : 1) : Math.max(0.06, cooldown),
    [defenderCooldownKey]: Math.max(0, current[defenderCooldownKey] ?? 0),
    [attackerGuardKey]: 0,
    [defenderGuardKey]: guarded ? Math.max(0, defenderGuard - 0.34) : 0,
    [defenderHitStunKey]: damage >= actionConfig.stunDamage ? 0.22 : damage > 0 ? 0.08 : Math.max(0, current[defenderHitStunKey] ?? 0),
    [attackerHitStunKey]: counterDamage > 0 ? 0.08 : Math.max(0, current[attackerHitStunKey] ?? 0),
    lastDamageToPlayer: isPlayer ? counterDamage : damage,
    lastDamageToRival: isPlayer ? damage : counterDamage,
    hitStrength: clamp((damage + counterDamage) / 34, 0, 1),
    player: Math.min(5, Math.floor((100 - (isPlayer ? nextDefenderHealth : nextAttackerHealth)) / 20)),
    rival: Math.min(5, Math.floor((100 - (isPlayer ? nextAttackerHealth : nextDefenderHealth)) / 20)),
    resolved: attackerWon || defenderWon,
    lastMove: attackerWon
      ? (isPlayer ? "KO. Lo sacaste del ring: tu versión gana el conflicto." : "KO. El rival te sacó del ring.")
      : defenderWon
        ? (isPlayer ? "KO. Te contestaron y caíste." : "KO. El rival cayó por contra.")
        : !canAttack
          ? !hasAir
            ? (isPlayer ? "Sin aire: corré, esquivá o bloqueá para recuperar." : "El rival se quedó sin aire.")
            : (isPlayer ? "Cooldown: el golpe todavía no salió." : "El rival quiso repetir demasiado rápido.")
          : hitLanded
            ? guarded
              ? (isPlayer ? "Pegaste sobre guardia. Hizo daño menor y te devolvió un raspón." : "Bloqueaste parte del golpe rival.")
              : guardBroken
                ? (isPlayer ? "Especial rompe guardia. Entró fuerte." : "El rival rompió tu guardia con especial.")
                : (isPlayer ? `${actionConfig.label} conectado. ${getRingRead(vector.distance, stamina)}.` : `El rival conectó ${actionConfig.label.toLowerCase()}.`)
            : (isPlayer ? `Golpe al aire. Acercate: ${getRingRead(vector.distance, stamina)}.` : "El rival pegó al aire.")
  };
}

function stepArenaCombat(current, keys, dt) {
  if (current.resolved || current.mode === "ruleta") return current;

  const safeDt = Math.min(0.05, Math.max(0.001, dt));
  let next = {
    ...current,
    playerCooldown: Math.max(0, (current.playerCooldown ?? 0) - safeDt),
    rivalCooldown: Math.max(0, (current.rivalCooldown ?? 0) - safeDt),
    playerHitStun: Math.max(0, (current.playerHitStun ?? 0) - safeDt),
    rivalHitStun: Math.max(0, (current.rivalHitStun ?? 0) - safeDt),
    fightIntro: Math.max(0, (current.fightIntro ?? 0) - safeDt),
    playerGuard: keys.has("f") || keys.has("rightclick") ? 0.38 : Math.max(0, (current.playerGuard ?? 0) - safeDt * 1.45),
    rivalGuard: keys.has("p") ? 0.38 : Math.max(0, (current.rivalGuard ?? 0) - safeDt * 1.25),
    playerDash: Math.max(0, (current.playerDash ?? 0) - safeDt),
    rivalDash: Math.max(0, (current.rivalDash ?? 0) - safeDt),
    playerMoving: Math.max(0, (current.playerMoving ?? 0) - safeDt),
    rivalMoving: Math.max(0, (current.rivalMoving ?? 0) - safeDt),
    playerStamina: clamp((current.playerStamina ?? 3) + safeDt * ((current.playerGuard ?? 0) > 0 ? 0.45 : 0.82), 0, 3),
    rivalStamina: clamp((current.rivalStamina ?? 3) + safeDt * 0.72, 0, 3),
    lastDamageToPlayer: Math.max(0, (current.lastDamageToPlayer ?? 0) - safeDt * 32),
    lastDamageToRival: Math.max(0, (current.lastDamageToRival ?? 0) - safeDt * 32)
  };

  const playerPos = getCombatPos(next, "player");
  const rivalPos = getCombatPos(next, "rival");
  const inputX = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
  const inputZ = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
  const inputLength = Math.hypot(inputX, inputZ) || 1;
  const playerCanMove = (next.playerHitStun ?? 0) <= 0;

  if (playerCanMove && (inputX || inputZ)) {
    const sprint = keys.has("shift");
    const speed = sprint && (next.playerStamina ?? 0) > 0.12 ? 1.92 : 1.38;
    const nextPlayerPos = clampRingPos({
      x: playerPos.x + (inputX / inputLength) * speed * safeDt,
      z: playerPos.z + (inputZ / inputLength) * speed * safeDt
    });
    next = withActorPos(next, "player", nextPlayerPos, getCombatPos(next, "rival"));
    next.playerEngaged = true;
    next.playerMoving = 0.18;
    if (sprint) next.playerStamina = clamp((next.playerStamina ?? 3) - safeDt * 0.55, 0, 3);
  } else {
    next.playerFacing = getFacing(getCombatPos(next, "player"), getCombatPos(next, "rival"));
  }

  const currentPlayerPos = getCombatPos(next, "player");
  const currentRivalPos = getCombatPos(next, "rival");
  const toPlayer = getCombatVector(currentRivalPos, currentPlayerPos);
  const rivalCanMove = (next.rivalHitStun ?? 0) <= 0;
  const rivalInputX = (keys.has("l") ? 1 : 0) - (keys.has("j") ? 1 : 0);
  const rivalInputZ = (keys.has("k") ? 1 : 0) - (keys.has("i") ? 1 : 0);
  const rivalManualInput = Boolean(rivalInputX || rivalInputZ || keys.has("p"));

  if ((next.fightIntro ?? 0) > 0) {
    next.rivalFacing = getFacing(getCombatPos(next, "rival"), getCombatPos(next, "player"));
  } else if (rivalManualInput && rivalCanMove) {
    const rivalInputLength = Math.hypot(rivalInputX, rivalInputZ) || 1;
    next = {
      ...next,
      rivalControlled: true,
      playerEngaged: true
    };
    if (rivalInputX || rivalInputZ) {
      next = withActorPos(next, "rival", {
        x: currentRivalPos.x + (rivalInputX / rivalInputLength) * 1.26 * safeDt,
        z: currentRivalPos.z + (rivalInputZ / rivalInputLength) * 1.26 * safeDt
      }, currentPlayerPos);
      next.rivalMoving = 0.18;
    } else {
      next.rivalFacing = getFacing(getCombatPos(next, "rival"), getCombatPos(next, "player"));
    }
  } else if ((next.playerEngaged ?? false) && rivalCanMove && (next.rivalCooldown ?? 0) <= 0.12) {
    if (toPlayer.distance > 0.62) {
      const strafe = Math.sin((next.token ?? 0) * 0.47) * 0.42;
      const moveX = toPlayer.x + -toPlayer.z * strafe;
      const moveZ = toPlayer.z + toPlayer.x * strafe;
      const moveLength = Math.hypot(moveX, moveZ) || 1;
      next = withActorPos(next, "rival", {
        x: currentRivalPos.x + (moveX / moveLength) * 0.72 * safeDt,
        z: currentRivalPos.z + (moveZ / moveLength) * 0.72 * safeDt
      }, currentPlayerPos);
      next.rivalMoving = 0.18;
    } else if (toPlayer.distance <= 0.62 && (next.rivalStamina ?? 0) >= 0.55) {
      const aiKind = (next.token ?? 0) % 5 === 0 ? "empujon" : "golpe";
      next = applyCombatAction(next, "rival", aiKind, { ai: true });
    }
  } else {
    next.rivalFacing = getFacing(getCombatPos(next, "rival"), getCombatPos(next, "player"));
  }

  return next;
}

function createEmptyWalkTouchInput() {
  return { x: 0, z: 0, rotate: 0, sprint: false, boxToken: 0, jumpToken: 0 };
}

function getInitialPerformanceProfile() {
  if (typeof window === "undefined") {
    return { mode: "low", dpr: [0.75, 1], antialias: false, shadows: false, postprocessing: false };
  }

  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const narrowViewport = window.innerWidth < 820;
  const perfOverride = new URLSearchParams(window.location.search).get("perf");
  const lowPower = perfOverride === "high"
    ? false
    : perfOverride === "low" || perfOverride === "mobile" || coarsePointer || narrowViewport;

  return lowPower
    ? { mode: "low", dpr: [0.75, 1], antialias: false, shadows: false, postprocessing: false }
    : { mode: "high", dpr: [0.85, 1.25], antialias: true, shadows: true, postprocessing: true };
}

function resolveCorkRoulettePull(current) {
  if (current.resolved) {
    return createDebateState({
      mode: "ruleta",
      token: current.token + 1,
      lastMove: "Se resetean los tambores de utileria. Seis chances por lado, cero argumentos validos."
    });
  }

  const owner = current.turn ?? "player";
  const playerTrigger = owner === "player" ? current.playerTrigger + 1 : current.playerTrigger;
  const rivalTrigger = owner === "rival" ? current.rivalTrigger + 1 : current.rivalTrigger;
  const pull = current.pull + 1;
  const popped = owner === "player" ? playerTrigger >= current.playerChamber : rivalTrigger >= current.rivalChamber;
  const playerLost = popped && owner === "player";
  const rivalLost = popped && owner === "rival";

  return {
    ...current,
    kind: popped ? "corchazo" : "click",
    token: current.token + 1,
    pull,
    playerTrigger,
    rivalTrigger,
    turn: owner === "player" ? "rival" : "player",
    player: rivalLost ? 5 : current.player,
    rival: playerLost ? 5 : current.rival,
    resolved: popped,
    lastMove: popped
      ? playerLost
        ? "Tu tambor salto primero. La mesa gana esta disputa por cobarde jurisprudencia."
        : "El tambor de la mesa salto primero. Tu version queda oficialmente aprobada."
      : owner === "player"
        ? `Vos apretas. Click seco. Te quedan ${6 - playerTrigger} posiciones.`
        : `La mesa aprieta. Click seco. Le quedan ${6 - rivalTrigger} posiciones.`
  };
}

export default function App() {
  const match = useTrucolocoMatch();
  const performanceProfile = useMemo(() => getInitialPerformanceProfile(), []);
  const [cameraView, setCameraView] = useState("table");
  const [isSeatingRitual, setIsSeatingRitual] = useState(false);
  const [walkHotspot, setWalkHotspot] = useState(null);
  const [walkNotice, setWalkNotice] = useState("");
  const [walkAnimationDebug, setWalkAnimationDebug] = useState(null);
  const [walkTouchInput, setWalkTouchInput] = useState(() => createEmptyWalkTouchInput());
  const [debateState, setDebateState] = useState(() => createDebateState());
  const previousHandStartedRef = useRef(match.handStarted);
  const returnToTableTimerRef = useRef(null);
  const walkNoticeTimerRef = useRef(null);
  const debateAiTimerRef = useRef(null);
  const ringFrameRef = useRef(null);
  const ringKeysRef = useRef(new Set());
  const matchRef = useRef(match);

  useEffect(() => {
    matchRef.current = match;
  }, [match]);

  useEffect(() => {
    const wasHandStarted = previousHandStartedRef.current;

    if (!wasHandStarted && match.handStarted) {
      window.clearTimeout(returnToTableTimerRef.current);
      setIsSeatingRitual(false);
      setCameraView("table");
    }

    if (wasHandStarted && !match.handStarted && match.phase === "role-select") {
      window.clearTimeout(returnToTableTimerRef.current);
      setIsSeatingRitual(false);
      setCameraView("table");
    }

    previousHandStartedRef.current = match.handStarted;
  }, [match.handStarted, match.phase]);

  useEffect(() => {
    return () => {
      window.clearTimeout(returnToTableTimerRef.current);
      window.clearTimeout(walkNoticeTimerRef.current);
      window.clearInterval(debateAiTimerRef.current);
      window.cancelAnimationFrame(ringFrameRef.current);
    };
  }, []);

  const handleCameraViewChange = useCallback((viewId) => {
    window.clearTimeout(returnToTableTimerRef.current);
    window.clearTimeout(walkNoticeTimerRef.current);
    setIsSeatingRitual(false);
    setWalkHotspot(null);
    setWalkNotice("");
    setWalkTouchInput((current) => ({
      ...createEmptyWalkTouchInput(),
      boxToken: current.boxToken,
      jumpToken: current.jumpToken
    }));
    setCameraView(viewId);
  }, []);

  const setWalkTouchAxis = useCallback((axis, value) => {
    setWalkTouchInput((current) => ({
      ...current,
      [axis]: value
    }));
  }, []);

  const resetWalkTouchAxis = useCallback((axis, value) => {
    setWalkTouchInput((current) => ({
      ...current,
      [axis]: current[axis] === value ? 0 : current[axis]
    }));
  }, []);

  const setWalkTouchSprint = useCallback((sprint) => {
    setWalkTouchInput((current) => ({
      ...current,
      sprint
    }));
  }, []);

  const triggerWalkTouchBox = useCallback(() => {
    setWalkTouchInput((current) => ({
      ...current,
      boxToken: current.boxToken + 1
    }));
  }, []);

  const triggerWalkTouchJump = useCallback(() => {
    setWalkTouchInput((current) => ({
      ...current,
      jumpToken: current.jumpToken + 1
    }));
  }, []);

  const handleWalkInteract = useCallback((hotspot) => {
    const currentMatch = matchRef.current;

    if (hotspot === "door") {
      handleCameraViewChange("entry");
      return;
    }

    if (hotspot === "bar") {
      window.clearTimeout(walkNoticeTimerRef.current);
      setWalkNotice("Botellas, humo bajo y promesas de truco. Todavía no hay acción.");
      walkNoticeTimerRef.current = window.setTimeout(() => setWalkNotice(""), 2300);
      return;
    }

    if (hotspot === "ring") {
      setDebateState(() => createDebateState());
      handleCameraViewChange("ring");
      return;
    }

    if (hotspot !== "table") return;

    window.clearTimeout(returnToTableTimerRef.current);
    window.clearTimeout(walkNoticeTimerRef.current);
    setWalkHotspot(null);
    setWalkNotice("");

    if (currentMatch.phase === "role-select" && currentMatch.canAdvance) {
      currentMatch.startHand();
      return;
    }

    setIsSeatingRitual(true);
    setCameraView("seat");
    returnToTableTimerRef.current = window.setTimeout(() => {
      setCameraView("table");
      setIsSeatingRitual(false);
    }, 950);
  }, [handleCameraViewChange]);

  const triggerDebateAction = useCallback((kind) => {
    setDebateState((current) => {
      if (current.mode === "ruleta") {
        if (kind !== "gatillo") {
          return {
            ...current,
            kind: "wait",
            token: current.token + 1,
            lastMove: "En la ruleta no hay empujones. Solo apretar, mirar y bancarse el silencio."
          };
        }

        if (current.turn !== "player" && !current.resolved) {
          return {
            ...current,
            kind: "wait",
            token: current.token + 1,
            lastMove: "Ahora aprieta la mesa. No le robes el momento dramatico."
          };
        }

        return resolveCorkRoulettePull(current);
      }

      if (current.resolved) {
        return createDebateState({
          mode: "ring",
          token: current.token + 1,
          lastMove: "Round nuevo. Dos pasos, una excusa y vuelve el quilombo."
        });
      }

      return applyCombatAction(current, "player", kind);

      const nextToken = current.token + 1;
      const distance = Math.abs(current.playerLane - current.rivalLane);

      if ((current.playerHitStun ?? 0) > 0) {
        return {
          ...current,
          kind: "stun",
          token: nextToken,
          lastDamageToPlayer: 0,
          lastDamageToRival: 0,
          hitStrength: 0,
          playerHitStun: Math.max(0, (current.playerHitStun ?? 0) - 1),
          playerStamina: Math.min(3, current.playerStamina + 0.35),
          lastMove: "Estas aturdido. Primero recupera postura; despues volves a pegar."
        };
      }

      if (kind === "guardia") {
        return {
          ...current,
          kind: "guardia",
          token: nextToken,
          lastDamageToPlayer: 0,
          lastDamageToRival: 0,
          hitStrength: 0.18,
          playerGuard: 1,
          playerStamina: Math.min(3, current.playerStamina + 0.95),
          lastMove: current.rivalIntent === "windup"
            ? current.rivalAttack === "barrida"
              ? "Levantás guardia, pero la mesa viene abajo. Si no salís de la línea, te barre."
              : `Te cubrís justo antes del choque. Si viene hombro, queda pagando. ${getRingRead(distance, Math.min(3, current.playerStamina + 0.95))}.`
            : `Levantás guardia y recuperás aire. ${getRingRead(distance, Math.min(3, current.playerStamina + 0.95))}.`
        };
      }

      const actionConfig = getCombatActionConfig(kind);
      const isRemate = kind === "remate";
      const rivalGuarded = (current.rivalGuard ?? 0) > 0.25 && !isRemate;
      const remateBonus = isRemate && (current.vulnerable ?? false) ? 10 : 0;
      const cost = actionConfig.cost;
      const stillRecovering = (current.playerCooldown ?? 0) > 0;
      const hasAir = current.playerStamina >= cost;
      const nextStamina = !stillRecovering && hasAir ? Math.max(0, current.playerStamina - cost) : current.playerStamina;
      const attemptCooldown = actionConfig.cooldown;
      const hitRange = actionConfig.range;
      const hitLanded = !stillRecovering && hasAir && distance <= hitRange;
      const interruptedWindup = hitLanded && current.rivalIntent === "windup";
      const punishedVulnerable = hitLanded && current.vulnerable;
      const rivalCounter = hitLanded && (current.rivalHitStun ?? 0) <= 0 && (kind === "empujon" ? nextToken % 4 === 0 : nextToken % 3 === 0);
      const whiffPunish = !stillRecovering && !hitLanded && distance <= 0.48 && nextToken % 2 === 0;
      const playerDamage = hitLanded
        ? Math.max(
          rivalGuarded ? 5 : 0,
          actionConfig.damage + remateBonus + (interruptedWindup ? 10 : 0) + (punishedVulnerable && !isRemate ? 14 : 0) - (rivalGuarded ? 18 : 0)
        )
        : 0;
      const rivalDamage = rivalGuarded
        ? (isRemate ? 0 : 6)
        : rivalCounter && !interruptedWindup && !punishedVulnerable
          ? 24
          : whiffPunish
            ? (isRemate ? 26 : 14)
            : 0;
      const nextRivalHealth = clamp((current.rivalHealth ?? 100) - playerDamage, 0, 100);
      const nextPlayerHealth = clamp((current.playerHealth ?? 100) - rivalDamage, 0, 100);
      const hitStrength = clamp((playerDamage + rivalDamage) / 42, 0, 1);
      const nextPlayer = Math.min(5, Math.floor((100 - nextRivalHealth) / 20));
      const nextRival = Math.min(5, Math.floor((100 - nextPlayerHealth) / 20));
      const playerWon = nextRivalHealth <= 0;
      const rivalWon = nextPlayerHealth <= 0;
      const directionToPlayer = Math.sign(current.playerLane - current.rivalLane || 1);
      const rivalStep = hitLanded ? -directionToPlayer * 0.14 : directionToPlayer * 0.18;
      const nextRivalLane = clamp(current.rivalLane + rivalStep, -0.72, 0.72);
      const staminaRead = getRingRead(Math.abs(current.playerLane - nextRivalLane), nextStamina);
      const nextStreak = hitLanded ? Math.min(3, (current.streak ?? 0) + 1) : 0;

      return {
        ...current,
        kind,
        token: nextToken,
        player: nextPlayer,
        rival: nextRival,
        playerHealth: nextPlayerHealth,
        rivalHealth: nextRivalHealth,
        lastDamageToPlayer: rivalDamage,
        lastDamageToRival: playerDamage,
        hitStrength,
        playerLane: current.playerLane,
        rivalLane: nextRivalLane,
        playerStamina: nextStamina,
        rivalStamina: clamp(current.rivalStamina + (whiffPunish ? -1 : 0.35), 0, 3),
        playerCooldown: stillRecovering ? Math.max(0, current.playerCooldown - 1) : attemptCooldown,
        rivalCooldown: Math.max(0, current.rivalCooldown ?? 0),
        playerHitStun: rivalDamage > 0 ? 1 : 0,
        rivalHitStun: playerDamage >= actionConfig.stunDamage ? 1 : 0,
        playerGuard: 0,
        rivalGuard: Math.max(0, (current.rivalGuard ?? 0) - 0.55),
        rivalIntent: "neutral",
        rivalAttack: "none",
        rivalTargetLane: current.rivalTargetLane,
        vulnerable: false,
        streak: nextStreak,
        crowdHeat: 0,
        resolved: playerWon || rivalWon,
        lastMove: playerWon
          ? "KO. La mesa cae y tu versión vuelve al antro con autoridad."
          : rivalWon
            ? "KO. Te sacaron del eje y la mesa canta victoria."
          : punishedVulnerable
            ? `Castigaste la ventana. ${getRingTableLine("punish", nextToken)} ${staminaRead}.`
          : interruptedWindup
            ? `Lo cortaste cuando venía cargando. Punto doble de orgullo. ${staminaRead}.`
          : rivalGuarded
            ? `Te le fuiste encima, pero el rival cerró guardia. Entró poco daño y te raspó de contra. ${staminaRead}.`
          : rivalCounter
          ? "Te contestaron con hombro. El conflicto sigue vivo."
          : stillRecovering
            ? "Estas recuperando el brazo. Medio segundo mas y volves a entrar."
          : !hasAir
            ? `Te quedaste sin aire y tiraste un manotazo triste. ${staminaRead}.`
          : !hitLanded
            ? `${getRingTableLine("fail", nextToken)} ${whiffPunish ? "Te puntearon de vuelta." : "Quedaste pagando."} ${staminaRead}.`
          : kind === "empujon"
            ? `Empujón sucio, efectivo y poco reglamentario. ${staminaRead}.`
            : kind === "remate"
              ? `${getRingTableLine("remate", nextToken)} ${staminaRead}.`
            : `${getRingTableLine("hit", nextToken)} ${staminaRead}.`
      };
    });
  }, []);

  const triggerRivalDebateAction = useCallback((kind) => {
    setDebateState((current) => {
      if (current.resolved || current.mode === "ruleta") return current;

      return applyCombatAction(current, "rival", kind);

      const nextToken = current.token + 1;

      if ((current.rivalHitStun ?? 0) > 0) {
        return {
          ...current,
          kind: "rival-stun",
          token: nextToken,
          lastDamageToPlayer: 0,
          lastDamageToRival: 0,
          hitStrength: 0,
          rivalHitStun: Math.max(0, (current.rivalHitStun ?? 0) - 1),
          rivalStamina: Math.min(3, current.rivalStamina + 0.35),
          lastMove: "Jugador B quedó aturdido. Tiene que recuperar postura antes de contestar."
        };
      }

      if (kind === "guardia") {
        return {
          ...current,
          kind: "rival-guard",
          token: nextToken,
          lastDamageToPlayer: 0,
          lastDamageToRival: 0,
          hitStrength: 0.18,
          rivalGuard: 1,
          rivalStamina: Math.min(3, current.rivalStamina + 0.85),
          lastMove: "Jugador B levanta guardia. Si le tirás golpe básico o empujón, absorbe gran parte del daño."
        };
      }

      const actionConfig = getCombatActionConfig(kind);
      const distance = Math.abs(current.playerLane - current.rivalLane);
      const stillRecovering = (current.rivalCooldown ?? 0) > 0;
      const hasAir = current.rivalStamina >= actionConfig.cost;
      const guarded = (current.playerGuard ?? 0) > 0.25;
      const hitLanded = !stillRecovering && hasAir && distance <= actionConfig.range;
      const guardReduced = hitLanded && guarded && kind !== "remate";
      const guardBroken = hitLanded && guarded && kind === "remate";
      const rivalDamage = hitLanded
        ? guardReduced
          ? Math.max(4, actionConfig.damage - 17)
          : actionConfig.damage + (guardBroken ? 8 : 0)
        : 0;
      const counterDamage = guardReduced ? 7 : 0;
      const nextPlayerHealth = clamp((current.playerHealth ?? 100) - rivalDamage, 0, 100);
      const nextRivalHealth = clamp((current.rivalHealth ?? 100) - counterDamage, 0, 100);
      const hitStrength = clamp((rivalDamage + counterDamage) / 42, 0, 1);
      const playerWon = nextRivalHealth <= 0;
      const rivalWon = nextPlayerHealth <= 0;
      const directionToRival = Math.sign(current.rivalLane - current.playerLane || 1);

      return {
        ...current,
        kind: kind === "remate" ? "rival-remate" : kind === "empujon" ? "rival-empujon" : "rival-golpe",
        token: nextToken,
        player: Math.min(5, Math.floor((100 - nextRivalHealth) / 20)),
        rival: Math.min(5, Math.floor((100 - nextPlayerHealth) / 20)),
        playerHealth: nextPlayerHealth,
        rivalHealth: nextRivalHealth,
        lastDamageToPlayer: rivalDamage,
        lastDamageToRival: counterDamage,
        hitStrength,
        playerLane: hitLanded ? clamp(current.playerLane - directionToRival * 0.1, -0.72, 0.72) : current.playerLane,
        rivalLane: current.rivalLane,
        playerStamina: Math.min(3, current.playerStamina + (counterDamage > 0 ? 0.45 : 0.18)),
        rivalStamina: hasAir && !stillRecovering ? Math.max(0, current.rivalStamina - actionConfig.cost) : current.rivalStamina,
        playerCooldown: Math.max(0, (current.playerCooldown ?? 0) - 1),
        rivalCooldown: stillRecovering ? Math.max(0, current.rivalCooldown - 1) : actionConfig.cooldown,
        playerHitStun: rivalDamage >= actionConfig.stunDamage ? 1 : 0,
        rivalHitStun: counterDamage > 0 ? 1 : 0,
        playerGuard: Math.max(0, (current.playerGuard ?? 0) - 0.6),
        rivalGuard: 0,
        rivalIntent: "neutral",
        rivalAttack: "none",
        vulnerable: false,
        resolved: playerWon || rivalWon,
        lastMove: rivalWon
          ? "KO. Jugador B cerró el conflicto y te dejó mirando la baranda."
          : playerWon
            ? "KO. Bloqueaste y contestaste lo justo: Jugador B cae."
            : stillRecovering
              ? "Jugador B quiso repetir demasiado rápido. Cooldown manda."
              : !hasAir
                ? "Jugador B se quedó sin aire y amagó al vacío."
                : !hitLanded
                  ? `Jugador B tiró ${actionConfig.label.toLowerCase()} fuera de rango. ${getRingRead(distance, current.playerStamina)}.`
                  : guardBroken
                    ? "Jugador B rompió tu guardia con remate. La defensa no aguanta todo."
                    : guardReduced
                      ? "Bloqueaste parte del ataque de Jugador B y devolviste un raspón."
                      : `Jugador B conectó ${actionConfig.label.toLowerCase()}. La pelea ya es local y de a dos.`
      };
    });
  }, []);

  const switchDebateMode = useCallback((mode) => {
    setDebateState((current) => createDebateState({
      mode,
      token: current.token + 1,
      lastMove: mode === "ruleta"
        ? "Modo ruleta de utileria. Dos tambores, seis posiciones por lado. Si salta el corcho, pierde la disputa."
        : "Modo ring real-time. Movete libre, pegá cuando estés cerca y defendete si la mesa te encima."
    }));
  }, []);

  useEffect(() => {
    if (cameraView !== "ring") {
      window.clearInterval(debateAiTimerRef.current);
      window.cancelAnimationFrame(ringFrameRef.current);
      ringKeysRef.current.clear();
      return undefined;
    }

    let lastFrame = performance.now();
    const tick = (now) => {
      const dt = (now - lastFrame) / 1000;
      lastFrame = now;
      setDebateState((current) => stepArenaCombat(current, ringKeysRef.current, dt));
      ringFrameRef.current = window.requestAnimationFrame(tick);
    };

    ringFrameRef.current = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(ringFrameRef.current);

    debateAiTimerRef.current = window.setInterval(() => {
      setDebateState((current) => {
        if (current.resolved) return current;

        if (current.mode === "ruleta") {
          return current.turn === "rival" ? resolveCorkRoulettePull(current) : current;
        }

        const nextToken = current.token + 1;
        const distance = Math.abs(current.playerLane - current.rivalLane);
        const directionToPlayer = Math.sign(current.playerLane - current.rivalLane || 1);

        if (current.vulnerable) {
          return {
            ...current,
            kind: "rival-reset",
            token: nextToken,
            rivalStamina: Math.min(3, current.rivalStamina + 0.55),
            lastDamageToPlayer: 0,
            lastDamageToRival: 0,
            hitStrength: 0,
            playerCooldown: Math.max(0, (current.playerCooldown ?? 0) - 1),
            rivalCooldown: Math.max(0, (current.rivalCooldown ?? 0) - 1),
            playerHitStun: Math.max(0, (current.playerHitStun ?? 0) - 1),
            rivalHitStun: Math.max(0, (current.rivalHitStun ?? 0) - 1),
            playerGuard: Math.max(0, (current.playerGuard ?? 0) - 0.35),
            vulnerable: false,
            streak: Math.max(0, (current.streak ?? 0) - 1),
            crowdHeat: Math.max(0, (current.crowdHeat ?? 0) - 1),
            rivalIntent: "neutral",
            rivalAttack: "none",
            lastMove: "La mesa recompone postura. Perdiste la ventana para castigar gratis."
          };
        }

        if ((current.rivalHitStun ?? 0) > 0) {
          return {
            ...current,
            kind: "rival-stun",
            token: nextToken,
            lastDamageToPlayer: 0,
            lastDamageToRival: 0,
            hitStrength: 0,
            playerCooldown: Math.max(0, (current.playerCooldown ?? 0) - 1),
            rivalCooldown: Math.max(0, (current.rivalCooldown ?? 0) - 1),
            rivalHitStun: Math.max(0, (current.rivalHitStun ?? 0) - 1),
            playerStamina: Math.min(3, current.playerStamina + 0.55),
            rivalIntent: "neutral",
            rivalAttack: "none",
            lastMove: "La mesa quedo aturdida. Esa es la ventana buena para entrar."
          };
        }

        if (current.rivalIntent === "windup") {
          const guarded = (current.playerGuard ?? 0) > 0.25;
          const inLine = isInAttackLine(current.playerLane, current.rivalTargetLane);
          const isBarrida = current.rivalAttack === "barrida";
          const dodged = !inLine;
          const blocked = inLine && guarded && !isBarrida;
          const guardBroken = inLine && guarded && isBarrida;
          const cleanHit = inLine && !guarded;
          const counterDamage = blocked ? 10 : 0;
          const rivalDamage = guardBroken ? 30 : cleanHit ? (isBarrida ? 24 : 18) : 0;
          const nextRivalHealth = clamp((current.rivalHealth ?? 100) - counterDamage, 0, 100);
          const nextPlayerHealth = clamp((current.playerHealth ?? 100) - rivalDamage, 0, 100);
          const hitStrength = clamp((counterDamage + rivalDamage) / 34, 0, 1);
          const nextPlayer = Math.min(5, Math.floor((100 - nextRivalHealth) / 20));
          const nextRival = Math.min(5, Math.floor((100 - nextPlayerHealth) / 20));
          const rivalWon = nextPlayerHealth <= 0;
          const playerWon = nextRivalHealth <= 0;
          const nextPlayerLane = clamp(current.playerLane - directionToPlayer * 0.08, -0.72, 0.72);
          const actionKind = dodged ? "rival-whiff" : guardBroken ? "rival-guardbreak" : "rival";
          const earnedWindow = (dodged || blocked) && !playerWon && !rivalWon;

          return {
            ...current,
            kind: actionKind,
            token: nextToken,
            playerLane: nextPlayerLane,
            player: nextPlayer,
            rival: nextRival,
            playerHealth: nextPlayerHealth,
            rivalHealth: nextRivalHealth,
            lastDamageToPlayer: rivalDamage,
            lastDamageToRival: counterDamage,
            hitStrength,
            playerCooldown: Math.max(0, (current.playerCooldown ?? 0) - 1),
            rivalCooldown: rivalDamage > 0 ? 1 : 0,
            playerHitStun: rivalDamage >= 18 ? 1 : 0,
            rivalHitStun: counterDamage > 0 ? 1 : 0,
            rivalStamina: Math.max(0, current.rivalStamina - 1),
            playerGuard: 0,
            rivalIntent: "neutral",
            rivalAttack: "none",
            vulnerable: earnedWindow,
            streak: earnedWindow ? Math.min(3, (current.streak ?? 0) + 1) : 0,
            crowdHeat: 0,
            resolved: rivalWon || playerWon,
            lastMove: playerWon
          ? "Lo esperaste y se regaló. La mesa queda a nada del KO."
              : rivalWon
                ? "KO. La mesa te sacó del ring; respawn al antro cuando salgas."
              : dodged
                ? `Esquivaste la ${getRivalAttackName(current.rivalAttack).toLowerCase()}. La mesa quedó abierta: castigá con Q/E/R.`
              : guardBroken
                ? "Te cubriste arriba y te barrieron abajo. Te bajaron vida: esquivá las barridas."
              : guarded
                ? "Bloqueaste el hombro y lo dejaste abierto. Castigá con Q/E/R."
                : `Te comiste la ${getRivalAttackName(current.rivalAttack).toLowerCase()}. Movete o contestá. ${getRingRead(Math.abs(nextPlayerLane - current.rivalLane), current.playerStamina)}.`
          };
        }

        if (distance > 0.36) {
          const nextRivalLane = clamp(current.rivalLane + directionToPlayer * 0.14, -0.72, 0.72);

          return {
            ...current,
            kind: "rival-move",
            token: nextToken,
            rivalLane: nextRivalLane,
            lastDamageToPlayer: 0,
            lastDamageToRival: 0,
            hitStrength: 0,
            playerCooldown: Math.max(0, (current.playerCooldown ?? 0) - 1),
            rivalCooldown: Math.max(0, (current.rivalCooldown ?? 0) - 1),
            playerHitStun: Math.max(0, (current.playerHitStun ?? 0) - 1),
            rivalHitStun: Math.max(0, (current.rivalHitStun ?? 0) - 1),
            rivalStamina: Math.min(3, current.rivalStamina + 0.35),
            playerGuard: Math.max(0, (current.playerGuard ?? 0) - 0.35),
            rivalIntent: "neutral",
            rivalAttack: "none",
            vulnerable: false,
            lastMove: `La mesa te busca el cuerpo. ${getRingRead(Math.abs(current.playerLane - nextRivalLane), current.playerStamina)}.`
          };
        }

        if (current.rivalStamina < 1) {
          return {
            ...current,
            kind: "rival-breathe",
            token: nextToken,
            rivalStamina: Math.min(3, current.rivalStamina + 0.8),
            lastDamageToPlayer: 0,
            lastDamageToRival: 0,
            hitStrength: 0,
            playerCooldown: Math.max(0, (current.playerCooldown ?? 0) - 1),
            rivalCooldown: Math.max(0, (current.rivalCooldown ?? 0) - 1),
            playerHitStun: Math.max(0, (current.playerHitStun ?? 0) - 1),
            rivalHitStun: Math.max(0, (current.rivalHitStun ?? 0) - 1),
            playerGuard: Math.max(0, (current.playerGuard ?? 0) - 0.25),
            rivalIntent: "neutral",
            rivalAttack: "none",
            lastMove: "La mesa afloja medio paso y recupera aire. Es tu ventana."
          };
        }

        if (current.rivalIntent !== "windup") {
          const rivalAttack = pickRivalAttack(nextToken + current.rival + current.player);

          return {
            ...current,
            kind: "rival-windup",
            token: nextToken,
            rivalIntent: "windup",
            rivalAttack,
            rivalTargetLane: current.playerLane,
            lastDamageToPlayer: 0,
            lastDamageToRival: 0,
            hitStrength: 0,
            playerCooldown: Math.max(0, (current.playerCooldown ?? 0) - 1),
            rivalCooldown: 1,
            playerHitStun: Math.max(0, (current.playerHitStun ?? 0) - 1),
            rivalHitStun: Math.max(0, (current.rivalHitStun ?? 0) - 1),
            rivalStamina: Math.min(3, current.rivalStamina + 0.25),
            lastMove: rivalAttack === "barrida"
              ? "La mesa amagó arriba y va bajo. Salí de la línea con A/D; la guardia no salva."
              : "La mesa baja el hombro y carga de frente. Cubrite con F o cortala con Q/E."
          };
        }

        return current;
      });
    }, 980);

    return () => window.clearInterval(debateAiTimerRef.current);
  }, [cameraView]);

  const moveDebatePlayer = useCallback((direction) => {
    setDebateState((current) => {
      if (current.resolved || current.mode === "ruleta") return current;
      const playerPos = getCombatPos(current, "player");
      const rivalPos = getCombatPos(current, "rival");
      const nextPlayerPos = clampRingPos({ x: playerPos.x + direction * 0.28, z: playerPos.z });
      const moved = withActorPos(current, "player", nextPlayerPos, rivalPos);

      return {
        ...moved,
        kind: "move",
        token: current.token + 1,
        lastDamageToPlayer: 0,
        lastDamageToRival: 0,
        hitStrength: 0,
        playerCooldown: Math.max(0, (current.playerCooldown ?? 0) - 1),
        rivalCooldown: Math.max(0, (current.rivalCooldown ?? 0) - 1),
        playerHitStun: Math.max(0, (current.playerHitStun ?? 0) - 1),
        rivalHitStun: Math.max(0, (current.rivalHitStun ?? 0) - 1),
        playerStamina: Math.min(3, current.playerStamina + 0.55),
        playerGuard: 0,
        lastMove: direction < 0
          ? "Te corrés a la izquierda y recuperás aire."
          : "Te corrés a la derecha y recuperás aire."
      };
    });
  }, []);

  const moveDebateRival = useCallback((direction) => {
    setDebateState((current) => {
      if (current.resolved || current.mode === "ruleta") return current;
      const playerPos = getCombatPos(current, "player");
      const rivalPos = getCombatPos(current, "rival");
      const nextRivalPos = clampRingPos({ x: rivalPos.x + direction * 0.28, z: rivalPos.z });
      const moved = withActorPos(current, "rival", nextRivalPos, playerPos);

      return {
        ...moved,
        kind: "rival-move",
        token: current.token + 1,
        lastDamageToPlayer: 0,
        lastDamageToRival: 0,
        hitStrength: 0,
        playerCooldown: Math.max(0, (current.playerCooldown ?? 0) - 1),
        rivalCooldown: Math.max(0, (current.rivalCooldown ?? 0) - 1),
        playerHitStun: Math.max(0, (current.playerHitStun ?? 0) - 1),
        rivalHitStun: Math.max(0, (current.rivalHitStun ?? 0) - 1),
        rivalStamina: Math.min(3, current.rivalStamina + 0.55),
        rivalGuard: 0,
        lastMove: direction < 0
          ? "Jugador B se corre a su izquierda y recupera aire."
          : "Jugador B se corre a su derecha y recupera aire."
      };
    });
  }, []);

  const stageClassName = [
    "stage-shell",
    isSeatingRitual ? "stage-seating-ritual" : "",
    cameraView === "walk" && !isSeatingRitual ? "stage-walk-mode" : "",
    cameraView === "ring" && !isSeatingRitual ? "stage-ring-mode" : ""
  ].filter(Boolean).join(" ");

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (isTyping) return;

      if (event.key === "1") handleCameraViewChange("entry");
      if (event.key === "2") handleCameraViewChange("table");
      if (event.key === "3") handleCameraViewChange("seat");
      if (event.key === "4") handleCameraViewChange("walk");

      if (cameraView === "ring") {
        const key = event.key.toLowerCase();
        if (event.key === "Escape") {
          handleCameraViewChange("walk");
          return;
        }
        if (["w", "a", "s", "d", "shift", "i", "j", "k", "l", "p"].includes(key)) {
          event.preventDefault();
          ringKeysRef.current.add(key);
          return;
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown") {
          event.preventDefault();
          ringKeysRef.current.add(event.key.toLowerCase());
          return;
        }
        if (key === "a") {
          event.preventDefault();
          moveDebatePlayer(-1);
          return;
        }
        if (key === "d") {
          event.preventDefault();
          moveDebatePlayer(1);
          return;
        }
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          moveDebateRival(-1);
          return;
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          moveDebateRival(1);
          return;
        }
        if (key === "g") {
          event.preventDefault();
          switchDebateMode("ring");
          return;
        }
        if (key === "t") {
          event.preventDefault();
          switchDebateMode("ruleta");
          return;
        }
        if (event.code === "Space") {
          event.preventDefault();
          triggerDebateAction(debateState.mode === "ruleta" ? "gatillo" : "esquive");
          return;
        }
        if (key === "q" || (debateState.mode === "ruleta" && (event.code === "Space" || key === "j"))) {
          event.preventDefault();
          triggerDebateAction(debateState.mode === "ruleta" ? "gatillo" : "golpe");
          return;
        }
        if (key === "e") {
          event.preventDefault();
          triggerDebateAction("empujon");
          return;
        }
        if (key === "r") {
          event.preventDefault();
          triggerDebateAction("remate");
          return;
        }
        if (event.code === "Space" || key === "f") {
          event.preventDefault();
          ringKeysRef.current.add("f");
          triggerDebateAction("guardia");
          return;
        }
        if (key === "h") {
          event.preventDefault();
          triggerRivalDebateAction("golpe");
          return;
        }
        if (key === "u") {
          event.preventDefault();
          triggerRivalDebateAction("empujon");
          return;
        }
        if (key === "o") {
          event.preventDefault();
          triggerRivalDebateAction("remate");
          return;
        }
        if (key === "p") {
          event.preventDefault();
          ringKeysRef.current.add("p");
          triggerRivalDebateAction("guardia");
          return;
        }
      }
    };

    const handleKeyUp = (event) => {
      const key = event.key.toLowerCase();
      ringKeysRef.current.delete(key);
      ringKeysRef.current.delete(event.key.toLowerCase());
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [cameraView, debateState.mode, handleCameraViewChange, moveDebatePlayer, moveDebateRival, switchDebateMode, triggerDebateAction, triggerRivalDebateAction]);

  useEffect(() => {
    if (cameraView !== "ring") return undefined;

    const handlePointerDown = (event) => {
      if (event.target?.closest?.(".debate-hint")) return;
      if (event.button === 0) {
        triggerDebateAction(debateState.mode === "ruleta" ? "gatillo" : "golpe");
      }
      if (event.button === 2) {
        event.preventDefault();
        ringKeysRef.current.add("rightclick");
        triggerDebateAction("guardia");
      }
    };

    const handlePointerUp = (event) => {
      if (event.button === 2) ringKeysRef.current.delete("rightclick");
    };

    const handleContextMenu = (event) => {
      if (cameraView === "ring") event.preventDefault();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("contextmenu", handleContextMenu);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [cameraView, debateState.mode, triggerDebateAction]);

  return (
    <div className="app-shell">
      <div className={stageClassName}>
        <section className="stage-viewport">
          <Canvas
            camera={{ position: [0, 4.45, 6.15], fov: 34 }}
            shadows={performanceProfile.shadows ? { enabled: true, type: PCFSoftShadowMap } : false}
            dpr={performanceProfile.dpr}
            gl={{
              antialias: performanceProfile.antialias,
              outputColorSpace: SRGBColorSpace,
              powerPreference: "high-performance",
              toneMapping: ACESFilmicToneMapping,
              toneMappingExposure: 1.12
            }}
          >
            <color attach="background" args={["#060403"]} />
            <fog attach="fog" args={["#060403", 7.2, 18.5]} />
            <TrucolocoScene
              match={match}
              cameraView={cameraView}
              debateAction={debateState}
              selectedWalkCharacter={match.selectedCharacter ?? match.activeLane.human}
              performanceMode={performanceProfile.mode}
              walkHotspot={walkHotspot}
              walkTouchInput={walkTouchInput}
              onWalkHotspotChange={setWalkHotspot}
              onWalkInteract={handleWalkInteract}
              onWalkAnimationDebugChange={setWalkAnimationDebug}
            />
            {performanceProfile.postprocessing ? (
              <EffectComposer multisampling={0}>
                {/* [VISUAL] Subtle grade: less bloom, stronger vignette, cleaner nocturnal focus. */}
                <Bloom intensity={0.06} luminanceThreshold={0.92} luminanceSmoothing={0.45} />
                <Vignette offset={0.16} darkness={0.38} eskil={false} />
              </EffectComposer>
            ) : null}
          </Canvas>

          <div className="camera-dock" aria-label="Camara y movimiento por el antro">
            <span className="camera-dock-kicker">Cámara</span>
            <div className="camera-dock-actions">
              {cameraViews.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  className={cameraView === view.id ? "camera-dock-button camera-dock-button-active" : "camera-dock-button"}
                  aria-pressed={cameraView === view.id}
                  onClick={() => handleCameraViewChange(view.id)}
                >
                  <span>{view.label}</span>
                  <small>{view.hint}</small>
                </button>
              ))}
            </div>
          </div>

          {cameraView === "walk" && !isSeatingRitual ? (
            <>
              <div className={walkHotspot ? "walk-hint walk-hint-action" : "walk-hint"} aria-live="polite">
                <span>{walkHotspot === "bar" ? "Barra" : walkHotspot === "door" ? "Puerta" : "Caminar"}</span>
                <strong>
                  {walkHotspot === "table"
                    ? "F · Sentarse en mesa"
                    : walkHotspot === "door"
                      ? "F · Volver a puerta"
                      : walkHotspot === "bar"
                        ? "F · Mirar barra"
                        : walkHotspot === "ring"
                          ? "F · Entrar a pelear"
                        : "WASD / Flechas"}
                </strong>
                <span className="walk-hint-character">
                  {match.selectedCharacter?.name ?? match.activeLane.human.name}
                </span>
                {walkAnimationDebug?.clip ? (
                  <span className={walkAnimationDebug.override ? "walk-hint-clip walk-hint-clip-override" : "walk-hint-clip"}>
                    {walkAnimationDebug.mode} · {walkAnimationDebug.clip}{walkAnimationDebug.override ? " · override" : ""}
                  </span>
                ) : null}
                <small>
                  {walkNotice ||
                    (walkHotspot === "table"
                      ? match.phase === "role-select"
                        ? "Confirmás rol y se reparten cartas"
                        : "Entrás al duelo desde tu silla"
                      : walkHotspot === "door"
                        ? "Salís a la vista de entrada"
                        : walkHotspot === "bar"
                          ? "Lugar reservado para props y acciones"
                        : walkHotspot === "ring"
                          ? "Entrás a una sala aparte: golpes, empujones y cero jurisprudencia"
                          : "Q/E rotan cámara · Shift corre · Espacio salta · J box · [/] calibran clip · 0 resetea")}
                </small>
              </div>

              <div className="walk-touch-controls" aria-label="Controles tactiles para caminar">
                <div className="walk-touch-pad" aria-label="Direccion">
                  <button
                    type="button"
                    className="walk-touch-button walk-touch-up"
                    aria-label="Avanzar"
                    onPointerDown={() => setWalkTouchAxis("z", -1)}
                    onPointerUp={() => resetWalkTouchAxis("z", -1)}
                    onPointerCancel={() => resetWalkTouchAxis("z", -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="walk-touch-button walk-touch-left"
                    aria-label="Ir a la izquierda"
                    onPointerDown={() => setWalkTouchAxis("x", -1)}
                    onPointerUp={() => resetWalkTouchAxis("x", -1)}
                    onPointerCancel={() => resetWalkTouchAxis("x", -1)}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="walk-touch-button walk-touch-right"
                    aria-label="Ir a la derecha"
                    onPointerDown={() => setWalkTouchAxis("x", 1)}
                    onPointerUp={() => resetWalkTouchAxis("x", 1)}
                    onPointerCancel={() => resetWalkTouchAxis("x", 1)}
                  >
                    →
                  </button>
                  <button
                    type="button"
                    className="walk-touch-button walk-touch-down"
                    aria-label="Retroceder"
                    onPointerDown={() => setWalkTouchAxis("z", 1)}
                    onPointerUp={() => resetWalkTouchAxis("z", 1)}
                    onPointerCancel={() => resetWalkTouchAxis("z", 1)}
                  >
                    ↓
                  </button>
                </div>
                <div className="walk-touch-actions" aria-label="Acciones">
                  <button
                    type="button"
                    className="walk-touch-button"
                    aria-label="Girar camara izquierda"
                    onPointerDown={() => setWalkTouchAxis("rotate", -1)}
                    onPointerUp={() => resetWalkTouchAxis("rotate", -1)}
                    onPointerCancel={() => resetWalkTouchAxis("rotate", -1)}
                  >
                    Q
                  </button>
                  <button
                    type="button"
                    className="walk-touch-button walk-touch-action"
                    disabled={!walkHotspot}
                    onClick={() => walkHotspot && handleWalkInteract(walkHotspot)}
                  >
                    F
                  </button>
                  <button
                    type="button"
                    className="walk-touch-button"
                    aria-label="Girar camara derecha"
                    onPointerDown={() => setWalkTouchAxis("rotate", 1)}
                    onPointerUp={() => resetWalkTouchAxis("rotate", 1)}
                    onPointerCancel={() => resetWalkTouchAxis("rotate", 1)}
                  >
                    E
                  </button>
                  <button
                    type="button"
                    className="walk-touch-button"
                    onPointerDown={() => setWalkTouchSprint(true)}
                    onPointerUp={() => setWalkTouchSprint(false)}
                    onPointerCancel={() => setWalkTouchSprint(false)}
                  >
                    RUN
                  </button>
                  <button
                    type="button"
                    className="walk-touch-button"
                    onClick={triggerWalkTouchJump}
                  >
                    JMP
                  </button>
                  <button
                    type="button"
                    className="walk-touch-button"
                    onClick={triggerWalkTouchBox}
                  >
                    BOX
                  </button>
                </div>
              </div>
            </>
          ) : null}

          {cameraView === "ring" && !isSeatingRitual ? (
            <div className={debateState.resolved ? "debate-hint debate-hint-resolved" : "debate-hint"} aria-live="polite">
              <div className="debate-hint-header">
                <span>Conflicto</span>
                <strong>
                  {debateState.mode === "ruleta"
                    ? `${debateState.player} - ${debateState.rival}`
                    : `${Math.round(debateState.playerHealth ?? 100)} HP · ${Math.round(debateState.rivalHealth ?? 100)} HP`}
                </strong>
              </div>
              <strong>{getDebateTitle(debateState)}</strong>
              <em>{getDebateGoal(debateState)}</em>
              <p>{debateState.lastMove}</p>
              <div className="debate-meter-stack" aria-hidden="true">
                <div className="debate-meter-row">
                  <span>Vos</span>
                  <div className="debate-meter debate-meter-player">
                    <i style={{ "--debate-meter": `${debateState.mode === "ruleta" ? Math.max(8, (debateState.playerTrigger / 6) * 100) : Math.max(0, debateState.playerHealth ?? 100)}%` }} />
                  </div>
                </div>
                <div className="debate-meter-row">
                    <span>Rival</span>
                  <div className="debate-meter debate-meter-rival">
                    <i style={{ "--debate-meter": `${debateState.mode === "ruleta" ? Math.max(8, (debateState.rivalTrigger / 6) * 100) : Math.max(0, debateState.rivalHealth ?? 100)}%` }} />
                  </div>
                </div>
              </div>
              <div className="debate-readout">
                {debateState.mode === "ruleta" ? (
                  <>
                    <span>Vos {debateState.playerTrigger}/6</span>
                    <span>Rival {debateState.rivalTrigger}/6</span>
                    <span>{debateState.turn === "player" ? "tu tambor" : "tambor rival"}</span>
                  </>
                ) : (
                  <>
                    <span>Vos {Math.round(debateState.playerHealth ?? 100)} HP</span>
                    <span>Rival {Math.round(debateState.rivalHealth ?? 100)} HP</span>
                    <span>Aire {Math.round(debateState.playerStamina * 10) / 10}/3</span>
                    <span>Aire B {Math.round(debateState.rivalStamina * 10) / 10}/3</span>
                    <span>{debateState.playerGuard > 0 ? "guardia arriba" : "guardia baja"}</span>
                    {debateState.rivalGuard > 0 ? <span>guardia rival</span> : null}
                    {(debateState.playerCooldown ?? 0) > 0 ? <span>recuperando brazo</span> : null}
                    {(debateState.rivalCooldown ?? 0) > 0 ? <span>rival recupera</span> : null}
                    {(debateState.playerHitStun ?? 0) > 0 ? <span>aturdido</span> : null}
                    {(debateState.rivalHitStun ?? 0) > 0 ? <span>rival aturdido</span> : null}
                    {debateState.rivalIntent === "windup" ? (
                      <span>{getRivalAttackName(debateState.rivalAttack)} viene</span>
                    ) : null}
                    {debateState.vulnerable ? <span>rival vulnerable</span> : null}
                    {(debateState.streak ?? 0) > 0 ? <span>racha {debateState.streak}</span> : null}
                    <span>{getRingRead(getCombatVector(getCombatPos(debateState, "player"), getCombatPos(debateState, "rival")).distance, debateState.playerStamina)}</span>
                  </>
                )}
              </div>
              <div className="debate-actions" aria-label="Acciones de conflicto">
                {debateState.mode === "ruleta" ? (
                  <>
                    <button type="button" onClick={() => triggerDebateAction("gatillo")} disabled={!debateState.resolved && debateState.turn !== "player"}>
                      {debateState.resolved ? "Otra botella" : "Apretar"}
                    </button>
                    <button type="button" onClick={() => switchDebateMode("ring")}>Ring</button>
                    <button type="button" onClick={() => handleCameraViewChange("walk")}>Salir</button>
                  </>
                ) : debateState.resolved ? (
                  <>
                    <button type="button" onClick={() => triggerDebateAction("golpe")}>Revancha</button>
                    <button type="button" onClick={() => switchDebateMode("ruleta")}>Ruleta</button>
                    <button type="button" onClick={() => handleCameraViewChange("walk")}>Salir</button>
                  </>
                ) : (
                  null
                )}
              </div>
              <small>{debateState.mode === "ruleta" ? "Espacio/click: apretar · G: ring · Esc: volver" : "P1 WASD + click/Q/E/R/F · P2 IJKL + H/U/O/P · Esc salir"}</small>
            </div>
          ) : null}

          <div className="stage-overlay">
            <span className="stage-overlay-kicker">{match.phase === "role-select" ? "Elegi rol" : "Mano clasica"}</span>
            <strong>{match.activeLane.human.name} vs {match.activeLane.rival.name}</strong>
            <p>
              {match.phase === "role-select"
                ? `Rol ${match.selectedRole} · Cuando arranque, sale primero ${match.whoStartsName}`
                : `Rol ${match.selectedRole} · Mano ${match.handNumber} · Sale primero ${match.whoStartsName}`}
            </p>
            <small>{match.highlight}</small>
            <div className="stage-overlay-meta">
              <span>Paso {match.stepNumber}</span>
              <span>Vuelta {match.displayVueltaNumber}/3</span>
              <span>Vos {match.trickWins.A} · {match.activeLane.rival.name} {match.trickWins.B}</span>
              <span>{match.pointsInverted ? "Puntos invertidos" : "Cobro normal"}</span>
            </div>
          </div>

          {isSeatingRitual ? (
            <div className="seating-ritual" aria-live="polite">
              <span>Te sentás en la mesa</span>
              <strong>{match.activeLane.human.name}</strong>
              <small>{match.selectedRole} · sale {match.whoStartsName}</small>
            </div>
          ) : null}
        </section>

        <aside className="stage-sidebar">
          <Hud match={match} cameraView={cameraView} onReturnToTable={() => handleCameraViewChange("table")} />
        </aside>
      </div>
    </div>
  );
}
