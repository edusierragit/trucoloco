import { useCallback, useEffect, useRef, useState } from "react";
import { applyCombatAction, clamp, createDebateState, resolveCorkRoulettePull, stepArenaCombat } from "./combatState";
import { useConflictInput } from "./useConflictInput";

let conflictAudioContext = null;

function playConflictHitSound(hitStrength = 0.5, resolved = false) {
  if (typeof window === "undefined") return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const context = conflictAudioContext ?? new AudioContext();
  conflictAudioContext = context;
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

export function useConflictCombat({ enabled, onExit, weaponContext }) {
  const [debateState, setDebateState] = useState(() => createDebateState());
  const ringFrameRef = useRef(null);
  const ringKeysRef = useRef(new Set());
  const debateSoundTokenRef = useRef(debateState.token);
  const weaponContextRef = useRef(weaponContext);

  useEffect(() => {
    weaponContextRef.current = weaponContext;
  }, [weaponContext]);

  const resetDebateState = useCallback((overrides = {}) => {
    setDebateState((current) => createDebateState({
      token: (current.token ?? 0) + 1,
      ...overrides
    }));
  }, []);

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

      return applyCombatAction(current, "player", kind, weaponContextRef.current);
    });
  }, []);

  const triggerRivalDebateAction = useCallback((kind) => {
    setDebateState((current) => {
      if (current.resolved || current.mode === "ruleta") return current;

      return applyCombatAction(current, "rival", kind, weaponContextRef.current);
    });
  }, []);

  const switchDebateMode = useCallback((mode) => {
    setDebateState((current) => createDebateState({
      mode,
      token: current.token + 1,
      lastMove: mode === "ruleta"
        ? "Modo ruleta de utileria. Dos tambores, seis posiciones por lado. Si salta el corcho, pierde la disputa."
        : "Modo ring real-time. Movete libre, pega cuando estes cerca y defendete si P2 te encima."
    }));
  }, []);

  const setCombatKey = useCallback((key, pressed) => {
    if (pressed) ringKeysRef.current.add(key);
    else ringKeysRef.current.delete(key);
  }, []);

  useEffect(() => {
    if (!enabled) {
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
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (debateSoundTokenRef.current === debateState.token) return;
    debateSoundTokenRef.current = debateState.token;

    const damage = Math.max(debateState.lastDamageToPlayer ?? 0, debateState.lastDamageToRival ?? 0);
    if (damage > 0 || debateState.resolved) {
      playConflictHitSound(debateState.hitStrength ?? damage / 34, debateState.resolved);
    }
  }, [
    enabled,
    debateState.hitStrength,
    debateState.lastDamageToPlayer,
    debateState.lastDamageToRival,
    debateState.resolved,
    debateState.token
  ]);

  useConflictInput({
    enabled,
    mode: debateState.mode,
    keysRef: ringKeysRef,
    onExit,
    onPrimaryAction: triggerDebateAction,
    onRivalAction: triggerRivalDebateAction,
    onSwitchMode: switchDebateMode
  });

  return {
    debateState,
    resetDebateState,
    triggerDebateAction,
    switchDebateMode,
    setCombatKey
  };
}
