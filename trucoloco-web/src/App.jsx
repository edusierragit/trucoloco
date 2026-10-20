import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { ACESFilmicToneMapping, PCFSoftShadowMap, Raycaster, SRGBColorSpace, Vector2 } from "three";
import { TrucolocoScene } from "./game/scene/TrucolocoScene";
import { Hud } from "./game/ui/Hud";
import { useTrucolocoMatch } from "./game/hooks/useTrucolocoMatch";
import { tableSeats, teams } from "./game/data/characters";
import { sfx } from "./game/audio/sfx";
import { createPortal } from "react-dom";
import { createTrucolocoRoom, findOpenSala, genRoomCode, getPlayerId, openSalaBackfill, ROOM_LIMIT } from "./game/net/room";
import { createRelayRoom } from "./game/net/relayRoom";
import { DuelOverlay } from "./game/conflict/duel/DuelOverlay";
import { useFps, useFrameWatchdog, useQuality } from "./game/useQuality";
import { QUALITY_TIERS } from "./game/perf";

const playerById = [...teams.A, ...teams.B].reduce((players, player) => {
  players[player.id] = player;
  return players;
}, {});

function createEmptyWalkTouchInput() {
  return { x: 0, z: 0, rotate: 0, sprint: false, boxToken: 0, jumpToken: 0 };
}

function SceneReadySignal({ onReady }) {
  useEffect(() => onReady(), [onReady]);
  return null;
}

// Mide fps dentro del render loop sin re-renderizar nada por frame.
// El contador de fps mide SIEMPRE; solo la degradación depende del modo auto.
const PERF_PROBE = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("probe");

function QualityWatchdog({ quality }) {
  const { gl, scene, camera } = useThree();
  const tick = useFrameWatchdog({
    enabled: true,
    onFps: quality.reportFps,
    onDegrade: quality.auto ? quality.degrade : undefined
  });

  // ?probe: expone draw calls / triángulos acumulados de TODAS las pasadas del
  // frame (con postprocessing, el autoReset solo mostraría el quad final).
  useEffect(() => {
    if (!PERF_PROBE) return undefined;
    window.__TL_THREE__ = { scene, camera, gl, Raycaster, Vector2 };
    gl.info.autoReset = false;
    return () => { gl.info.autoReset = true; };
  }, [gl]);

  useFrame((state) => {
    tick(state.clock.elapsedTime);
    if (!PERF_PROBE) return;
    const { render, memory, programs } = gl.info;
    window.__TL_PERF__ = {
      calls: render.calls,
      triangles: render.triangles,
      geometries: memory.geometries,
      textures: memory.textures,
      programs: programs?.length ?? 0
    };
    gl.info.reset();
  }, -1000);
  return null;
}

