import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
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
  playerLane: -0.18,
  rivalLane: 0.18,
  playerStamina: 3,
  rivalStamina: 3,
  playerGuard: 0,
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
  lastMove: "Entraste al ring. Bajá la vida de la mesa a cero y volvés al antro con la discusión ganada."
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

function getRingRead(distance, stamina) {
  const range = distance <= 0.22 ? "encimados" : distance <= 0.38 ? "a tiro" : "mal perfilados";
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

function getDebateTitle(state) {
  if (state.mode === "ruleta") return state.resolved ? "Corcho cantado" : "Ruleta de corchos";
  if (state.resolved) return (state.rivalHealth ?? 100) <= 0 ? "KO: ganaste la disputa" : "KO: la mesa te sacó";
  if (state.vulnerable) return "La mesa quedó pagando";
  if (state.rivalIntent === "windup") return `${getRivalAttackName(state.rivalAttack)} anunciado`;
  return "Pelea de conflicto";
}

function getDebateGoal(state) {
  if (state.mode === "ruleta") {
    if (state.resolved) return "Disputa resuelta. Podés resetear, volver al ring o salir al antro.";
    return state.turn === "player"
      ? "Tu turno: apretá el tambor. Si salta el corcho, perdés la discusión."
      : "Turno de la mesa: mirá cómo aprieta y bancate el silencio.";
  }

  if (state.resolved) return "La pelea terminó. Revancha con J o volvé al antro con Esc.";
  if (state.vulnerable) return "Ventana corta: pegá o empujá antes de que recompongan postura.";
  if (state.rivalIntent === "windup") {
    return state.rivalAttack === "barrida"
      ? "Barrida baja: salí de la línea con A/D. Cubrirse no alcanza."
      : "Hombro de frente: cubrite con L o cortalo con J/K si estás cerca.";
  }
  return "Bajá la vida rival. Hombro se bloquea; barrida se esquiva. Pegá cuando quede pagando.";
}

function createEmptyWalkTouchInput() {
  return { x: 0, z: 0, rotate: 0, sprint: false, boxToken: 0 };
}

function getInitialPerformanceProfile() {
  if (typeof window === "undefined") {
    return { mode: "high", dpr: [0.9, 1.35], antialias: true, shadows: true, postprocessing: true };
  }

  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
  const narrowViewport = window.innerWidth < 820;
  const highDpr = window.devicePixelRatio >= 2;
  const perfOverride = new URLSearchParams(window.location.search).get("perf");
  const lowPower = perfOverride === "low" || perfOverride === "mobile" || (!perfOverride && (coarsePointer || narrowViewport || highDpr));

  return lowPower
    ? { mode: "low", dpr: [0.65, 1], antialias: false, shadows: false, postprocessing: false }
    : { mode: "high", dpr: [0.9, 1.35], antialias: true, shadows: true, postprocessing: true };
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
  const [cameraView, setCameraView] = useState("entry");
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
      setCameraView("entry");
    }

    previousHandStartedRef.current = match.handStarted;
  }, [match.handStarted, match.phase]);

  useEffect(() => {
    return () => {
      window.clearTimeout(returnToTableTimerRef.current);
      window.clearTimeout(walkNoticeTimerRef.current);
      window.clearInterval(debateAiTimerRef.current);
    };
  }, []);

  const handleCameraViewChange = useCallback((viewId) => {
    window.clearTimeout(returnToTableTimerRef.current);
    window.clearTimeout(walkNoticeTimerRef.current);
    setIsSeatingRitual(false);
    setWalkHotspot(null);
    setWalkNotice("");
    setWalkTouchInput((current) => ({ ...createEmptyWalkTouchInput(), boxToken: current.boxToken }));
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

      const nextToken = current.token + 1;
      const distance = Math.abs(current.playerLane - current.rivalLane);

      if (kind === "guardia") {
        return {
          ...current,
          kind: "guardia",
          token: nextToken,
          playerGuard: 1,
          playerStamina: Math.min(3, current.playerStamina + 0.95),
          lastMove: current.rivalIntent === "windup"
            ? current.rivalAttack === "barrida"
              ? "Levantás guardia, pero la mesa viene abajo. Si no salís de la línea, te barre."
              : `Te cubrís justo antes del choque. Si viene hombro, queda pagando. ${getRingRead(distance, Math.min(3, current.playerStamina + 0.95))}.`
            : `Levantás guardia y recuperás aire. ${getRingRead(distance, Math.min(3, current.playerStamina + 0.95))}.`
        };
      }

      const isRemate = kind === "remate";
      const remateReady = (current.vulnerable ?? false) && (current.crowdHeat ?? 0) >= 2;
      const cost = isRemate ? 2 : kind === "empujon" ? 2 : 1;
      const hasAir = current.playerStamina >= cost;
      const nextStamina = hasAir ? Math.max(0, current.playerStamina - cost) : 0;
      const hitRange = isRemate ? 0.52 : kind === "empujon" ? 0.42 : 0.34;
      const hitLanded = hasAir && distance <= hitRange && (!isRemate || remateReady);
      const interruptedWindup = hitLanded && current.rivalIntent === "windup";
      const punishedVulnerable = hitLanded && current.vulnerable;
      const rivalCounter = hitLanded && (kind === "empujon" ? nextToken % 4 === 0 : nextToken % 3 === 0);
      const whiffPunish = !hitLanded && distance <= 0.48 && nextToken % 2 === 0;
      const playerDamage = hitLanded
        ? (isRemate ? 42 : kind === "empujon" ? 24 : 16) + (interruptedWindup ? 10 : 0) + (punishedVulnerable && !isRemate ? 14 : 0)
        : 0;
      const rivalDamage = rivalCounter && !interruptedWindup && !punishedVulnerable ? 24 : whiffPunish ? (isRemate ? 26 : 14) : 0;
      const nextRivalHealth = clamp((current.rivalHealth ?? 100) - playerDamage, 0, 100);
      const nextPlayerHealth = clamp((current.playerHealth ?? 100) - rivalDamage, 0, 100);
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
        playerLane: current.playerLane,
        rivalLane: nextRivalLane,
        playerStamina: nextStamina,
        rivalStamina: Math.min(3, current.rivalStamina + (whiffPunish ? -1 : 0.35)),
        playerGuard: 0,
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
          : rivalCounter
          ? "Te contestaron con hombro. El conflicto sigue vivo."
          : !hasAir
            ? `Te quedaste sin aire y tiraste un manotazo triste. ${staminaRead}.`
          : !hitLanded
            ? `${getRingTableLine("fail", nextToken)} ${whiffPunish ? "Te puntearon de vuelta." : "Quedaste pagando."} ${staminaRead}.`
          : kind === "empujon"
            ? `Empujón sucio, efectivo y poco reglamentario. ${staminaRead}.`
            : `${getRingTableLine("hit", nextToken)} ${staminaRead}.`
      };
    });
  }, []);

  const switchDebateMode = useCallback((mode) => {
    setDebateState((current) => createDebateState({
      mode,
      token: current.token + 1,
      lastMove: mode === "ruleta"
        ? "Modo ruleta de utileria. Dos tambores, seis posiciones por lado. Si salta el corcho, pierde la disputa."
        : "Modo ring. Alineate, guardá aire y resolvé a empujones."
    }));
  }, []);

  useEffect(() => {
    if (cameraView !== "ring") {
      window.clearInterval(debateAiTimerRef.current);
      return undefined;
    }

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
            playerGuard: Math.max(0, (current.playerGuard ?? 0) - 0.35),
            vulnerable: false,
            streak: Math.max(0, (current.streak ?? 0) - 1),
            crowdHeat: Math.max(0, (current.crowdHeat ?? 0) - 1),
            rivalIntent: "neutral",
            rivalAttack: "none",
            lastMove: "La mesa recompone postura. Perdiste la ventana para castigar gratis."
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
                ? `Esquivaste la ${getRivalAttackName(current.rivalAttack).toLowerCase()}. La mesa quedó abierta: castigá con J/K.`
              : guardBroken
                ? "Te cubriste arriba y te barrieron abajo. Te bajaron vida: esquivá las barridas."
              : guarded
                ? "Bloqueaste el hombro y lo dejaste abierto. Castigá con J/K."
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
            rivalStamina: Math.min(3, current.rivalStamina + 0.25),
            lastMove: rivalAttack === "barrida"
              ? "La mesa amagó arriba y va bajo. Salí de la línea con A/D; la guardia no salva."
              : "La mesa baja el hombro y carga de frente. Cubrite con L o cortala con J/K."
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
      const nextLane = clamp(current.playerLane + direction * 0.18, -0.72, 0.72);
      const escapedLine = current.rivalIntent === "windup" && !isInAttackLine(nextLane, current.rivalTargetLane);

      return {
        ...current,
        kind: "move",
        token: current.token + 1,
        playerLane: nextLane,
        playerStamina: Math.min(3, current.playerStamina + 0.55),
        playerGuard: 0,
        lastMove: escapedLine
          ? `Saliste de la línea de ${getRivalAttackName(current.rivalAttack).toLowerCase()}. Si la mesa falla, castigá con J/K.`
          : direction < 0
            ? "Te corrés a la izquierda y recuperás aire."
            : "Te corrés a la derecha y recuperás aire."
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
        if (key === "a" || event.key === "ArrowLeft") {
          event.preventDefault();
          moveDebatePlayer(-1);
          return;
        }
        if (key === "d" || event.key === "ArrowRight") {
          event.preventDefault();
          moveDebatePlayer(1);
          return;
        }
        if (key === "g") {
          event.preventDefault();
          switchDebateMode("ring");
          return;
        }
        if (key === "r") {
          event.preventDefault();
          switchDebateMode("ruleta");
          return;
        }
        if (event.code === "Space" || key === "j") {
          event.preventDefault();
          triggerDebateAction(debateState.mode === "ruleta" ? "gatillo" : "golpe");
          return;
        }
        if (key === "k") {
          event.preventDefault();
          triggerDebateAction("empujon");
          return;
        }
        if (key === "l") {
          event.preventDefault();
          triggerDebateAction("guardia");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cameraView, debateState.mode, handleCameraViewChange, moveDebatePlayer, switchDebateMode, triggerDebateAction]);

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
                <Bloom intensity={0.075} luminanceThreshold={0.9} luminanceSmoothing={0.5} mipmapBlur />
                <Vignette offset={0.16} darkness={0.38} eskil={false} />
                <Noise opacity={0.008} blendFunction={BlendFunction.SOFT_LIGHT} />
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
                          : "Q/E rotan cámara · Shift corre · J/Espacio box · [/] calibran clip · 0 resetea · 2 vuelve a mesa")}
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
                  <span>Mesa</span>
                  <div className="debate-meter debate-meter-rival">
                    <i style={{ "--debate-meter": `${debateState.mode === "ruleta" ? Math.max(8, (debateState.rivalTrigger / 6) * 100) : Math.max(0, debateState.rivalHealth ?? 100)}%` }} />
                  </div>
                </div>
              </div>
              <div className="debate-readout">
                {debateState.mode === "ruleta" ? (
                  <>
                    <span>Vos {debateState.playerTrigger}/6</span>
                    <span>Mesa {debateState.rivalTrigger}/6</span>
                    <span>{debateState.turn === "player" ? "tu tambor" : "tambor de la mesa"}</span>
                  </>
                ) : (
                  <>
                    <span>Aire {Math.round(debateState.playerStamina * 10) / 10}/3</span>
                    <span>{debateState.playerGuard > 0 ? "guardia arriba" : "guardia baja"}</span>
                    {debateState.rivalIntent === "windup" ? (
                      <span>{getRivalAttackName(debateState.rivalAttack)} viene</span>
                    ) : null}
                    {debateState.vulnerable ? <span>mesa vulnerable</span> : null}
                    {(debateState.streak ?? 0) > 0 ? <span>racha {debateState.streak}</span> : null}
                    <span>{getRingRead(Math.abs(debateState.playerLane - debateState.rivalLane), debateState.playerStamina)}</span>
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
                  <>
                    <button type="button" onClick={() => triggerDebateAction("golpe")}>Piña</button>
                    <button type="button" onClick={() => moveDebatePlayer(-1)}>← Esquive</button>
                    <button type="button" onClick={() => moveDebatePlayer(1)}>Esquive →</button>
                    <button type="button" onClick={() => triggerDebateAction("guardia")}>Guardia</button>
                    <button type="button" onClick={() => triggerDebateAction("empujon")}>Empujón</button>
                  </>
                )}
              </div>
              <small>{debateState.mode === "ruleta" ? "J/espacio: apretar · G: ring · Esc: volver" : "A/D: esquivar · J: piña · K: empujón · L: guardia · R: ruleta · Esc: volver"}</small>
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
