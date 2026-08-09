import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from "three";
import { TrucolocoScene } from "./game/scene/TrucolocoScene";
import { Hud } from "./game/ui/Hud";
import { useTrucolocoMatch } from "./game/hooks/useTrucolocoMatch";
import { tableSeats, teams } from "./game/data/characters";
import { sfx } from "./game/audio/sfx";
import { createPortal } from "react-dom";
import { createTrucolocoRoom, findOpenSala, genRoomCode, getPlayerId, openSalaBackfill, ROOM_LIMIT } from "./game/net/room";
import { createRelayRoom } from "./game/net/relayRoom";
import {
  getCombatPos as getConflictCombatPos,
  getCombatVector as getConflictCombatVector,
  getDebateGoal as getConflictDebateGoal,
  getDebateTitle as getConflictDebateTitle,
  getRingRead as getConflictRingRead,
  getRivalAttackName as getConflictRivalAttackName
} from "./game/conflict/combatState";
import { useConflictCombat } from "./game/conflict/useConflictCombat";

const playerById = [...teams.A, ...teams.B].reduce((players, player) => {
  players[player.id] = player;
  return players;
}, {});

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
  if (state.resolved) return (state.rivalHealth ?? 100) <= 0 ? "KO: P1 ganó la disputa" : "KO: P2 ganó la disputa";
  if ((state.fightIntro ?? 0) > 0) return "Entrás al ring";
  if ((state.playerHitStun ?? 0) > 0) return "Te tambalearon";
  if ((state.rivalHitStun ?? 0) > 0) return "P2 quedó abierto";
  if ((state.playerDash ?? 0) > 0) return "Esquive";
  if ((state.playerGuard ?? 0) > 0) return "Guardia";
  if (state.kind === "remate") return "Especial conectado";
  if (state.kind === "empujon") return "Fuerte conectado";
  if (state.kind === "golpe") return "Piña conectada";
  if (state.kind?.startsWith("rival")) return "P2 atacó";
  if (!state.rivalControlled) return "Esperando P2";
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
  if (!state.rivalControlled) return "PvP local: P1 ya se mueve. P2 entra con IJKL + H/U/O/P.";
  if (state.playerGuard > 0) return "Estás bloqueando. Soltá F o movete para volver a pegar.";
  if ((state.playerDash ?? 0) > 0) return "Esquive activo: reposicionate y entrá con click o Q.";
  return "Arena local P1 vs P2: los dos se mueven y pegan en tiempo real.";
}

function applyCombatAction(current, actor, kind) {
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
  const attackerPulseKey = isPlayer ? "playerActionPulse" : "rivalActionPulse";
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
      lastMove: isPlayer ? "P1 quedó aturdido. Movete para recuperar postura." : "P2 quedó aturdido."
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
      [attackerPulseKey]: 0,
      [attackerStaminaKey]: clamp((current[attackerStaminaKey] ?? 3) + 0.25, 0, 3),
      lastDamageToPlayer: 0,
      lastDamageToRival: 0,
      hitStrength: 0.08,
      lastMove: isPlayer ? "P1 cubre arriba. Reducís daño frontal, pero si te rodean te la cobran." : "P2 levanta guardia."
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
      [attackerPulseKey]: 0,
      [attackerGuardKey]: 0,
      [attackerStaminaKey]: clamp((current[attackerStaminaKey] ?? 3) - 0.55, 0, 3),
      lastDamageToPlayer: 0,
      lastDamageToRival: 0,
      hitStrength: 0,
      lastMove: isPlayer ? "P1 esquiva corto. Saliste del eje: entrá con click si quedó cerca." : "P2 esquiva y busca otro ángulo."
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
  const damage = rawDamage;
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
    [attackerPulseKey]: canAttack ? (kind === "remate" ? 0.42 : kind === "empujon" ? 0.32 : 0.22) : 0,
    [attackerStaminaKey]: clamp(stamina - (canAttack ? actionConfig.cost : 0), 0, 3),
    [defenderStaminaKey]: clamp((current[defenderStaminaKey] ?? 3) + (guarded ? 0.12 : 0), 0, 3),
    [attackerCooldownKey]: canAttack ? actionConfig.cooldown : Math.max(0.06, cooldown),
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
      ? (isPlayer ? "KO. P1 sacó a P2 del ring: tu versión gana el conflicto." : "KO. P2 sacó a P1 del ring.")
      : defenderWon
        ? (isPlayer ? "KO. P2 contestó y P1 cayó." : "KO. P2 cayó por contra.")
        : !canAttack
          ? !hasAir
            ? (isPlayer ? "P1 sin aire: corré, esquivá o bloqueá para recuperar." : "P2 se quedó sin aire.")
            : (isPlayer ? "Cooldown: el golpe todavía no salió." : "P2 quiso repetir demasiado rápido.")
          : hitLanded
            ? guarded
              ? (isPlayer ? "P1 pegó sobre guardia. Hizo daño menor y cobró un raspón." : "P1 bloqueó parte del golpe de P2.")
              : guardBroken
                ? (isPlayer ? "Especial rompe guardia. Entró fuerte." : "P2 rompió tu guardia con especial.")
                : (isPlayer ? `${actionConfig.label} conectado. ${getRingRead(vector.distance, stamina)}.` : `P2 conectó ${actionConfig.label.toLowerCase()}.`)
            : (isPlayer ? `Golpe al aire. Acercate: ${getRingRead(vector.distance, stamina)}.` : "P2 pegó al aire.")
  };
}

function stepArenaCombat(current, keys, dt) {
  if (current.resolved || current.mode === "ruleta") return current;

  const safeDt = Math.min(0.05, Math.max(0.001, dt));
  let next = {
    ...current,
    playerCooldown: Math.max(0, (current.playerCooldown ?? 0) - safeDt),
    rivalCooldown: Math.max(0, (current.rivalCooldown ?? 0) - safeDt),
    playerActionPulse: Math.max(0, (current.playerActionPulse ?? 0) - safeDt),
    rivalActionPulse: Math.max(0, (current.rivalActionPulse ?? 0) - safeDt),
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
    return { mode: "high", dpr: [0.85, 1.25], antialias: true, shadows: true, postprocessing: true };
  }

  const perfOverride = new URLSearchParams(window.location.search).get("perf");
  // La calidad visual es el piso. El perfil liviano queda como override manual
  // de diagnóstico; desktop y mobile reciben la escena completa por defecto.
  if (perfOverride === "low") {
    return { mode: "low", dpr: [0.7, 0.95], antialias: true, shadows: true, postprocessing: true };
  }
  return { mode: "high", dpr: [0.85, 1.25], antialias: true, shadows: true, postprocessing: true };
}

