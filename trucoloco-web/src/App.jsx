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
import { buildGuestMatchView } from "./game/net/guestView";
import {
  getCombatPos as getConflictCombatPos,
  getCombatVector as getConflictCombatVector,
  getDebateGoal as getConflictDebateGoal,
  getDebateTitle as getConflictDebateTitle,
  getRingRead as getConflictRingRead,
  getRivalAttackName as getConflictRivalAttackName
} from "./game/conflict/combatState";
import { useConflictCombat } from "./game/conflict/useConflictCombat";

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

export default function App() {
  const match = useTrucolocoMatch();
  const performanceProfile = useMemo(() => getInitialPerformanceProfile(), []);
  const [cameraView, setCameraView] = useState("table");
  const [isSeatingRitual, setIsSeatingRitual] = useState(false);
  const [walkHotspot, setWalkHotspot] = useState(null);
  const [walkNotice, setWalkNotice] = useState("");
  const [, setWalkAnimationDebug] = useState(null);
  const [walkTouchInput, setWalkTouchInput] = useState(() => createEmptyWalkTouchInput());
  const previousHandStartedRef = useRef(match.handStarted);
  const returnToTableTimerRef = useRef(null);
  const walkNoticeTimerRef = useRef(null);
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
    switchDebateMode
  } = useConflictCombat({
    enabled: cameraView === "ring",
    onExit: handleRingExit,
    weaponContext: conflictWeaponContext
  });

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
      // guest: tu pantalla ES la partida del host (hydrate valida el shape)
      room.onSnapshot((snapPayload) => matchRef.current.hydrate?.(snapPayload));
    } else {
      // host-autoritativo: snapshot inicial apenas existe la sala, para que
      // el primer guest no se quede con su estado local por defecto (el
      // onPeerJoin de room.js se lo manda al que entra)
      room.sendSnapshot(matchRef.current.getSnapshot());
      // jugadas remotas: el intent vale solo si la silla que dice usar es la
      // que ese peer reclamó en la sala; después el match revalida los gates
      room.onIntent((peerId, intentData) => {
        const sender = rosterRef.current.find((peer) => peer.peerId === peerId);
        if (!sender || sender.seatId !== intentData.seatId) return;
        matchRef.current.applyIntent?.(intentData);
      });
    }
    netRoomRef.current = room;
    setNetRoom(room);
    // la URL ES la sala: refresh te devuelve adentro (ver MULTIPLAYER_DESIGN.md)
    window.history.replaceState(null, "", `${window.location.pathname}?sala=${code}`);
  }, [match.selectedCharacter, match.selectedRole]);

  const [micOn, setMicOn] = useState(false);
  const [salaCollapsed, setSalaCollapsed] = useState(false);
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
    if (seat && match.canSwitchRole) {
      match.selectRole(seat.role);
      // tu avatar pasa a ser el personaje de esa silla: dos humanos en sillas
      // distintas dejan de verse como el mismo Pochex replicado
      if (seat.playerId) match.selectCharacter(seat.playerId);
    }
  }, [match]);

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
    if (rival) netRoomRef.current?.updateProfile({ seatId: null, seatAt: null });
  }, [roster]);

  // al entrar a una sala con más gente, tomás automáticamente una silla LIBRE
  // (distinta) para no aparecer como el mismo personaje que otro
  const autoSeatDoneRef = useRef(false);
  useEffect(() => {
    if (!netRoom) {
      autoSeatDoneRef.current = false;
      return;
    }
    const me = roster.find((peer) => peer.self);
    if (!me || me.seatId || roster.length < 2 || autoSeatDoneRef.current) return;
    const taken = new Set(roster.filter((peer) => peer.seatId).map((peer) => peer.seatId));
    const free = tableSeats.find((seat) => !taken.has(seat.seatId));
    if (free) {
      autoSeatDoneRef.current = true;
      claimSeat(free.seatId);
    }
  }, [roster, netRoom, claimSeat]);

  // ── vista de guest (host-autoritativo) ────────────────────────────────────
  // el guest no muta su match local: sus acciones viajan como intents al host
  // y la mesa se actualiza cuando vuelve el snapshot. buildGuestMatchView
  // deriva humanHand/gates de SU silla con la misma interfaz del hook.
  const mySeatId = useMemo(() => roster.find((peer) => peer.self)?.seatId ?? null, [roster]);
  const isGuest = Boolean(netRoom && !netRoom.isHost);

  const sendIntent = useCallback((action, payload = {}) => {
    const room = netRoomRef.current;
    if (!room || room.isHost) return;
    const seatId = rosterRef.current.find((peer) => peer.self)?.seatId;
    if (!seatId) return;
    room.sendIntent({ action, seatId, playerId: getPlayerId(), payload });
  }, []);

  const viewMatch = useMemo(
    () => (isGuest ? buildGuestMatchView(match, mySeatId, sendIntent) : match),
    [isGuest, match, mySeatId, sendIntent]
  );

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
    // silla de un humano remoto: el host espera su intent en vez de jugarla
    // el bot (sin timeout de suplente todavía — ver MULTIPLAYER_DESIGN.md §2)
    const turnPhases = ["table-auto-turn", "pre-rival-lead", "rival-leads"];
    if (
      turnPhases.includes(match.phase) &&
      match.currentTurnSeatId &&
      roster.some((peer) => !peer.self && peer.seatId === match.currentTurnSeatId)
    ) {
      return undefined;
    }
    const delay = match.phase === "trick-closed" ? 2100 : match.phase === "envido-resolution" ? 2300 : 1000;
    const timer = window.setTimeout(() => {
      if (match.phase === "envido-resolution") match.settleEnvido();
      else if (match.phase === "trick-closed") match.clearTrick();
      else if (match.phase === "pre-rival-lead" || match.phase === "rival-leads") match.revealRivalLead();
      else match.advance();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [autoPlayEnabled, match, netRoom, roster]);

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
      handleCameraViewChange("seat");
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
      currentMatch.startHand();
      return;
    }

    setIsSeatingRitual(true);
    setCameraView("seat");
    returnToTableTimerRef.current = window.setTimeout(() => {
      setCameraView("table");
      setIsSeatingRitual(false);
    }, 950);
  }, [handleCameraViewChange, resetDebateState]);

  const stageClassName = [
    "stage-shell",
    isSeatingRitual ? "stage-seating-ritual" : "",
    cameraView === "walk" && !isSeatingRitual ? "stage-walk-mode" : "",
    cameraView === "ring" && !isSeatingRitual ? "stage-ring-mode" : "",
    cameraView === "seat" && !isSeatingRitual ? "stage-seat-mode" : "",
    cameraView === "table" && !isSeatingRitual ? "stage-table-mode" : "",
    // espectador puro = guest SIN silla; con silla reclamada, el guest juega
    isGuest && !mySeatId ? "stage-espectador" : ""
  ].filter(Boolean).join(" ");

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (isTyping) return;

      if (event.key === "1") handleCameraViewChange("seat");
      if (event.key === "2") handleCameraViewChange("walk");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleCameraViewChange]);

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
              match={viewMatch}
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
                <span>{walkHotspot === "bar" ? "Barra" : walkHotspot === "door" ? "Mesa" : "Caminar"}</span>
                <strong>
                  {walkHotspot === "table"
                    ? "F · Sentarse en mesa"
                    : walkHotspot === "door"
                      ? "F · Sentarse a la mesa"
                      : walkHotspot === "bar"
                        ? "F · Mirar barra"
                        : walkHotspot === "ring"
                          ? "F · Entrar a pelear"
                        : "WASD / Flechas"}
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
                        ? "Volvés a tu silla en la mesa"
                        : walkHotspot === "bar"
                          ? "Botellas, humo y promesas de truco"
                        : walkHotspot === "ring"
                          ? "Entrás a una sala aparte: golpes y cero jurisprudencia"
                          : "WASD para moverte · Q/E giran la cámara · Shift corre")}
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
          <Hud match={viewMatch} cameraView={cameraView} onReturnToTable={() => handleCameraViewChange("table")} />
        </aside>
      </div>

      {createPortal(
        netRoom ? (
          <div className={`${salaCollapsed ? "sala-panel sala-panel-collapsed" : "sala-panel"}${match.phase === "role-select" ? "" : " sala-lower"}`}>
            <div className="sala-head">
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
                  Reclamá tu silla arriba y pasale el link a los pibes.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className={`sala-join-box${match.phase === "role-select" ? "" : " sala-lower"}`}>
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
