import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from "three";
import { TrucolocoScene } from "./game/scene/TrucolocoScene";
import { Hud } from "./game/ui/Hud";
import { useTrucolocoMatch } from "./game/hooks/useTrucolocoMatch";
import { tableSeats } from "./game/data/characters";
import { deck } from "./game/data/cards";
import { sfx } from "./game/audio/sfx";
import { createPortal } from "react-dom";
import { createTrucolocoRoom, findOpenSala, genRoomCode, getPlayerId, openSalaBackfill, ROOM_LIMIT } from "./game/net/room";

// las caras de las cartas se precargan apenas hay un respiro: nunca más
// naipes blancos "cargando" en la mano
if (typeof window !== "undefined") {
  const preloadDeck = () => deck.forEach((card) => card.image && useTexture.preload(card.image));
  if ("requestIdleCallback" in window) window.requestIdleCallback(preloadDeck, { timeout: 4000 });
  else window.setTimeout(preloadDeck, 1500);
}

const cameraViews = [
  { id: "seat", label: "Silla", hint: "1 · sentarte" },
  { id: "walk", label: "Caminar", hint: "2 · WASD" }
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
    return { mode: "low", dpr: [0.75, 1], antialias: false, shadows: false, postprocessing: false };
  }

  const perfOverride = new URLSearchParams(window.location.search).get("perf");
  // low es el default: el modo high (sombras + bloom + AA) es opt-in con ?perf=high
  const lowPower = perfOverride !== "high";

  return lowPower
    ? { mode: "low", dpr: [0.75, 1], antialias: false, shadows: false, postprocessing: false }
    : { mode: "high", dpr: [0.85, 1.25], antialias: true, shadows: true, postprocessing: true };
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
  const ringFrameRef = useRef(null);
  const ringKeysRef = useRef(new Set());
  const debateSoundTokenRef = useRef(debateState.token);
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

  // ─── SALA ONLINE (etapa presencia): crear, entrar por link, ver quién está ──
  const [netRoom, setNetRoom] = useState(null);
  const [roster, setRoster] = useState([]);
  const netRoomRef = useRef(null);

  const joinSala = useCallback((code, isHost) => {
    netRoomRef.current?.leave();
    const profile = {
      playerId: getPlayerId(),
      name: match.selectedCharacter?.name ?? "Pibe",
      role: match.selectedRole,
      characterId: match.selectedCharacter?.id ?? null
    };
    const room = createTrucolocoRoom(code, { isHost, profile });
    room.onRoster(setRoster);
    setRemotePos({});
    room.onPos((peerId, data) =>
      setRemotePos((current) => ({ ...current, [peerId]: { x: data.x, z: data.z, yaw: data.yaw } }))
    );
    if (!isHost) {
      // espejo v1: tu pantalla ES la partida del host
      room.onSnapshot((snapPayload) => matchRef.current.hydrate?.(snapPayload));
    }
    netRoomRef.current = room;
    setNetRoom(room);
    // la URL ES la sala: refresh te devuelve adentro (ver MULTIPLAYER_DESIGN.md)
    window.history.replaceState(null, "", `${window.location.pathname}?sala=${code}`);
  }, [match.selectedCharacter, match.selectedRole]);

  const [micOn, setMicOn] = useState(false);
  const [remotePos, setRemotePos] = useState({});
  const lastPosSentRef = useRef(0);

  const handleMyMove = useCallback((x, z, yaw, moving) => {
    const room = netRoomRef.current;
    if (!room) return;
    const now = performance.now();
    if (now - lastPosSentRef.current < (moving ? 120 : 600)) return;
    lastPosSentRef.current = now;
    room.sendPos({ x, z, yaw });
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
    const room = netRoomRef.current;
    if (!room) return;
    if (room.micOn) {
      room.disableMic();
      setMicOn(false);
    } else {
      const ok = await room.enableMic();
      setMicOn(ok);
    }
  }, []);

  // reclamo de silla: viaja en el perfil; conflicto lo gana el reclamo más viejo
  // (empate: peerId menor). Todos aplican la misma regla → convergen solos.
  const claimSeat = useCallback((seatId) => {
    const room = netRoomRef.current;
    if (!room) return;
    room.updateProfile({ seatId, seatAt: Date.now() });
    const seat = tableSeats.find((item) => item.seatId === seatId);
    if (seat && match.canSwitchRole) match.selectRole(seat.role);
  }, [match]);

  useEffect(() => {
    const me = roster.find((peer) => peer.self);
    if (!me?.seatId) return;
    const rival = roster.find(
      (peer) =>
        !peer.self &&
        peer.seatId === me.seatId &&
        (peer.seatAt < me.seatAt || (peer.seatAt === me.seatAt && peer.peerId < me.peerId))
    );
    if (rival) netRoomRef.current?.updateProfile({ seatId: null, seatAt: null });
  }, [roster]);

  const [searchingRandom, setSearchingRandom] = useState(false);
  const searchRef = useRef(null);
  const [backfillOpen, setBackfillOpen] = useState(false);
  const backfillRef = useRef(null);
  const rosterRef = useRef([]);
  rosterRef.current = roster;

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
    setNetRoom(null);
    setRoster([]);
    setRemotePos({});
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  // el perfil viaja solo cuando cambiás de rol o personaje
  useEffect(() => {
    netRoomRef.current?.updateProfile({
      name: match.selectedCharacter?.name ?? "Pibe",
      role: match.selectedRole,
      characterId: match.selectedCharacter?.id ?? null
    });
  }, [match.selectedRole, match.selectedCharacter]);

  // link de invitación: ?sala=XXXX entra directo, sin prompts.
  // guard por ref: StrictMode corre los efectos dos veces en dev y un doble
  // joinRoom envenena las suscripciones a los relays
  const autoJoinedRef = useRef(false);
  useEffect(() => {
    if (autoJoinedRef.current) return;
    autoJoinedRef.current = true;
    const code = new URLSearchParams(window.location.search).get("sala");
    if (code && code.length === 4) {
      joinSala(code.toUpperCase(), false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const delay = match.phase === "trick-closed" ? 2100 : match.phase === "envido-resolution" ? 2300 : 1000;
    const timer = window.setTimeout(() => {
      if (match.phase === "envido-resolution") match.settleEnvido();
      else if (match.phase === "trick-closed") match.clearTrick();
      else if (match.phase === "pre-rival-lead" || match.phase === "rival-leads") match.revealRivalLead();
      else match.advance();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [autoPlayEnabled, match]);

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

  // repartir = sentarse: dealing a hand drops you into the seated Liar's-Bar view
  const prevPhaseRef = useRef(match.phase);
  useEffect(() => {
    const prevPhase = prevPhaseRef.current;
    prevPhaseRef.current = match.phase;
    if (
      prevPhase === "role-select" &&
      match.phase !== "role-select" &&
      (cameraView === "table" || cameraView === "entry")
    ) {
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
            lastMove: "Ahora aprieta P2. No le robes el momento dramatico."
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
    });
  }, []);

  const triggerRivalDebateAction = useCallback((kind) => {
    setDebateState((current) => {
      if (current.resolved || current.mode === "ruleta") return current;

      return applyCombatAction(current, "rival", kind);
    });
  }, []);

  const switchDebateMode = useCallback((mode) => {
    setDebateState((current) => createDebateState({
      mode,
      token: current.token + 1,
      lastMove: mode === "ruleta"
        ? "Modo ruleta de utileria. Dos tambores, seis posiciones por lado. Si salta el corcho, pierde la disputa."
        : "Modo ring real-time. Movete libre, pegá cuando estés cerca y defendete si P2 te encima."
    }));
  }, []);

  useEffect(() => {
    if (cameraView !== "ring") {
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
  }, [cameraView]);

  useEffect(() => {
    if (cameraView !== "ring") return;
    if (debateSoundTokenRef.current === debateState.token) return;
    debateSoundTokenRef.current = debateState.token;

    const damage = Math.max(debateState.lastDamageToPlayer ?? 0, debateState.lastDamageToRival ?? 0);
    if (damage > 0 || debateState.resolved) {
      playConflictHitSound(debateState.hitStrength ?? damage / 34, debateState.resolved);
    }
  }, [
    cameraView,
    debateState.hitStrength,
    debateState.lastDamageToPlayer,
    debateState.lastDamageToRival,
    debateState.resolved,
    debateState.token
  ]);

  const stageClassName = [
    "stage-shell",
    isSeatingRitual ? "stage-seating-ritual" : "",
    cameraView === "walk" && !isSeatingRitual ? "stage-walk-mode" : "",
    cameraView === "ring" && !isSeatingRitual ? "stage-ring-mode" : "",
    cameraView === "seat" && !isSeatingRitual ? "stage-seat-mode" : "",
    cameraView === "table" && !isSeatingRitual ? "stage-table-mode" : "",
    netRoom && !netRoom.isHost ? "stage-espectador" : ""
  ].filter(Boolean).join(" ");

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (isTyping) return;

      if (event.key === "1") handleCameraViewChange("seat");
      if (event.key === "2") handleCameraViewChange("walk");

      if (cameraView === "ring") {
        const key = event.key.toLowerCase();
        if (event.key === "Escape") {
          handleCameraViewChange("walk");
          return;
        }

        // ── Held keys consumed each frame by stepArenaCombat ──────────────
        //   P1 move : W A S D  (+ Shift sprint)   |  arrows mirror P1 move
        //   P2 move : I J K L
        //   Guard hold: P1 = F (also right-click) | P2 = P
        if (["w", "a", "s", "d", "shift", "i", "j", "k", "l", "p"].includes(key)) {
          event.preventDefault();
          ringKeysRef.current.add(key);
          return;
        }
        if (["arrowleft", "arrowright", "arrowup", "arrowdown"].includes(key)) {
          event.preventDefault();
          ringKeysRef.current.add(key);
          return;
        }

        // ── Discrete actions (fire once per press) ────────────────────────
        //   G          : toggle ring / ruleta mode
        //   P1 attacks : Q golpe · E empujón · R remate · Space esquiva · F guardia
        //   P2 attacks : H golpe · U empujón · O remate (P2 guard is the held P above)
        if (key === "g") {
          event.preventDefault();
          switchDebateMode("ring");
          return;
        }
        if (event.code === "Space") {
          event.preventDefault();
          triggerDebateAction(debateState.mode === "ruleta" ? "gatillo" : "esquive");
          return;
        }
        if (key === "q") {
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
        if (key === "f") {
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
  }, [cameraView, debateState.mode, handleCameraViewChange, switchDebateMode, triggerDebateAction, triggerRivalDebateAction]);

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
              netRoster={roster}
              onWalkerMove={handleMyMove}
              remoteWalkers={roster
                .filter((peer) => !peer.self && remotePos[peer.peerId])
                .map((peer) => ({ ...peer, pos: remotePos[peer.peerId] }))}
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

      {createPortal(
        netRoom ? (
          <div className="sala-panel">
            <div className="sala-head">
              <span className="sala-kicker">SALA</span>
              <strong className="sala-code">{netRoom.code}</strong>
              <span className="sala-count">{roster.length}/{ROOM_LIMIT}</span>
            </div>
            {!netRoom.isHost ? (
              <p className="sala-wait">👁 Espejo en vivo de la mesa del host — jugar tu silla llega en la próxima etapa</p>
            ) : null}
            {roster.length === 1 ? (
              <p className="sala-wait">Sos el único adentro — copiá el link y mandáselo a los pibes<span className="waitdots">…</span></p>
            ) : null}
            <div className="sala-roster">
              {roster.map((peer) => (
                <span key={peer.peerId} className={peer.self ? "sala-chip sala-chip-self" : "sala-chip"}>
                  {peer.isHost ? "★ " : ""}{peer.name}
                  {peer.role ? <small> · {peer.role}</small> : null}
                </span>
              ))}
            </div>

            <div className="sala-seats">
              {tableSeats.map((seat) => {
                const owner = roster.find((peer) => peer.seatId === seat.seatId);
                const mine = owner?.self;
                return (
                  <button
                    key={seat.seatId}
                    className={mine ? "seat-slot seat-slot-mine" : owner ? "seat-slot seat-slot-taken" : "seat-slot"}
                    type="button"
                    title={`${seat.label} · ${seat.role}`}
                    onClick={() => (!owner || mine ? claimSeat(mine ? null : seat.seatId) : null)}
                  >
                    <small>{seat.team === "A" ? "CASA" : "VISITA"}</small>
                    <strong>{seat.role === "Jugador Estrella" ? "Estrella" : seat.role}</strong>
                    <span>{owner ? owner.name : "libre"}</span>
                  </button>
                );
              })}
            </div>
            <div className="sala-actions">
              <button className={micOn ? "canto-chip canto-chip-gold sala-btn" : "canto-chip sala-btn"} type="button" onClick={toggleMic}>
                {micOn ? "🎙 Mic ON" : "🎙 Hablar"}
              </button>
              {netRoom.isHost ? (
                <button className={backfillOpen ? "canto-chip canto-chip-gold sala-btn" : "canto-chip sala-btn"} type="button" onClick={toggleBackfill}>
                  {backfillOpen ? `📢 Abierta (faltan ${Math.max(0, ROOM_LIMIT - roster.length)})` : "🎲 Abrir a randoms"}
                </button>
              ) : null}
              <button
                className="canto-chip canto-chip-advance sala-btn"
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
                ⧉ Copiar link
              </button>
              <button className="canto-chip sala-btn" type="button" onClick={leaveSala}>
                Salir
              </button>
            </div>
            <p className="sala-note">⚠ Los bots de la mesa son PRÁCTICA mientras se llena la sala. La partida compartida entre humanos está en construcción.</p>
            <p className="sala-note">¿No aparece tu amigo? En Brave bajá los Shields (🦁) para este sitio: el enlace P2P usa WebSockets que Brave suele bloquear.</p>
          </div>
        ) : (
          <div className="sala-join-box">
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
          </div>
        ),
        document.body
      )}
    </div>
  );
}
