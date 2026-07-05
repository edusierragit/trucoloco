import { getCombatActionConfig, RING_BOUNDS, RING_START_STATE } from "./combatConstants";

export function createDebateState(overrides = {}) {
  return {
    ...RING_START_STATE,
    playerChamber: 1 + Math.floor(Math.random() * 6),
    rivalChamber: 1 + Math.floor(Math.random() * 6),
    ...overrides
  };
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampRingPos(pos) {
  return {
    x: clamp(pos?.x ?? 0, -RING_BOUNDS.x, RING_BOUNDS.x),
    z: clamp(pos?.z ?? 0, -RING_BOUNDS.z, RING_BOUNDS.z)
  };
}

export function getCombatPos(state, actor) {
  const fallbackX = actor === "player" ? -0.72 : 0.72;
  const fallbackLane = actor === "player" ? (state.playerLane ?? -0.18) : (state.rivalLane ?? 0.18);
  return clampRingPos(
    actor === "player"
      ? (state.playerPos ?? { x: fallbackX, z: fallbackLane * 0.84 })
      : (state.rivalPos ?? { x: fallbackX, z: fallbackLane * 0.84 })
  );
}

export function getCombatVector(from, to) {
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
  const facing = facingTarget
    ? getFacing(nextPos, facingTarget)
    : actor === "player"
      ? state.playerFacing
      : state.rivalFacing;

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

export function getRingRead(distance, stamina) {
  const range = distance <= 0.5 ? "encimados" : distance <= 0.78 ? "a tiro" : "fuera de rango";
  const air = stamina >= 2.5 ? "aire lleno" : stamina >= 1 ? "aire justo" : "sin aire";
  return `${range} · ${air}`;
}

export function getRivalAttackName(attack) {
  if (attack === "barrida") return "Barrida";
  if (attack === "hombro") return "Hombro";
  return "Carga";
}

export function getDebateTitle(state) {
  if (state.mode === "ruleta") return state.resolved ? "Corcho cantado" : "Ruleta de corchos";
  if (state.resolved) return (state.rivalHealth ?? 100) <= 0 ? "KO: P1 gano la disputa" : "KO: P2 gano la disputa";
  if ((state.fightIntro ?? 0) > 0) return "Entras al ring";
  if ((state.playerHitStun ?? 0) > 0) return "Te tambalearon";
  if ((state.rivalHitStun ?? 0) > 0) return "P2 quedo abierto";
  if ((state.playerDash ?? 0) > 0) return "Esquive";
  if ((state.playerGuard ?? 0) > 0) return "Guardia";
  if (state.kind === "remate") return "Especial conectado";
  if (state.kind === "empujon") return "Fuerte conectado";
  if (state.kind === "golpe") return "Pina conectada";
  if (state.kind?.startsWith("rival")) return "P2 ataco";
  if (!state.rivalControlled) return "Esperando P2";
  return "Arena libre: pega con click";
}

export function getDebateGoal(state) {
  if (state.mode === "ruleta") {
    if (state.resolved) return "Disputa resuelta. Podes resetear, volver al ring o salir al antro.";
    return state.turn === "player"
      ? "Tu turno: apreta el tambor. Si salta el corcho, perdes la discusion."
      : "Turno de la mesa: mira como aprieta y bancate el silencio.";
  }

  if (state.resolved) return "La pelea termino. Revancha con Q o volve al antro con Esc.";
  if ((state.fightIntro ?? 0) > 0) return "P1: WASD + click/Q/E/R/F. P2 local: IJKL + H/U/O/P.";
  if (!state.rivalControlled) return "PvP local: P1 ya se mueve. P2 entra con IJKL + H/U/O/P.";
  if (state.playerGuard > 0) return "Estas bloqueando. Solta F o movete para volver a pegar.";
  if ((state.playerDash ?? 0) > 0) return "Esquive activo: reposicionate y entra con click o Q.";
  return "Arena local P1 vs P2: los dos se mueven y pegan en tiempo real.";
}

export function applyCombatAction(current, actor, kind, weaponContext) {
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
      lastMove: isPlayer ? "P1 quedo aturdido. Movete para recuperar postura." : "P2 quedo aturdido."
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
      lastMove: isPlayer
        ? "P1 cubre arriba. Reducis dano frontal, pero si te rodean te la cobran."
        : "P2 levanta guardia."
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
      lastMove: isPlayer
        ? "P1 esquiva corto. Saliste del eje: entra con click si quedo cerca."
        : "P2 esquiva y busca otro angulo."
    };
  }

  const actionConfig = getCombatActionConfig(kind, weaponContext);
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
  const nextDefenderPos =
    damage > 0
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
    [defenderHitStunKey]:
      damage >= actionConfig.stunDamage ? 0.22 : damage > 0 ? 0.08 : Math.max(0, current[defenderHitStunKey] ?? 0),
    [attackerHitStunKey]: counterDamage > 0 ? 0.08 : Math.max(0, current[attackerHitStunKey] ?? 0),
    lastDamageToPlayer: isPlayer ? counterDamage : damage,
    lastDamageToRival: isPlayer ? damage : counterDamage,
    hitStrength: clamp((damage + counterDamage) / 34, 0, 1),
    player: Math.min(5, Math.floor((100 - (isPlayer ? nextDefenderHealth : nextAttackerHealth)) / 20)),
    rival: Math.min(5, Math.floor((100 - (isPlayer ? nextAttackerHealth : nextDefenderHealth)) / 20)),
    resolved: attackerWon || defenderWon,
    lastMove: attackerWon
      ? isPlayer
        ? "KO. P1 saco a P2 del ring: tu version gana el conflicto."
        : "KO. P2 saco a P1 del ring."
      : defenderWon
        ? isPlayer
          ? "KO. P2 contesto y P1 cayo."
          : "KO. P2 cayo por contra."
        : !canAttack
          ? !hasAir
            ? isPlayer
              ? "P1 sin aire: corre, esquiva o bloquea para recuperar."
              : "P2 se quedo sin aire."
            : isPlayer
              ? "Cooldown: el golpe todavia no salio."
              : "P2 quiso repetir demasiado rapido."
          : hitLanded
            ? guarded
              ? isPlayer
                ? "P1 pego sobre guardia. Hizo dano menor y cobro un raspon."
                : "P1 bloqueo parte del golpe de P2."
              : guardBroken
                ? isPlayer
                  ? "Especial rompe guardia. Entro fuerte."
                  : "P2 rompio tu guardia con especial."
                : isPlayer
                  ? `${actionConfig.label} conectado. ${getRingRead(vector.distance, stamina)}.`
                  : `P2 conecto ${actionConfig.label.toLowerCase()}.`
            : isPlayer
              ? `Golpe al aire. Acercate: ${getRingRead(vector.distance, stamina)}.`
              : "P2 pego al aire."
  };
}

export function stepArenaCombat(current, keys, dt) {
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
    playerGuard:
      keys.has("f") || keys.has("rightclick") ? 0.38 : Math.max(0, (current.playerGuard ?? 0) - safeDt * 1.45),
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
      next = withActorPos(
        next,
        "rival",
        {
          x: currentRivalPos.x + (rivalInputX / rivalInputLength) * 1.26 * safeDt,
          z: currentRivalPos.z + (rivalInputZ / rivalInputLength) * 1.26 * safeDt
        },
        currentPlayerPos
      );
      next.rivalMoving = 0.18;
    } else {
      next.rivalFacing = getFacing(getCombatPos(next, "rival"), getCombatPos(next, "player"));
    }
  } else {
    next.rivalFacing = getFacing(getCombatPos(next, "rival"), getCombatPos(next, "player"));
  }

  return next;
}

export function resolveCorkRoulettePull(current) {
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
