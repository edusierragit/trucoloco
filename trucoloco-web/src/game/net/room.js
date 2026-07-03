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
  "wss://relay.primal.net"
];
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_LIMIT = 6; // trucoloco 3v3: seis sillas, ni una más

export const genRoomCode = () =>
  Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");

export const myPeerId = selfId;

export function createTrucolocoRoom(code, { isHost, profile }) {
  const room = joinRoom({ appId: APP_ID, relayConfig: { urls: RELAYS, redundancy: RELAYS.length } }, `sala-${code}`);
  const hello = room.makeAction("hello");

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
      isHost: Boolean(data.isHost),
      overflow: peers.size + 1 >= ROOM_LIMIT
    });
    emitRoster();
  };

  room.onPeerJoin = (peerId) => {
    void hello.send(myProfile, { target: peerId });
  };

  room.onPeerLeave = (peerId) => {
    peers.delete(peerId);
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
    onRoster(cb) {
      onRosterChange = cb;
      emitRoster();
    },
    leave() {
      onRosterChange = null;
      void room.leave();
    }
  };
}

// ── Backfill (matchmaking real): salas abiertas reciben randoms ─────────────
// El host publica su sala en el canal global; el que busca toma la primera
// oferta con lugar. Party-first, backfill segundo (ver MULTIPLAYER_DESIGN.md).
const LOBBY_CHANNEL = "salas-abiertas-v1";
const lobbyConfig = { appId: APP_ID, relayConfig: { urls: RELAYS, redundancy: RELAYS.length } };

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
