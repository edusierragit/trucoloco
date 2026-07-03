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

// Cola de espera global: dos desconocidos que buscan mesa se emparejan y
// caen juntos en una sala nueva. El de id mayor la crea (es host).
export function findRandomSala(onMatched) {
  const queue = joinRoom({ appId: APP_ID, relayConfig: { urls: RELAYS, redundancy: RELAYS.length } }, "espera-v1");
  const announce = queue.makeAction("busco");
  const invite = queue.makeAction("anda");
  let done = false;
  let interval = 0;

  const finish = (code, isHost) => {
    if (done) return;
    done = true;
    window.clearInterval(interval);
    window.setTimeout(() => void queue.leave(), 800);
    onMatched(code, isHost);
  };

  invite.onMessage = (data) => {
    if (done || !data || typeof data !== "object") return;
    if (data.target === selfId && typeof data.code === "string") finish(data.code, false);
  };

  announce.onMessage = (peerId2, context) => {
    if (done) return;
    const other = String(peerId2 ?? context.peerId);
    // el de id mayor acuña la sala y le pasa el código al otro
    if (selfId > other) {
      const code = genRoomCode();
      void invite.send({ target: other, code });
      finish(code, true);
    }
  };

  const shout = () => void announce.send(selfId);
  queue.onPeerJoin = shout;
  interval = window.setInterval(shout, 1600);
  shout();

  return {
    cancel() {
      if (done) return;
      done = true;
      window.clearInterval(interval);
      void queue.leave();
    }
  };
}
