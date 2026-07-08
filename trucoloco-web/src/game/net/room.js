// Salas online de Trucoloco — P2P sin servidor (trystero via relays nostr).
// Etapa 1: presencia — crear sala, entrar por link, ver quién está y qué rol
// eligió. La sincronización de la partida se monta encima de esta base.
import { joinRoom, selfId } from "trystero";

const APP_ID = "frikex-trucoloco-v1";
// relays pineados — los defaults fallan seguido (lección de slingshot)
const RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://nostr.mom",
  "wss://relay.primal.net",
  "wss://nostr-pub.wellorder.net"
];

// ICE: STUN descubre la IP pública. TURN RELEVA el tráfico cuando los dos
// están detrás de NAT restrictivo (casas) — sin TURN, dos personas en redes
// distintas no logran el WebRTC aunque la señalización funcione. Era la
// causa #1 de "no me toma que se une" (mis tests corrían en 1 sola máquina
// = loopback, por eso nunca lo vi). TURN gratis de openrelay/metered.
const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
};
const TURN_CONFIG = [
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" }
];
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_LIMIT = 6; // trucoloco 3v3: seis sillas, ni una más

export const genRoomCode = () =>
  Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");

export const myPeerId = selfId;

export function createTrucolocoRoom(code, { isHost, profile }) {
  const room = joinRoom({ appId: APP_ID, relayConfig: { urls: RELAYS, redundancy: RELAYS.length }, rtcConfig: RTC_CONFIG, turnConfig: TURN_CONFIG }, `sala-${code}`);
  const hello = room.makeAction("hello");
  const snap = room.makeAction("snap");
  const pos = room.makeAction("pos");
  // partida compartida: el guest PROPONE una jugada (intent), el host la
  // valida contra el motor y la verdad vuelve como snapshot. Nadie más que
  // el host toca el estado.
  const intent = room.makeAction("intent");
  const fx = room.makeAction("fx");
  let onSnapshotCb = null;
  let onPosCb = null;
  let onIntentCb = null;
  let onFxCb = null;
  fx.onMessage = (data) => {
    if (data && typeof data === "object") onFxCb?.(data);
  };
  intent.onMessage = (data, context) => {
    if (data && typeof data === "object" && typeof data.action === "string") {
      onIntentCb?.(context.peerId, data);
    }
  };
  pos.onMessage = (data, context) => {
    if (data && typeof data === "object") onPosCb?.(context.peerId, data);
  };
  snap.onMessage = (data) => {
    if (data && typeof data === "object") onSnapshotCb?.(data);
  };

  // ── chat de voz P2P (full mesh, 6 peers es viable) ──
  let micStream = null;
  const audioEls = new Map();

  room.onPeerStream = (stream, peerId) => {
    let el = audioEls.get(peerId);
    if (!el) {
      el = new Audio();
      el.autoplay = true;
      el.playsInline = true;
      audioEls.set(peerId, el);
    }
    el.srcObject = stream;
    void el.play().catch(() => {});
  };

  // peerId -> { name, role, characterId, isHost }
  const peers = new Map();
  let onRosterChange = null;
  let myProfile = { ...profile, isHost };

  const emitRoster = () => {
    if (!onRosterChange) return;
    const roster = [
      { peerId: selfId, ...myProfile, self: true },
      ...[...peers.entries()].map(([peerId, data]) => ({ peerId, ...data, self: false }))
    ];
    onRosterChange(roster);
  };

  hello.onMessage = (data, context) => {
    if (!data || typeof data !== "object") return;
    // sala llena: registramos igual pero marcamos overflow (el host decide mostrarlo)
    peers.set(context.peerId, {
      name: String(data.name ?? "???").slice(0, 16),
      role: typeof data.role === "string" ? data.role : null,
      characterId: typeof data.characterId === "string" ? data.characterId : null,
      playerId: typeof data.playerId === "string" ? data.playerId : null,
      seatId: typeof data.seatId === "string" ? data.seatId : null,
      seatAt: typeof data.seatAt === "number" ? data.seatAt : null,
      isHost: Boolean(data.isHost),
      overflow: peers.size + 1 >= ROOM_LIMIT
    });
    emitRoster();
  };

  let latestSnapshot = null;
  room.onPeerJoin = (peerId) => {
    void hello.send(myProfile, { target: peerId });
    if (isHost && latestSnapshot) void snap.send(latestSnapshot, { target: peerId });
    // si ya tengo el mic prendido, el recién llegado también me escucha
    if (micStream) room.addStream(micStream, peerId);
  };

  room.onPeerLeave = (peerId) => {
    peers.delete(peerId);
    const el = audioEls.get(peerId);
    if (el) {
      el.srcObject = null;
      audioEls.delete(peerId);
    }
    emitRoster();
  };

  return {
    code,
    isHost,
    get peerCount() {
      return peers.size + 1;
    },
    updateProfile(next) {
      myProfile = { ...myProfile, ...next };
      void hello.send(myProfile);
      emitRoster();
    },
    // guest -> host: "quiero jugar esta carta / cantar truco / querer"
    sendIntent(action, payload = null) {
      void intent.send({ action, payload, at: Date.now() });
    },
    // host: escucha intents y los aplica al motor (validando turno y asiento)
    onIntent(cb) {
      onIntentCb = cb;
    },
    sendFx(d) {
      void fx.send(d);
    },
    onFx(cb) {
      onFxCb = cb;
    },
    onRoster(cb) {
      onRosterChange = cb;
      emitRoster();
    },
    sendPos(payload) {
      void pos.send(payload);
    },
    onPos(cb) {
      onPosCb = cb;
    },
    sendSnapshot(payload) {
      latestSnapshot = payload;
      void snap.send(payload);
    },
    onSnapshot(cb) {
      onSnapshotCb = cb;
    },
    async enableMic() {
      if (micStream) return true;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
        room.addStream(micStream);
        return true;
      } catch {
        micStream = null;
        return false;
      }
    },
    disableMic() {
      if (!micStream) return;
      try {
        room.removeStream(micStream);
      } catch {
        /* el peer pudo haberse ido */
      }
      micStream.getTracks().forEach((track) => track.stop());
      micStream = null;
    },
    get micOn() {
      return Boolean(micStream);
    },
    leave() {
      onRosterChange = null;
      this.disableMic();
      for (const el of audioEls.values()) el.srcObject = null;
      audioEls.clear();
      void room.leave();
    }
  };
}