// Perilla de calidad. El watchdog degrada solo, pero el jugador manda: si
// toca un tier, se guarda y el auto se apaga (nada le pisa la elección).
function QualityDock({ quality }) {
  const [open, setOpen] = useState(false);
  const fps = useFps();
  const fpsTone = fps >= 55 ? "ok" : fps >= 40 ? "mid" : "bad";

  return (
    <div className={open ? "quality-dock quality-dock-open" : "quality-dock"}>
      <button
        type="button"
        className="quality-dock-toggle"
        onClick={() => setOpen((value) => !value)}
        title="Calidad grafica y rendimiento"
      >
        <span className={`quality-fps quality-fps-${fpsTone}`}>{fps}</span>
        <small>fps</small>
      </button>
      {open ? (
        <div className="quality-dock-panel">
          <strong>Calidad</strong>
          <div className="quality-dock-tiers">
            {quality.tiers.map((id) => (
              <button
                key={id}
                type="button"
                className={id === quality.tier ? "quality-tier quality-tier-on" : "quality-tier"}
                onClick={() => quality.setTier(id)}
              >
                {QUALITY_TIERS[id].label}
              </button>
            ))}
          </div>
          <em>{QUALITY_TIERS[quality.tier]?.blurb}</em>
          <span className="quality-dock-meta">
            {quality.auto ? "Auto: baja sola si el antro se traba" : "Manual"}
            {" · "}
            {Math.round(quality.dpr * 100)}% de resolucion
          </span>
          {!quality.auto ? (
            <button type="button" className="quality-dock-auto" onClick={() => quality.setAuto(true)}>
              Volver a automatico
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function App({ onExitToPortal } = {}) {
  if (PERF_PROBE) window.__TL_RENDERS__ = { ...(window.__TL_RENDERS__ ?? {}), App: (window.__TL_RENDERS__?.App ?? 0) + 1 };
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
  // lo que el jugador ya decidió en el portal: no se lo volvemos a preguntar
  const urlIntent = useMemo(() => {
    if (typeof window === "undefined") return { play: "", modeLocked: false };
    const params = new URLSearchParams(window.location.search);
    return { play: params.get("jugar") ?? "", modeLocked: params.has("modo") };
  }, []);
  const match = useTrucolocoMatch({ mySeatId: myOnlineSeatId });
  const quality = useQuality();
  const performanceProfile = quality.profile;
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

  useEffect(() => {
    if (!PERF_PROBE) return undefined;
    window.__TL_PROBE_VIEW__ = handleCameraViewChange;
    return () => { delete window.__TL_PROBE_VIEW__; };
  }, [handleCameraViewChange]);

  const handleRingExit = useCallback(() => {
    handleCameraViewChange("walk");
  }, [handleCameraViewChange]);


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
    remotePosRef.current = {};
    setRemoteSeen({});
    // 20 Hz por peer: van a un ref que los caminantes leen en useFrame.
    // React solo se entera cuando aparece alguien nuevo (antes: un render
    // de App entero por paquete, ~100/s con la mesa llena).
    room.onPos((peerId, data) => {
      const known = peerId in remotePosRef.current;
      remotePosRef.current[peerId] = { x: data.x, z: data.z, yaw: data.yaw, mode: data.mode };
      if (!known) setRemoteSeen((current) => ({ ...current, [peerId]: true }));
    });
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

  const [linkCopied, setLinkCopied] = useState(false);
  useEffect(() => {
    if (!linkCopied) return undefined;
    const timer = window.setTimeout(() => setLinkCopied(false), 2200);
    return () => window.clearTimeout(timer);
  }, [linkCopied]);

  const copySalaLink = useCallback(async () => {
    const room = netRoomRef.current;
    if (!room) return;
    const link = `${window.location.origin}${window.location.pathname}?sala=${room.code}`;
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
    } catch {
      window.prompt("Copiá el link:", link);
    }
  }, []);

  const retrySala = useCallback(() => {
    const room = netRoomRef.current;
    if (!room) return;
    const code = room.code;
    const isHost = room.isHost;
    setConnTimedOut(false);
    joinSala(code, isHost); // recrea la conexión al mismo código
  }, [joinSala]);
  const remotePosRef = useRef({});
  const [remoteSeen, setRemoteSeen] = useState({});
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
    if (urlSalaCode) {
      joinSala(urlSalaCode, false);
      return;
    }
    // "Jugar con un bot" en el portal = sentarse y repartir, sin menú intermedio
    if (urlIntent.play === "bot") {
      match.startHand();
      setCameraView("seat");
    }
  }, [claimSeat, getSeatBlockReason, joinSala, match, showSalaNotice, urlIntent.play, urlSalaCode]);

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
    remotePosRef.current = {};
    setRemoteSeen({});
    setMyOnlineSeatId(null);
    window.history.replaceState(null, "", window.location.pathname);
    // frenar la partida al salir: antes los bots seguian tirando cartas
    matchRef.current?.returnToRoleSelect?.();
    setCameraView("table");
  }, []);

  // salir de una partida SOLA (o del bar) sin refrescar: vuelve al menú
  const exitToMenu = useCallback((destination = "home") => {
    if (netRoomRef.current) {
      leaveSala();
    } else {
      matchRef.current?.returnToRoleSelect?.();
      setCameraView("table");
    }
    setIdentityConfirmed(false);
    setPlayMenuOpen(false);
    onExitToPortal?.(typeof destination === "string" ? destination : "home");
  }, [leaveSala, onExitToPortal]);

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
  const autoMomentKey = [
    match.handNumber,
    match.phase,
    match.tableCards.length,
    match.trickHistory.length,
    match.currentTurnSeatId,
    match.canAdvance,
    match.canPlayCard,
    match.handStarted,
    match.matchWinner ?? "",
    netRoom?.isHost ?? "solo"
  ].join("|");
  useEffect(() => {
    if (!autoPlayEnabled) return undefined;
    if (!sceneReady) return undefined; // nadie juega detrás de "Abriendo el antro"
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
    // el timer se ancla al MOMENTO de la mesa, no a la identidad de `match`:
    // un re-render cualquiera (sala, hover, calidad) no debe reiniciar la cuenta
    const timer = window.setTimeout(() => {
      const current = matchRef.current;
      if (current.phase === "envido-resolution") current.settleEnvido();
      else if (current.phase === "trick-closed") current.clearTrick();
      else if (current.phase === "pre-rival-lead" || current.phase === "rival-leads") current.revealRivalLead();
      else current.advance();
    }, delay);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlayEnabled, autoMomentKey, roster, sceneReady]);

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
  }, [handleCameraViewChange, startRoomHand]);

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
      {onExitToPortal || (match.handStarted && cameraView !== "ring") ? (
        <button className="exit-to-menu" type="button" onClick={() => exitToMenu("home")} title="Salir de la partida sin refrescar">
          ← <span className="exit-to-menu-label">Salir al menú</span>
        </button>
      ) : null}
      {pillTrip ? <div className={`pill-trip pill-trip-${pillTrip.color}`} aria-hidden="true" /> : null}
      {pillToast ? <div className="pill-toast">{pillToast}</div> : null}
      <div className={stageClassName}>
        <section className="stage-viewport">
          <Canvas
            camera={{ position: [0, 4.45, 6.15], fov: 34 }}
            shadows={performanceProfile.shadows ? { enabled: true, type: PCFSoftShadowMap } : false}
            dpr={quality.dpr}
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
                  .filter((peer) => !peer.self && remoteSeen[peer.peerId])}
                remotePosRef={remotePosRef}
                match={playMatch}
                cameraView={cameraView}
                selectedWalkCharacter={match.selectedCharacter ?? match.activeLane.human}
                performanceMode={quality.tier}
                walkHotspot={walkHotspot}
                walkTouchInput={walkTouchInput}
                onWalkHotspotChange={setWalkHotspot}
                onWalkInteract={handleWalkInteract}
                onWalkAnimationDebugChange={setWalkAnimationDebug}
              />
              <SceneReadySignal onReady={() => setSceneReady(true)} />
              <QualityWatchdog quality={quality} />
            </Suspense>
            {performanceProfile.postprocessing ? (
              <EffectComposer multisampling={0}>
                {/* [VISUAL] Subtle grade: less bloom, stronger vignette, cleaner nocturnal focus. */}
                <Bloom intensity={0.06} luminanceThreshold={0.92} luminanceSmoothing={0.45} />
                <Vignette offset={0.16} darkness={0.38} eskil={false} />
              </EffectComposer>
            ) : null}
          </Canvas>

          <QualityDock quality={quality} />

          {!sceneReady ? (
            <div className="scene-loading-ui" role="status" aria-live="polite">
              <div className="scene-loading-mark">TL</div>
              <strong>Abriendo el antro</strong>
              <span>Encendiendo luces · preparando la mesa · cargando personajes</span>
            </div>
          ) : null}

          {identityConfirmed && (netRoom || match.handStarted) && cameraView !== "walk" && cameraView !== "ring" ? <div className="camera-dock camera-dock-context" aria-label="Movimiento por el bar">
            <button
              type="button"
              className="camera-dock-button camera-dock-button-active"
              title="Levantarse y caminar por el bar (WASD / flechas)"
              onClick={() => handleCameraViewChange("walk")}
            >
              <span>🍺 Pararse</span>
            </button>
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
            <DuelOverlay
              playerName={(match.selectedCharacter ?? match.activeLane.human)?.name}
              rivalName={match.activeLane.rival?.name}
              onExit={handleRingExit}
            />
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
              modeLocked: urlIntent.modeLocked && !netRoom,
              playIntent: urlIntent.play,
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
                    {/* El host solo recién creada la sala es lo normal: no es un
                        error. El invitado solo sí lo es (no enganchó al host). */}
                    {roster.length < 2 && connTimedOut ? (
                      netRoom.isHost ? (
                        <p className="sala-conn-hint">
                          ¿Tu amigo entró y no aparece?{" "}
                          <button type="button" onClick={retrySala}>Reconectar</button>
                        </p>
                      ) : (
                        <div className="sala-conn-help">
                          <p>No encontramos al anfitrión. Revisá que tengan el mismo código, bajá los Shields de Brave 🦁 o probá en Chrome.</p>
                          <button className="sala-btn sala-btn-on" type="button" onClick={retrySala}>
                            🔄 Reintentar conexión
                          </button>
                        </div>
                      )
                    ) : null}
                  </div>
                ) : null}

                {!match.handStarted && netRoom.isHost && roster.length >= ROOM_LIMIT ? (
                  <button className="sala-share sala-start" type="button" onClick={startRoomHand}>
                    ▶ Arrancar la partida
                  </button>
                ) : null}

                <button
                  className={!match.handStarted && roster.length >= ROOM_LIMIT ? "sala-btn sala-copy" : "sala-share sala-copy"}
                  type="button"
                  onClick={copySalaLink}
                >
                  {linkCopied ? "✓ ¡Link copiado! Mandalo al grupo" : `⧉ ${roster.length === 1 ? "Copiar link e invitar" : "Copiar link"}`}
                </button>

                {!match.handStarted && roster.length < ROOM_LIMIT ? (
                  netRoom.isHost ? (
                    <button className="sala-btn sala-fill-bots" type="button" onClick={startRoomHand}>
                      Jugar ya · {ROOM_LIMIT - roster.length} {ROOM_LIMIT - roster.length === 1 ? "bot" : "bots"} completan la mesa
                    </button>
                  ) : (
                    <p className="sala-note">El anfitrión arranca cuando quiera; si faltan, completan bots.</p>
                  )
                ) : null}

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
                <button className="sala-btn sala-fill-bots" type="button" onClick={startBotTest}>
                  Jugar solo con bots
                </button>
              </>
            )}
          </div>
        ) : null,
        document.body
      )}
    </div>
  );
}