function SceneReadySignal({ onReady }) {
  useEffect(() => onReady(), [onReady]);
  return null;
}

function playConflictHitSound(hitStrength = 0.5, resolved = false) {
  if (typeof window === "undefined") return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const context = playConflictHitSound.context ?? new AudioContext();
  playConflictHitSound.context = context;
  if (context.state === "suspended") void context.resume();

  const now = context.currentTime;
  const gain = context.createGain();
  const low = context.createOscillator();
  const snap = context.createOscillator();
  const strength = clamp(hitStrength, 0.15, 1);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(resolved ? 0.18 : 0.08 + strength * 0.12, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + (resolved ? 0.22 : 0.12));

  low.type = "sine";
  low.frequency.setValueAtTime(resolved ? 58 : 82 - strength * 18, now);
  low.frequency.exponentialRampToValueAtTime(38, now + (resolved ? 0.22 : 0.12));

  snap.type = "triangle";
  snap.frequency.setValueAtTime(190 + strength * 90, now);
  snap.frequency.exponentialRampToValueAtTime(92, now + 0.06);

  low.connect(gain);
  snap.connect(gain);
  gain.connect(context.destination);

  low.start(now);
  snap.start(now);
  low.stop(now + 0.24);
  snap.stop(now + 0.09);
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
  // tu silla online define tu PERSPECTIVA del match (deriveView de Codex):
  // reclamás B-estrella y el motor te muestra ESA mano, no la del equipo A
  const [myOnlineSeatId, setMyOnlineSeatId] = useState(null);
  // menú "JUGAR primero": el ▶ JUGAR es protagonista; recién al tocarlo se
  // despliegan las opciones online (crear / entrar / unirse con código)
  const [playMenuOpen, setPlayMenuOpen] = useState(false);
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const urlSalaCode = useMemo(() => {
    if (typeof window === "undefined") return "";
    const code = new URLSearchParams(window.location.search).get("sala")?.toUpperCase() ?? "";
    return code.length === 4 ? code : "";
  }, []);
  const match = useTrucolocoMatch({ mySeatId: myOnlineSeatId });
  const performanceProfile = useMemo(() => getInitialPerformanceProfile(), []);
  const [sceneReady, setSceneReady] = useState(false);
  const [cameraView, setCameraView] = useState("table");
  const [isSeatingRitual, setIsSeatingRitual] = useState(false);
  const [walkHotspot, setWalkHotspot] = useState(null);
  const [walkNotice, setWalkNotice] = useState("");
  const [walkAnimationDebug, setWalkAnimationDebug] = useState(null);
  const [walkTouchInput, setWalkTouchInput] = useState(() => createEmptyWalkTouchInput());
  const previousHandStartedRef = useRef(match.handStarted);
  const returnToTableTimerRef = useRef(null);
  const walkNoticeTimerRef = useRef(null);
  const matchRef = useRef(match);

  useEffect(() => {
    matchRef.current = match;
  }, [match]);

  // Precarga únicamente las tres cartas que realmente recibe el jugador.
  // Antes se pedía el mazo completo al abrir la web y competía con los GLB.
  useEffect(() => {
    match.humanHand.forEach((card) => {
      if (!card.image) return;
      const image = new Image();
      image.decoding = "async";
      image.src = card.image;
    });
  }, [match.humanHand]);

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
    };
  }, []);

  const handleCameraViewChange = useCallback((viewId) => {
    if (!identityConfirmed && (viewId === "walk" || viewId === "seat" || viewId === "ring")) {
      setCameraView("table");
      return;
    }
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
  }, [identityConfirmed]);

  const handleRingExit = useCallback(() => {
    handleCameraViewChange("walk");
  }, [handleCameraViewChange]);

  const conflictWeaponContext = useMemo(() => ({
    role: match.selectedRole,
    activeWeapon: match.activeWeapon
  }), [match.activeWeapon, match.selectedRole]);

  const {
    debateState,
    resetDebateState,
    triggerDebateAction,
    switchDebateMode,
    setCombatKey
  } = useConflictCombat({
    enabled: cameraView === "ring",
    onExit: handleRingExit,
    weaponContext: conflictWeaponContext
  });

  // ─── SALA ONLINE (etapa presencia): crear, entrar por link, ver quién está ──
  const [netRoom, setNetRoom] = useState(null);
  const [roster, setRoster] = useState([]);
  const netRoomRef = useRef(null);
  const voiceRoomRef = useRef(null);

  const joinSala = useCallback((code, isHost) => {
    netRoomRef.current?.leave();
    const selectedCharacterId = match.selectedCharacter?.id ?? null;
    const selectedSeat = tableSeats.find((seat) => seat.playerId === selectedCharacterId) ?? null;
    const profile = {
      playerId: getPlayerId(),
      name: match.selectedCharacter?.name ?? "Pibe",
      role: match.selectedRole,
      characterId: selectedCharacterId,
      seatId: selectedSeat?.seatId ?? null,
      seatAt: selectedSeat ? Date.now() : null
    };
    // transporte: RELAY (MQTT/WSS) por defecto — funciona con CGNAT, Brave y
    // sin TURN. ?net=p2p fuerza el WebRTC puro viejo (para pruebas).
    const useP2P = new URLSearchParams(window.location.search).get("net") === "p2p";
    const room = useP2P
      ? createTrucolocoRoom(code, { isHost, profile })
      : createRelayRoom(code, { isHost, profile });
    // VOZ HÍBRIDA: el juego viaja por relay (confiable); la voz necesita
    // WebRTC, así que abrimos un canal P2P paralelo SOLO para audio.
    // Si el P2P no conecta (Brave/CGNAT), el juego sigue perfecto sin voz.
    voiceRoomRef.current?.leave();
    voiceRoomRef.current = useP2P ? null : createTrucolocoRoom(`${code}-voz`, { isHost, profile });
    room.onRoster(setRoster);
    setRemotePos({});
    room.onPos((peerId, data) =>
      setRemotePos((current) => ({ ...current, [peerId]: { x: data.x, z: data.z, yaw: data.yaw, mode: data.mode } }))
    );
    if (!isHost) {
      // espejo v1: tu pantalla ES la partida del host
      room.onSnapshot((snapPayload) => matchRef.current.hydrate?.(snapPayload));
    }
    netRoomRef.current = room;
    setNetRoom(room);
    setMyOnlineSeatId(selectedSeat?.seatId ?? null);
    setIdentityConfirmed(true);
    setSalaCollapsed(false);
    // la URL ES la sala: refresh te devuelve adentro (ver MULTIPLAYER_DESIGN.md)
    window.history.replaceState(null, "", `${window.location.pathname}?sala=${code}`);
    // EL BAR ES LA SALA: crear o unirte te deja CAMINANDO en el antro con tu
    // personaje (espacio social). La partida es una actividad que se lanza
    // adentro. Si ya hay mano en curso, el invariante de cámara manda.
    if (!matchRef.current?.handStarted) setCameraView("walk");
  }, [match.selectedCharacter, match.selectedRole]);

  const [micOn, setMicOn] = useState(false);
  const [salaCollapsed, setSalaCollapsed] = useState(false);
  const [salaPos, setSalaPos] = useState(null); // posición arrastrada del panel
  const [salaNotice, setSalaNotice] = useState("");
  // feedback de conexión: si te quedás solo mucho rato, el relay P2P no
  // enganchó (Brave Shields / red). Antes el panel se quedaba mudo en 1/6.
  const [connTimedOut, setConnTimedOut] = useState(false);
  useEffect(() => {
    if (!netRoom) { setConnTimedOut(false); return undefined; }
    if (roster.length >= 2) { setConnTimedOut(false); return undefined; }
    setConnTimedOut(false);
    const timer = window.setTimeout(() => setConnTimedOut(true), 12000);
    return () => window.clearTimeout(timer);
  }, [netRoom, roster.length]);

  const retrySala = useCallback(() => {
    const room = netRoomRef.current;
    if (!room) return;
    const code = room.code;
    const isHost = room.isHost;
    setConnTimedOut(false);
    joinSala(code, isHost); // recrea la conexión al mismo código
  }, [joinSala]);
  const [remotePos, setRemotePos] = useState({});
  const lastPosSentRef = useRef(0);
  const salaNoticeTimerRef = useRef(null);

  const showSalaNotice = useCallback((message) => {
    setSalaNotice(message);
    if (salaNoticeTimerRef.current) window.clearTimeout(salaNoticeTimerRef.current);
    salaNoticeTimerRef.current = window.setTimeout(() => setSalaNotice(""), 2600);
  }, []);

  useEffect(() => () => {
    if (salaNoticeTimerRef.current) window.clearTimeout(salaNoticeTimerRef.current);
  }, []);

  const handleMyMove = useCallback((x, z, yaw, moving, mode) => {
    const room = netRoomRef.current;
    if (!room) return;
    const now = performance.now();
    // 20Hz en movimiento: a 8Hz los caminantes remotos se veían robóticos
    if (now - lastPosSentRef.current < (moving ? 50 : 400)) return;
    lastPosSentRef.current = now;
    // el MODO viaja tambien: el otro ve tu salto/punch/correr de verdad
    try {
      const pendingSend = room.sendPos({ x, z, yaw, mode: mode ?? (moving ? "walk" : "idle") });
      pendingSend?.catch?.(() => {});
    } catch {
      // Caminar localmente no depende de que el relay P2P tenga pares listos.
    }
  }, []);

  // host: cada cambio de la mesa viaja como snapshot a los guests
  useEffect(() => {
    const room = netRoomRef.current;
    if (!room || !room.isHost || !match.getSnapshot) return;
    const timer = window.setTimeout(() => room.sendSnapshot(match.getSnapshot()), 120);
    return () => window.clearTimeout(timer);
  }, [
    match.pendingAnimationKey,
    match.phase,
    match.scores.A,
    match.scores.B,
    match.handNumber,
    match.activeBet,
    match.handClosed,
    match.trucoPending,
    match.envidoPending,
    match.agreementApplied,
    match.highlight,
    roster.length
  ]);

  // HOST: los guests proponen jugadas (intents) desde su silla. La silla
  // real sale del ROSTER (nunca del mensaje): nadie juega una silla ajena.
  useEffect(() => {
    const room = netRoomRef.current;
    if (!netRoom || !netRoom.isHost || !room?.onIntent) return;
    room.onIntent((peerId, message) => {
      const peer = rosterRef.current.find((item) => item.peerId === peerId);
      if (!peer?.seatId) return;
      matchRef.current.applyRemoteIntent?.({
        seatId: peer.seatId,
        action: message.action,
        payload: message.payload ?? {}
      });
    });
  }, [netRoom]);

  // GUEST sentado: tus botones no tocan tu estado local — mandan la jugada
  // al host y la verdad vuelve como snapshot. Mismo Hud, otra cañería.
  const isSeatedGuest = Boolean(netRoom && !netRoom.isHost && myOnlineSeatId);
  const playMatch = useMemo(() => {
    if (!isSeatedGuest) return match;
    const send = (action, payload = null) => netRoomRef.current?.sendIntent(action, payload);
    const noop = () => {};
    return {
      ...match,
      playCard: (cardId) => send("playCard", { cardId }),
      callEnvido: () => send("callEnvido"),
      raiseEnvido: (callType) => send("raiseEnvido", { callType }),
      acceptEnvido: () => send("acceptEnvido"),
      rejectEnvido: () => send("rejectEnvido"),
      callTruco: () => send("callTruco"),
      acceptTruco: () => send("acceptTruco"),
      rejectTruco: () => send("rejectTruco"),
      raiseTrucoResponse: () => send("raiseTrucoResponse"),
      // el flujo de mesa (avances, reparto, limpieza) es SOLO del host
      startHand: noop,
      startNextHand: noop,
      advance: noop,
      nextHand: noop,
      revealRivalLead: noop,
      clearTrick: noop,
      settleEnvido: noop,
      restartMatch: noop
    };
  }, [isSeatedGuest, match]);

  // PASTILLAS: tomarla te pega a VOS (efecto de pantalla ~22s) y se
  // anuncia a toda la sala por el canal fx. Ver MESA_VIVA_DESIGN.md.
  const [pillTrip, setPillTrip] = useState(null);
  const [pillToast, setPillToast] = useState(null);
  const pillTimerRef = useRef(null);
  const pillToastTimerRef = useRef(null);

  const announcePill = useCallback((texto) => {
    setPillToast(texto);
    window.clearTimeout(pillToastTimerRef.current);
    pillToastTimerRef.current = window.setTimeout(() => setPillToast(null), 4200);
  }, []);

  useEffect(() => {
    const onPill = (event) => {
      const color = event.detail?.color;
      if (!color) return;
      sfx.ensure();
      setPillTrip({ color });
      window.clearTimeout(pillTimerRef.current);
      pillTimerRef.current = window.setTimeout(() => setPillTrip(null), 22000);
      announcePill(`💊 Te tomaste la ${color.toUpperCase()}. Aguantá.`);
      const who = matchRef.current?.selectedCharacter?.name ?? "Alguien";
      netRoomRef.current?.sendFx?.({ pill: color, who });
    };
    window.addEventListener("tl-pill-local", onPill);
    return () => {
      window.removeEventListener("tl-pill-local", onPill);
      window.clearTimeout(pillTimerRef.current);
      window.clearTimeout(pillToastTimerRef.current);
    };
  }, [announcePill]);

  // el vinilo es DE LA SALA: si uno pone Dark Side, suena para todos.
  // BarRoom emite/escucha window events; acá los puenteamos por la red (fx).
  useEffect(() => {
    if (!netRoom) return undefined;
    const onLocalVinyl = (event) =>
      netRoomRef.current?.sendFx?.({ vinyl: Boolean(event.detail?.playing) });
    window.addEventListener("tl-vinyl-local", onLocalVinyl);
    netRoom.onFx?.((d) => {
      if (typeof d?.vinyl === "boolean") {
        window.dispatchEvent(new CustomEvent("tl-vinyl-remote", { detail: { playing: d.vinyl } }));
      }
      if (typeof d?.pill === "string") {
        announcePill(`💊 ${d.who ?? "Alguien"} se tomó la ${d.pill.toUpperCase()}`);
      }
    });
    return () => window.removeEventListener("tl-vinyl-local", onLocalVinyl);
  }, [netRoom, announcePill]);

  // cuando entra alguien a la sala, suena y se siente
  const rosterCountRef = useRef(0);
  useEffect(() => {
    if (roster.length > rosterCountRef.current && rosterCountRef.current > 0) {
      sfx.ensure();
      sfx.canto();
    }
    rosterCountRef.current = roster.length;
  }, [roster.length]);

  const toggleMic = useCallback(async () => {
    const room = voiceRoomRef.current ?? netRoomRef.current;
    if (!room) return;
    if (room.micOn) {
      room.disableMic();
      setMicOn(false);
    } else {
      const ok = await room.enableMic();
      setMicOn(ok);
      if (!ok) showSalaNotice("No pude activar el micrófono (permiso o navegador).");
    }
  }, [showSalaNotice]);

  const getSeatBlockReason = useCallback((seatId) => {
    const seat = tableSeats.find((item) => item.seatId === seatId);
    const owner = roster.find((peer) => peer.seatId === seatId);
    if (owner && !owner.self) return `${owner.name} ya ocupa esa silla.`;
    if (seat?.playerId) {
      const characterOwner = roster.find((peer) => !peer.self && peer.characterId === seat.playerId);
      if (characterOwner) return `${playerById[seat.playerId]?.name ?? "Ese personaje"} ya está en la sala.`;
    }
    return "";
  }, [roster]);

  // reclamo de silla: viaja en el perfil; conflicto lo gana el reclamo más viejo
  // (empate: peerId menor). Todos aplican la misma regla → convergen solos.
  const claimSeat = useCallback((seatId) => {
    const room = netRoomRef.current;
    if (!room) return;
    if (!seatId) {
      room.updateProfile({ seatId: null, seatAt: null });
      setMyOnlineSeatId(null);
      return;
    }
    const blockReason = getSeatBlockReason(seatId);
    if (blockReason) {
      showSalaNotice(blockReason);
      return;
    }
    const seat = tableSeats.find((item) => item.seatId === seatId);
    const seatCharacter = seat?.playerId ? playerById[seat.playerId] : null;
    // el PERFIL DE RED sigue a la silla: si no actualizás characterId acá,
    // tu personaje viejo (ej. Gazpacho) queda "fantasma" bloqueándole esa
    // silla a todos los demás ("no me deja elegir Estrella")
    room.updateProfile({
      seatId,
      seatAt: Date.now(),
      characterId: seatCharacter?.id ?? null,
      name: seatCharacter?.name ?? undefined,
      role: seat?.role ?? undefined
    });
    setMyOnlineSeatId(seatId);
    if (seat && match.canSwitchRole) {
      match.selectRole(seat.role);
      // tu avatar pasa a ser el personaje de esa silla: dos humanos en sillas
      // distintas dejan de verse como el mismo Pochex replicado
      if (seat.playerId) match.selectCharacter(seat.playerId);
    }
  }, [getSeatBlockReason, match, showSalaNotice]);

  const claimSelectedSeat = useCallback(() => {
    const selectedCharacterId = match.selectedCharacter?.id;
    const exactSeat = tableSeats.find((seat) => seat.playerId === selectedCharacterId);
    if (!exactSeat) {
      showSalaNotice("Ese personaje todavía no tiene una silla asignada.");
      return;
    }
    const blockReason = getSeatBlockReason(exactSeat.seatId);
    if (blockReason) {
      showSalaNotice(blockReason);
      return;
    }
    claimSeat(exactSeat.seatId);
  }, [claimSeat, getSeatBlockReason, match.selectedCharacter, showSalaNotice]);

  // resolución de conflicto: si dos reclaman la misma silla, gana el más viejo
  useEffect(() => {
    const me = roster.find((peer) => peer.self);
    if (!me?.seatId) return;
    const rival = roster.find(
      (peer) =>
        !peer.self &&
        peer.seatId === me.seatId &&
        (peer.seatAt < me.seatAt || (peer.seatAt === me.seatAt && peer.peerId < me.peerId))
    );
    if (rival) {
      netRoomRef.current?.updateProfile({ seatId: null, seatAt: null });
      setMyOnlineSeatId(null);
      setIdentityConfirmed(false);
      setCameraView("table");
      showSalaNotice(`${rival.name} confirmó ese personaje primero. Elegí otro para entrar.`);
      // La identidad nunca muta silenciosamente: volvés a la antesala.
    }
  }, [roster, showSalaNotice]);

  const confirmIdentity = useCallback(() => {
    const selectedCharacterId = match.selectedCharacter?.id;
    const selectedSeat = tableSeats.find((seat) => seat.playerId === selectedCharacterId);
    if (!selectedSeat) {
      showSalaNotice("Elegí un personaje antes de entrar.");
      return;
    }
    const blockReason = netRoomRef.current ? getSeatBlockReason(selectedSeat.seatId) : "";
    if (blockReason) {
      showSalaNotice(blockReason);
      return;
    }

    setIdentityConfirmed(true);
    setPlayMenuOpen(true);
    if (netRoomRef.current) {
      claimSeat(selectedSeat.seatId);
      setCameraView("walk");
      return;
    }
    if (urlSalaCode) joinSala(urlSalaCode, false);
  }, [claimSeat, getSeatBlockReason, joinSala, match.selectedCharacter, showSalaNotice, urlSalaCode]);

  const unlockIdentity = useCallback(() => {
    if (netRoomRef.current || matchRef.current?.handStarted) return;
    setIdentityConfirmed(false);
    setPlayMenuOpen(false);
    setCameraView("table");
  }, []);

  const [searchingRandom, setSearchingRandom] = useState(false);
  const searchRef = useRef(null);
  const [backfillOpen, setBackfillOpen] = useState(false);
  const backfillRef = useRef(null);
  const rosterRef = useRef([]);
  rosterRef.current = roster;
  const selfPeer = roster.find((peer) => peer.self) ?? null;
  const mySeat = selfPeer?.seatId ? tableSeats.find((seat) => seat.seatId === selfPeer.seatId) ?? null : null;
  const lockedCharacterIds = useMemo(
    () => new Set(roster.filter((peer) => !peer.self && peer.characterId).map((peer) => peer.characterId)),
    [roster]
  );

  // buscar una sala ABIERTA existente (la otra cara del backfill)
  const buscarSalaAbierta = useCallback(() => {
    if (searchRef.current) return;
    setSearchingRandom(true);
    searchRef.current = findOpenSala((code) => {
      searchRef.current = null;
      setSearchingRandom(false);
      joinSala(code, false);
    });
  }, [joinSala]);

  const cancelarBusqueda = useCallback(() => {
    searchRef.current?.cancel();
    searchRef.current = null;
    setSearchingRandom(false);
  }, []);

  // el host abre su sala a randoms cuando le faltan jugadores
  const toggleBackfill = useCallback(() => {
    if (backfillRef.current) {
      backfillRef.current.close();
      backfillRef.current = null;
      setBackfillOpen(false);
      return;
    }
    const code = netRoomRef.current?.code;
    if (!code) return;
    backfillRef.current = openSalaBackfill(code, () => Math.max(0, ROOM_LIMIT - rosterRef.current.length));
    setBackfillOpen(true);
  }, []);

  const leaveSala = useCallback(() => {
    backfillRef.current?.close();
    backfillRef.current = null;
    setBackfillOpen(false);
    netRoomRef.current?.leave();
    netRoomRef.current = null;
    voiceRoomRef.current?.leave();
    voiceRoomRef.current = null;
    setNetRoom(null);
    setRoster([]);
    setRemotePos({});
    setMyOnlineSeatId(null);
    window.history.replaceState(null, "", window.location.pathname);
    // frenar la partida al salir: antes los bots seguian tirando cartas
    matchRef.current?.returnToRoleSelect?.();
    setCameraView("table");
  }, []);

  // salir de una partida SOLA (o del bar) sin refrescar: vuelve al menú
  const exitToMenu = useCallback(() => {
    if (netRoomRef.current) {
      leaveSala();
    } else {
      matchRef.current?.returnToRoleSelect?.();
      setCameraView("table");
    }
    setIdentityConfirmed(false);
    setPlayMenuOpen(false);
  }, [leaveSala]);

  const startRoomHand = useCallback(() => {
    const room = netRoomRef.current;
    if (!room) {
      match.startHand();
      return;
    }
    if (!mySeat) {
      showSalaNotice("Primero reclamá una silla en la sala.");
      return;
    }
    if (!room.isHost) {
      showSalaNotice("El anfitrión reparte la mano compartida.");
      return;
    }
    match.startHand();
    handleCameraViewChange("seat");
  }, [handleCameraViewChange, match, mySeat, showSalaNotice]);

  const startBotTest = useCallback(() => {
    match.startHand();
    setCameraView("seat");
  }, [match]);

  // el perfil viaja solo cuando cambiás de rol o personaje
  useEffect(() => {
    const room = netRoomRef.current;
    if (!room) return;
    const characterId = match.selectedCharacter?.id ?? null;
    const duplicateCharacter = characterId
      ? rosterRef.current.find((peer) => !peer.self && peer.characterId === characterId)
      : null;
    if (duplicateCharacter) {
      showSalaNotice(`${match.selectedCharacter.name} ya está en esta sala.`);
      return;
    }
    room.updateProfile({
      name: match.selectedCharacter?.name ?? "Pibe",
      role: match.selectedRole,
      characterId
    });
  }, [match.selectedRole, match.selectedCharacter, showSalaNotice]);

  // Un link de invitación abre la antesala. La conexión recién empieza cuando
  // la persona confirma identidad; nadie aparece en el bar con un avatar azaroso.

  // ─── LA MESA JUEGA SOLA ───────────────────────────────────────────────────
  // los turnos de los bots avanzan con cadencia humana: nada de apretar
  // "Dejar jugar a X" seis veces por vuelta. ?auto=0 lo desactiva (validador).
  const autoPlayEnabled = useMemo(
    () => new URLSearchParams(window.location.search).get("auto") !== "0",
    []
  );
  useEffect(() => {
    if (!autoPlayEnabled) return undefined;
    if (netRoom && !netRoom.isHost) return undefined; // espejo: manda el host
    if (!match.handStarted || match.matchWinner) return undefined;
    if (!match.canAdvance || match.canPlayCard) return undefined;
    const autoPhases = ["table-auto-turn", "pre-rival-lead", "rival-leads", "trick-closed", "envido-resolution"];
    if (!autoPhases.includes(match.phase)) return undefined;
    // si la silla en turno la ocupa un HUMANO conectado, el bot no juega por
    // él: el host espera su intent (las fases de limpieza sí avanzan solas)
    if (
      match.phase !== "trick-closed" &&
      match.phase !== "envido-resolution" &&
      match.currentTurnSeatId &&
      roster.some((peer) => !peer.self && peer.seatId === match.currentTurnSeatId)
    ) {
      return undefined;
    }
    // pausa larga al cerrar la vuelta para que se VEA quién ganó (antes se
    // cerraba tan rápido que no llegabas a leer la mano)
    const delay = match.phase === "trick-closed" ? 3400 : match.phase === "envido-resolution" ? 2600 : 1100;
    const timer = window.setTimeout(() => {
      if (match.phase === "envido-resolution") match.settleEnvido();
      else if (match.phase === "trick-closed") match.clearTrick();
      else if (match.phase === "pre-rival-lead" || match.phase === "rival-leads") match.revealRivalLead();
      else match.advance();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [autoPlayEnabled, match, roster]);

  // audio: el contexto se despierta con el primer gesto (política de autoplay)
  useEffect(() => {
    const wake = () => sfx.ensure();
    window.addEventListener("pointerdown", wake, { once: true });
    return () => window.removeEventListener("pointerdown", wake);
  }, []);

  // reparto con sonido
  const dealRef = useRef(match.handNumber);
  useEffect(() => {
    if (match.handStarted && match.handNumber !== dealRef.current) {
      dealRef.current = match.handNumber;
      sfx.deal();
    }
  }, [match.handNumber, match.handStarted]);

  // cada carta que toca el fieltro suena
  const slapKeyRef = useRef(match.pendingAnimationKey);
  useEffect(() => {
    if (match.pendingAnimationKey !== slapKeyRef.current) {
      slapKeyRef.current = match.pendingAnimationKey;
      if (match.handStarted && !match.handClosed) sfx.slap();
    }
  }, [match.pendingAnimationKey, match.handStarted, match.handClosed]);

  // cierre de mano y de partida
  const handClosedRef = useRef(match.handClosed);
  useEffect(() => {
    if (match.handClosed && !handClosedRef.current) {
      if (match.matchWinner) sfx.matchEnd(match.outcomeTone === "win");
      else sfx.handEnd(match.outcomeTone === "win");
    }
    handClosedRef.current = match.handClosed;
  }, [match.handClosed, match.matchWinner, match.outcomeTone]);

  // INVARIANTE (pedido de Edu): con la mano en juego solo existen dos
  // cámaras — silla (primera persona) o caminar. Cualquier otra vista
  // ("table"/"entry": cartas flotando en negro) se corrige sola, incluso
  // al refrescar a mitad de partida o entrar por link de sala.
  useEffect(() => {
    if (match.phase !== "role-select" && cameraView !== "seat" && cameraView !== "walk" && cameraView !== "ring") {
      handleCameraViewChange("seat");
    }
  }, [match.phase, cameraView, handleCameraViewChange]);

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
      exitToMenu();
      return;
    }

    if (hotspot === "bar") {
      window.clearTimeout(walkNoticeTimerRef.current);
      setWalkNotice("Botellas, humo bajo y promesas de truco. Todavía no hay acción.");
      walkNoticeTimerRef.current = window.setTimeout(() => setWalkNotice(""), 2300);
      return;
    }

    if (hotspot === "ring") {
      resetDebateState();
      handleCameraViewChange("ring");
      return;
    }

    if (hotspot !== "table") return;

    window.clearTimeout(returnToTableTimerRef.current);
    window.clearTimeout(walkNoticeTimerRef.current);
    setWalkHotspot(null);
    setWalkNotice("");

    if (currentMatch.phase === "role-select" && currentMatch.canAdvance) {
      if (netRoomRef.current) startRoomHand();
      else currentMatch.startHand();
      return;
    }

    setIsSeatingRitual(true);
    setCameraView("seat");
    returnToTableTimerRef.current = window.setTimeout(() => {
      setCameraView("table");
      setIsSeatingRitual(false);
    }, 950);
  }, [handleCameraViewChange, resetDebateState, startRoomHand]);

  const stageClassName = [
    "stage-shell",
    isSeatingRitual ? "stage-seating-ritual" : "",
    cameraView === "walk" && !isSeatingRitual ? "stage-walk-mode" : "",
    cameraView === "ring" && !isSeatingRitual ? "stage-ring-mode" : "",
    cameraView === "seat" && !isSeatingRitual ? "stage-seat-mode" : "",
    cameraView === "table" && !isSeatingRitual ? "stage-table-mode" : "",
    netRoom && !netRoom.isHost && !myOnlineSeatId ? "stage-espectador" : ""
  ].filter(Boolean).join(" ");

  return (
    <div className="app-shell">
      {match.handStarted && cameraView !== "ring" ? (
        <button className="exit-to-menu" type="button" onClick={exitToMenu} title="Salir de la partida sin refrescar">
          ← Salir al menú
        </button>
      ) : null}
      {pillTrip ? <div className={`pill-trip pill-trip-${pillTrip.color}`} aria-hidden="true" /> : null}
      {pillToast ? <div className="pill-toast">{pillToast}</div> : null}
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
            <Suspense fallback={null}>
              <TrucolocoScene
                netRoster={roster}
                onWalkerMove={handleMyMove}
                remoteWalkers={roster
                  .filter((peer) => !peer.self && remotePos[peer.peerId])
                  .map((peer) => ({ ...peer, pos: remotePos[peer.peerId] }))}
                match={playMatch}
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
              <SceneReadySignal onReady={() => setSceneReady(true)} />
            </Suspense>
            {performanceProfile.postprocessing ? (
              <EffectComposer multisampling={0}>
                {/* [VISUAL] Subtle grade: less bloom, stronger vignette, cleaner nocturnal focus. */}
                <Bloom intensity={0.06} luminanceThreshold={0.92} luminanceSmoothing={0.45} />
                <Vignette offset={0.16} darkness={0.38} eskil={false} />
              </EffectComposer>
            ) : null}
          </Canvas>

          {!sceneReady ? (
            <div className="scene-loading-ui" role="status" aria-live="polite">
              <div className="scene-loading-mark">TL</div>
              <strong>Abriendo el antro</strong>
              <span>Encendiendo luces · preparando la mesa · cargando personajes</span>
            </div>
          ) : null}

          {identityConfirmed && (netRoom || match.handStarted) && cameraView !== "walk" && cameraView !== "ring" ? <div className="camera-dock camera-dock-context" aria-label="Movimiento por el bar">
            <span className="camera-dock-kicker">Movimiento</span>
            <div className="camera-dock-actions">
              <button
                type="button"
                className="camera-dock-button camera-dock-button-active"
                onClick={() => handleCameraViewChange("walk")}
              >
                <span>🍺 Caminar por el bar</span>
                <small>WASD / flechas</small>
              </button>
            </div>
          </div> : null}

          {cameraView === "walk" && !isSeatingRitual ? (
            <>
              <div className={walkHotspot ? "walk-hint walk-hint-action" : "walk-hint"} aria-live="polite">
                <div className="walk-hint-head">
                  <span>{walkHotspot === "bar" ? "Barra" : walkHotspot === "door" ? "Entrada" : "Explorando el bar"}</span>
                  <button
                    className="walk-hint-exit"
                    type="button"
                    onClick={() => handleCameraViewChange(match.handStarted ? "seat" : "table")}
                  >
                    Volver a la mesa
                  </button>
                </div>
                <strong>
                  {walkHotspot === "table"
                    ? "F · Sentarse en mesa"
                    : walkHotspot === "door"
                      ? "F · Salir del bar"
                      : walkHotspot === "bar"
                        ? "F · Mirar barra"
                        : walkHotspot === "ring"
                          ? "F · Entrar a pelear"
                        : "WASD / Flechas · Q/E giran"}
                </strong>
                <span className="walk-hint-character">
                  {match.selectedCharacter?.name ?? match.activeLane.human.name}
                </span>
                <small>
                  {walkNotice ||
                    (walkHotspot === "table"
                      ? match.phase === "role-select"
                        ? "Confirmás rol y se reparten cartas"
                        : "Entrás al duelo desde tu silla"
                      : walkHotspot === "door"
                        ? "Salís de la sala y volvés al menú"
                        : walkHotspot === "bar"
                          ? "Botellas, humo y promesas de truco"
                        : walkHotspot === "ring"
                          ? "Entrás a una sala aparte: golpes y cero jurisprudencia"
                          : "Avanzá por el pasillo · Shift corre")}
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
                <span>Conflicto · {debateState.rivalControlled ? "P2 local" : "CPU"}</span>
                <strong>
                  {debateState.mode === "ruleta"
                    ? `${debateState.player} - ${debateState.rival}`
                    : `${Math.round(debateState.playerHealth ?? 100)} HP · ${Math.round(debateState.rivalHealth ?? 100)} HP`}
                </strong>
              </div>
              <strong>{getConflictDebateTitle(debateState)}</strong>
              <em>{getConflictDebateGoal(debateState)}</em>
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
                      <span>{getConflictRivalAttackName(debateState.rivalAttack)} viene</span>
                    ) : null}
                    {debateState.vulnerable ? <span>rival vulnerable</span> : null}
                    {(debateState.streak ?? 0) > 0 ? <span>racha {debateState.streak}</span> : null}
                    <span>{getConflictRingRead(getConflictCombatVector(getConflictCombatPos(debateState, "player"), getConflictCombatPos(debateState, "rival")).distance, debateState.playerStamina)}</span>
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
                    <button type="button" onClick={() => handleCameraViewChange("walk")}>Salir</button>
                  </>
                ) : (
                  <div className="debate-live-controls">
                    <div className="debate-dpad" aria-label="Movimiento de pelea">
                      {[
                        ["w", "↑", "debate-dpad-up"],
                        ["a", "←", "debate-dpad-left"],
                        ["s", "↓", "debate-dpad-down"],
                        ["d", "→", "debate-dpad-right"]
                      ].map(([key, label, className]) => (
                        <button
                          key={key}
                          type="button"
                          className={className}
                          aria-label={`Mover ${key}`}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.currentTarget.setPointerCapture?.(event.pointerId);
                            setCombatKey(key, true);
                          }}
                          onPointerUp={() => setCombatKey(key, false)}
                          onPointerCancel={() => setCombatKey(key, false)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="debate-strikes" aria-label="Golpes de pelea">
                      <button type="button" onClick={() => triggerDebateAction("golpe")}>Piña <kbd>Q</kbd></button>
                      <button type="button" onClick={() => triggerDebateAction("empujon")}>Fuerte <kbd>E</kbd></button>
                      <button type="button" onClick={() => triggerDebateAction("remate")} disabled={(debateState.playerStamina ?? 0) < 2.1}>Especial <kbd>R</kbd></button>
                      <button type="button" onClick={() => triggerDebateAction("esquive")}>Esquive</button>
                      <button type="button" onClick={() => triggerDebateAction("guardia")}>Guardia</button>
                    </div>
                  </div>
                )}
              </div>
              <small>{debateState.mode === "ruleta" ? "Espacio/click: apretar · G: ring · Esc: volver" : debateState.rivalControlled ? "P1 WASD + Q/E/R/F · P2 IJKL + H/U/O/P · Esc salir" : "WASD mover · click/Q piña · E fuerte · R especial · F guardia · Espacio esquiva"}</small>
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
          <Hud
            match={playMatch}
            cameraView={cameraView}
            onReturnToTable={() => handleCameraViewChange("table")}
            onboarding={{
              identityConfirmed,
              inviteCode: netRoom ? "" : urlSalaCode,
              confirmIdentity,
              unlockIdentity
            }}
            multiplayer={{
              active: Boolean(netRoom),
              connected: Boolean(netRoom),
              isHost: Boolean(netRoom?.isHost),
              roomCode: netRoom?.code ?? urlSalaCode,
              count: roster.length,
              mySeat,
              myCharacterId: selfPeer?.characterId ?? null,
              lockedCharacterIds,
              claimSelectedSeat,
              startRoomHand,
              leaveSala,
              notice: salaNotice
            }}
          />
        </aside>
      </div>

      {createPortal(
        netRoom ? (
          <div
            className={`${salaCollapsed ? "sala-panel sala-panel-collapsed" : "sala-panel"}${match.phase === "role-select" ? "" : " sala-lower"}`}
            style={salaPos ? { left: salaPos.x, top: salaPos.y, right: "auto", bottom: "auto" } : undefined}
          >
            <div
              className="sala-head"
              onPointerDown={(event) => {
                // el header es la MANIJA: arrastrá el panel a donde no moleste
                if (event.target.closest("button")) return;
                const rect = event.currentTarget.parentElement.getBoundingClientRect();
                const dx = event.clientX - rect.left;
                const dy = event.clientY - rect.top;
                const move = (ev) => setSalaPos({
                  x: Math.max(4, Math.min(window.innerWidth - 140, ev.clientX - dx)),
                  y: Math.max(4, Math.min(window.innerHeight - 48, ev.clientY - dy))
                });
                const up = () => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
              }}
            >
              <div className="sala-head-id">
                <span className="sala-kicker">SALA</span>
                <strong className="sala-code">{netRoom.code}</strong>
              </div>
              <span className="sala-count">{roster.length}/{ROOM_LIMIT}</span>
              <button
                className="sala-collapse-btn"
                type="button"
                title={salaCollapsed ? "Mostrar sala" : "Minimizar"}
                onClick={() => setSalaCollapsed((value) => !value)}
              >
                {salaCollapsed ? "▸" : "▾"}
              </button>
            </div>

            {salaCollapsed ? null : (
              <>
                <div className="sala-roster" aria-label="Personas conectadas">
                  {Array.from({ length: ROOM_LIMIT }, (_, index) => {
                    const peer = roster[index];
                    return peer ? (
                      <div className={peer.self ? "sala-player sala-player-self" : "sala-player"} key={peer.peerId}>
                        <span>{peer.self ? "VOS" : `P${index + 1}`}</span>
                        <strong>{peer.name}</strong>
                        <small>{peer.role ?? "Sin rol"}</small>
                      </div>
                    ) : (
                      <div className="sala-player sala-player-empty" key={`empty-${index}`}>
                        <span>P{index + 1}</span>
                        <strong>Esperando…</strong>
                        <small>Entrará por el link</small>
                      </div>
                    );
                  })}
                </div>

                {salaNotice ? <p className="sala-warning">{salaNotice}</p> : null}

                {!match.handStarted ? (
                  <div className="sala-lobby">
                    <p className={roster.length >= ROOM_LIMIT ? "sala-lobby-status sala-lobby-full" : "sala-lobby-status"}>
                      {roster.length >= ROOM_LIMIT
                        ? "¡Mesa completa! A jugar."
                        : roster.length >= 2
                          ? `Sala activa · ${roster.length}/${ROOM_LIMIT} personas`
                          : connTimedOut
                            ? "Seguís solo en la sala. Compartí el link."
                            : netRoom.isHost
                              ? "Sala creada. Invitá a tus amigos."
                              : "Entraste a la sala. Esperando al host."}
                    </p>
                    {roster.length < 2 && connTimedOut ? (
                      <div className="sala-conn-help">
                        <p>Si estás con otra persona y no aparece: revisá que los dos tengan el MISMO código, bajá los Shields de Brave 🦁, o probá en Chrome. El enlace P2P a veces tarda o el relay falla.</p>
                        <button className="sala-btn sala-btn-on" type="button" onClick={retrySala}>
                          🔄 Reintentar conexión
                        </button>
                      </div>
                    ) : null}
                    {netRoom.isHost ? (
                      <>
                        <button
                          className="sala-share sala-start"
                          type="button"
                          disabled={roster.length < ROOM_LIMIT}
                          onClick={startRoomHand}
                        >
                          {roster.length >= ROOM_LIMIT
                            ? "▶ Iniciar partida con amigos"
                            : `Esperando ${ROOM_LIMIT - roster.length} personas`}
                        </button>
                        <details className="sala-test-tools">
                          <summary>Herramientas de prueba</summary>
                          <p>Los bots existen sólo para testear el juego.</p>
                          <button className="sala-btn" type="button" onClick={startRoomHand}>
                            Iniciar ahora y completar con bots
                          </button>
                        </details>
                      </>
                    ) : (
                      <p className="sala-note">El anfitrión inicia cuando estén las seis personas.</p>
                    )}
                  </div>
                ) : null}

                <button
                  className="sala-share"
                  type="button"
                  onClick={async () => {
                    const link = `${window.location.origin}${window.location.pathname}?sala=${netRoom.code}`;
                    try {
                      await navigator.clipboard.writeText(link);
                    } catch {
                      window.prompt("Copiá el link:", link);
                    }
                  }}
                >
                  ⧉ {roster.length === 1 ? "Copiar link e invitar" : "Copiar link"}
                </button>

                <div className="sala-actions">
                  <button className={micOn ? "sala-btn sala-btn-on" : "sala-btn"} type="button" onClick={toggleMic}>
                    {micOn ? "🎙 Micrófono ON" : "🎙 Hablar"}
                  </button>
                  <button className="sala-btn sala-btn-exit" type="button" onClick={leaveSala}>
                    Salir
                  </button>
                </div>

                {netRoom.isHost ? (
                  <label className="sala-toggle">
                    <input type="checkbox" checked={backfillOpen} onChange={toggleBackfill} />
                    <span>Dejar entrar desconocidos para completar</span>
                  </label>
                ) : null}

                <p className="sala-note">
                  Tu personaje ya está fijo. Cada invitado elige el suyo antes de aparecer acá.
                </p>
              </>
            )}
          </div>
        ) : identityConfirmed && !match.handStarted && cameraView !== "walk" ? (
          <div className={`sala-join-box${match.phase === "role-select" ? "" : " sala-lower"}`}>
            {!playMenuOpen ? (
              <>
                <button className="play-cta" type="button" onClick={() => setPlayMenuOpen(true)}>
                  <span className="play-cta-main">▶ JUGAR</span>
                  <span className="play-cta-sub">Con amigos, online</span>
                </button>
                <button className="identity-change-button" type="button" onClick={unlockIdentity}>
                  ← Cambiar personaje
                </button>
              </>
            ) : (
              <>
                <div className="play-menu-head">
                  <span className="play-menu-title">Paso 2 · Cómo jugar</span>
                  <button className="identity-change-button identity-change-button-inline" type="button" onClick={unlockIdentity}>
                    ← Personaje
                  </button>
                </div>
                <button className="canto-chip canto-chip-advance" type="button" onClick={() => joinSala(genRoomCode(), true)}>
                  🌐 Crear sala
                </button>
                {searchingRandom ? (
                  <button className="canto-chip sala-btn" type="button" onClick={cancelarBusqueda}>
                    Buscando sala abierta… (cancelar)
                  </button>
                ) : (
                  <button className="canto-chip sala-btn" type="button" onClick={buscarSalaAbierta}>
                    🚪 Entrar a sala abierta
                  </button>
                )}
                <div className="sala-join-row">
                  <input
                    className="sala-code-input"
                    maxLength={4}
                    placeholder="CÓDIGO"
                    autoComplete="off"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        const code = event.currentTarget.value.trim().toUpperCase();
                        if (code.length === 4) joinSala(code, false);
                      }
                    }}
                  />
                  <button
                    className="canto-chip sala-btn"
                    type="button"
                    onClick={(event) => {
                      const input = event.currentTarget.previousSibling;
                      const code = input?.value?.trim().toUpperCase() ?? "";
                      if (code.length === 4) joinSala(code, false);
                    }}
                  >
                    Unirse
                  </button>
                </div>
                <details className="sala-test-tools sala-test-tools-solo">
                  <summary>Prueba técnica</summary>
                  <button className="canto-chip sala-btn" type="button" onClick={startBotTest}>
                    Jugar solo con bots
                  </button>
                </details>
              </>
            )}
          </div>
        ) : null,
        document.body
      )}
    </div>
  );
}