// ── Backfill (matchmaking real): salas abiertas reciben randoms ─────────────
// El host publica su sala en el canal global; el que busca toma la primera
// oferta con lugar. Party-first, backfill segundo (ver MULTIPLAYER_DESIGN.md).
const LOBBY_CHANNEL = "salas-abiertas-v1";
const lobbyConfig = { appId: APP_ID, relayConfig: { urls: RELAYS, redundancy: RELAYS.length }, rtcConfig: RTC_CONFIG, turnConfig: TURN_CONFIG };

export function openSalaBackfill(code, getFreeSeats) {
  const lobby = joinRoom(lobbyConfig, LOBBY_CHANNEL);
  const offer = lobby.makeAction("oferta");
  const seek = lobby.makeAction("busco");

  const respond = (target) => {
    const free = getFreeSeats();
    if (free > 0) void offer.send({ code, free }, target ? { target } : undefined);
  };

  seek.onMessage = (_data, context) => respond(context?.peerId);
  lobby.onPeerJoin = (peerId) => respond(peerId);

  return {
    close() {
      void lobby.leave();
    }
  };
}

export function findOpenSala(onFound) {
  const lobby = joinRoom(lobbyConfig, LOBBY_CHANNEL);
  const offer = lobby.makeAction("oferta");
  const seek = lobby.makeAction("busco");
  let done = false;
  let interval = 0;

  offer.onMessage = (data) => {
    if (done || !data || typeof data.code !== "string" || !(data.free > 0)) return;
    done = true;
    window.clearInterval(interval);
    window.setTimeout(() => void lobby.leave(), 600);
    onFound(data.code.toUpperCase());
  };

  const shout = () => void seek.send(1);
  lobby.onPeerJoin = shout;
  interval = window.setInterval(shout, 1600);
  shout();

  return {
    cancel() {
      if (done) return;
      done = true;
      window.clearInterval(interval);
      void lobby.leave();
    }
  };
}

// identidad persistente: sobrevive refresh y crash (base de la reconexión)
export function getPlayerId() {
  let id = localStorage.getItem("trucoloco.playerId");
  if (!id) {
    id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem("trucoloco.playerId", id);
  }
  return id;
}
