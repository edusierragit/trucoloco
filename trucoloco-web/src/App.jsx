import { useCallback, useEffect, useRef, useState } from "react";
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
  playerLane: -0.18,
  rivalLane: 0.18,
  playerStamina: 3,
  rivalStamina: 3,
  pull: 0,
  playerTrigger: 0,
  rivalTrigger: 0,
  playerChamber: 4,
  rivalChamber: 5,
  turn: "player",
  resolved: false,
  lastMove: "Entraste a la sala de conflicto. Alineate, guardá aire y resolvé la discusión."
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
  const [cameraView, setCameraView] = useState("entry");
  const [isSeatingRitual, setIsSeatingRitual] = useState(false);
  const [walkHotspot, setWalkHotspot] = useState(null);
  const [walkNotice, setWalkNotice] = useState("");
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
    setCameraView(viewId);
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
      const cost = kind === "empujon" ? 2 : 1;
      const hasAir = current.playerStamina >= cost;
      const nextStamina = hasAir ? Math.max(0, current.playerStamina - cost) : 0;
      const distance = Math.abs(current.playerLane - current.rivalLane);
      const hitLanded = hasAir && distance <= (kind === "empujon" ? 0.42 : 0.34);
      const rivalCounter = hitLanded && (kind === "empujon" ? nextToken % 4 === 0 : nextToken % 3 === 0);
      const whiffPunish = !hitLanded && distance <= 0.48 && nextToken % 2 === 0;
      const playerGain = hitLanded ? (kind === "empujon" ? 2 : 1) : 0;
      const rivalGain = rivalCounter ? 2 : whiffPunish ? 1 : 0;
      const nextPlayer = Math.min(5, current.player + playerGain);
      const nextRival = Math.min(5, current.rival + rivalGain);
      const playerWon = nextPlayer >= 5 && nextPlayer > nextRival;
      const rivalWon = nextRival >= 5 && nextRival >= nextPlayer;
      const directionToPlayer = Math.sign(current.playerLane - current.rivalLane || 1);
      const rivalStep = hitLanded ? -directionToPlayer * 0.14 : directionToPlayer * 0.18;
      const nextRivalLane = clamp(current.rivalLane + rivalStep, -0.72, 0.72);
      const staminaRead = getRingRead(Math.abs(current.playerLane - nextRivalLane), nextStamina);

      return {
        kind,
        token: nextToken,
        player: nextPlayer,
        rival: nextRival,
        playerLane: current.playerLane,
        rivalLane: nextRivalLane,
        playerStamina: nextStamina,
        rivalStamina: Math.min(3, current.rivalStamina + (whiffPunish ? -1 : 0.35)),
        resolved: playerWon || rivalWon,
        lastMove: playerWon
          ? "Ganaste el cruce. La mesa acepta tu versión aunque nadie entendió nada."
          : rivalWon
            ? "Te sacaron del eje. La mesa se ríe y pide revancha."
            : rivalCounter
          ? "Te contestaron con hombro. El conflicto sigue vivo."
          : !hasAir
            ? `Te quedaste sin aire y tiraste un manotazo triste. ${staminaRead}.`
          : !hitLanded
            ? `Le pegaste al aire. ${whiffPunish ? "Te puntearon de vuelta." : "Quedaste pagando."} ${staminaRead}.`
          : kind === "empujon"
            ? `Empujón sucio, efectivo y poco reglamentario. ${staminaRead}.`
            : `Piña corta. Pegó justo donde dolía el orgullo. ${staminaRead}.`
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

        if (distance > 0.36) {
          const nextRivalLane = clamp(current.rivalLane + directionToPlayer * 0.14, -0.72, 0.72);

          return {
            ...current,
            kind: "rival-move",
            token: nextToken,
            rivalLane: nextRivalLane,
            rivalStamina: Math.min(3, current.rivalStamina + 0.35),
            lastMove: `La mesa te busca el cuerpo. ${getRingRead(Math.abs(current.playerLane - nextRivalLane), current.playerStamina)}.`
          };
        }

        if (current.rivalStamina < 1) {
          return {
            ...current,
            kind: "rival-breathe",
            token: nextToken,
            rivalStamina: Math.min(3, current.rivalStamina + 0.8),
            lastMove: "La mesa afloja medio paso y recupera aire. Es tu ventana."
          };
        }

        const nextRival = Math.min(5, current.rival + 1);
        const rivalWon = nextRival >= 5 && nextRival >= current.player;
        const nextPlayerLane = clamp(current.playerLane - directionToPlayer * 0.08, -0.72, 0.72);

        return {
          ...current,
          kind: "rival",
          token: nextToken,
          playerLane: nextPlayerLane,
          rival: nextRival,
          rivalStamina: Math.max(0, current.rivalStamina - 1),
          resolved: rivalWon,
          lastMove: rivalWon
            ? "La mesa te sacó del ring discursivo. Perdiste el conflicto, no necesariamente la dignidad."
            : `Te apuraron con hombro. Movete o contestá. ${getRingRead(Math.abs(nextPlayerLane - current.rivalLane), current.playerStamina)}.`
        };
      });
    }, 1150);

    return () => window.clearInterval(debateAiTimerRef.current);
  }, [cameraView]);

  const moveDebatePlayer = useCallback((direction) => {
    setDebateState((current) => {
      if (current.resolved || current.mode === "ruleta") return current;

      return {
        ...current,
        kind: "move",
        token: current.token + 1,
        playerLane: clamp(current.playerLane + direction * 0.18, -0.72, 0.72),
        playerStamina: Math.min(3, current.playerStamina + 0.55),
        lastMove: direction < 0 ? "Te corrés a la izquierda y recuperás aire." : "Te corrés a la derecha y recuperás aire."
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
            shadows={{ enabled: true, type: PCFSoftShadowMap }}
            dpr={[1, 1.75]}
            gl={{
              antialias: true,
              outputColorSpace: SRGBColorSpace,
              powerPreference: "high-performance",
              toneMapping: ACESFilmicToneMapping,
              toneMappingExposure: 1.22
            }}
          >
            <color attach="background" args={["#060403"]} />
            <fog attach="fog" args={["#060403", 7.2, 18.5]} />
            <TrucolocoScene
              match={match}
              cameraView={cameraView}
              debateAction={debateState}
              selectedWalkCharacter={match.selectedCharacter ?? match.activeLane.human}
              walkHotspot={walkHotspot}
              onWalkHotspotChange={setWalkHotspot}
              onWalkInteract={handleWalkInteract}
            />
            <EffectComposer multisampling={0}>
              <Bloom intensity={0.11} luminanceThreshold={0.82} luminanceSmoothing={0.45} mipmapBlur />
              <Vignette offset={0.18} darkness={0.31} eskil={false} />
              <Noise opacity={0.012} blendFunction={BlendFunction.SOFT_LIGHT} />
            </EffectComposer>
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
                        : "Q/E rotan cámara · Shift apura · 2 vuelve a mesa")}
              </small>
            </div>
          ) : null}

          {cameraView === "ring" && !isSeatingRitual ? (
            <div className={debateState.resolved ? "debate-hint debate-hint-resolved" : "debate-hint"} aria-live="polite">
              <div className="debate-hint-header">
                <span>Conflicto</span>
                <strong>{debateState.player} - {debateState.rival}</strong>
              </div>
              <strong>{debateState.mode === "ruleta" ? "Ruleta de corchos" : "Sala de conflicto"}</strong>
              <p>{debateState.lastMove}</p>
              <div className="debate-meter-stack" aria-hidden="true">
                <div className="debate-meter-row">
                  <span>Vos</span>
                  <div className="debate-meter debate-meter-player">
                    <i style={{ "--debate-meter": `${Math.max(8, ((debateState.mode === "ruleta" ? debateState.playerTrigger : debateState.player) / (debateState.mode === "ruleta" ? 6 : 5)) * 100)}%` }} />
                  </div>
                </div>
                <div className="debate-meter-row">
                  <span>Mesa</span>
                  <div className="debate-meter debate-meter-rival">
                    <i style={{ "--debate-meter": `${Math.max(8, ((debateState.mode === "ruleta" ? debateState.rivalTrigger : debateState.rival) / (debateState.mode === "ruleta" ? 6 : 5)) * 100)}%` }} />
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
                    <span>{getRingRead(Math.abs(debateState.playerLane - debateState.rivalLane), debateState.playerStamina)}</span>
                  </>
                )}
              </div>
              <small>
                {debateState.mode === "ruleta"
                  ? debateState.resolved
                    ? "J: otra botella · G: ring · Esc: volver"
                    : "J/espacio: apretar · G: ring · Esc: volver"
                  : debateState.resolved
                    ? "J / K: revancha · R: ruleta · Esc: volver"
                    : "A/D: moverte · J: piña · K: empujón · R: ruleta · Esc: volver"}
              </small>
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
