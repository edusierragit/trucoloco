// Salas por RELAY (MQTT sobre WSS a brokers públicos) — el transporte que
// FUNCIONA SIEMPRE. El P2P puro (trystero/WebRTC) moría en el mundo real:
// CGNAT de los ISP argentinos + todos los TURN gratis muertos + Brave
// bloqueando WebRTC. MQTT sobre WSS pasa como tráfico web normal.
// Misma interfaz que createTrucolocoRoom (room.js) — App no distingue.
// Sin voz en este modo (la voz necesita WebRTC; vendrá como capa aparte).
import mqtt from "mqtt";

const BROKERS = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://test.mosquitto.org:8081"
];

const HEARTBEAT_MS = 3500;
const PEER_TTL_MS = 12000;

const randomId = () =>
  Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);

export function createRelayRoom(code, { isHost, profile }) {
  const myPeerId = randomId();
  const base = `trucoloco/v1/${code}`;
  const topics = { presence: `${base}/p`, msg: `${base}/m` };

  let myProfile = { ...profile, isHost };
  let onRosterChange = null;
  let onSnapshotCb = null;
  let onPosCb = null;
  let onIntentCb = null;
  let latestSnapshot = null;
  let closed = false;
  void closed;

  // peerId -> { ...profile, lastSeen }
  const peers = new Map();

  const emitRoster = () => {
    if (!onRosterChange) return;
    const roster = [
      { peerId: myPeerId, ...myProfile, self: true },
      ...[...peers.entries()].map(([peerId, data]) => {
        const { lastSeen, ...rest } = data;
        return { peerId, ...rest, self: false };
      })
    ];
    onRosterChange(roster);
  };

  const clients = [];
  let midSeq = 0;
  let lastPosAt = 0;
  const publish = (topic, payload) => {
    const body = JSON.stringify({ ...payload, mid: `${myPeerId}-${midSeq++}` });
    for (const c of clients) {
      if (c.connected) c.publish(topic, body, { qos: 0 });
    }
  };

  const sendPresence = () => publish(topics.presence, { peerId: myPeerId, profile: myProfile, at: Date.now() });

  const sendMsg = (t, d, to = null) => publish(topics.msg, { t, d, to, from: myPeerId });

  // MESH de brokers: conectamos a TODOS a la vez y publicamos en todos.
  // Con que dos jugadores compartan UN broker vivo, se ven. (El fallback
  // secuencial repartía a los jugadores en brokers distintos: nunca se veían.)
  const seenMids = new Set();
  const seenOrder = [];
  const dedupe = (mid) => {
    if (!mid || seenMids.has(mid)) return true;
    seenMids.add(mid);
    seenOrder.push(mid);
    if (seenOrder.length > 600) seenMids.delete(seenOrder.shift());
    return false;
  };

  const handleMessage = (_topic, raw) => {
    let data = null;
    try {
      // en el browser el payload llega como Uint8Array: TextDecoder siempre
      const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
      data = JSON.parse(text);
    } catch {
      return;
    }
    if (!data || dedupe(data.mid)) return;

    if (data.peerId && data.profile) {
      if (data.peerId === myPeerId) return;
      const isNew = !peers.has(data.peerId);
      peers.set(data.peerId, { ...data.profile, lastSeen: Date.now() });
      if (isNew) {
        // que el nuevo nos vea YA (sin esperar heartbeat) y reciba la mesa
        sendPresence();
        if (isHost && latestSnapshot) sendMsg("snap", latestSnapshot, data.peerId);
      }
      emitRoster();
      return;
    }

    if (data.from === myPeerId) return;
    if (data.to && data.to !== myPeerId) return;
    if (data.t === "snap") onSnapshotCb?.(data.d);
    else if (data.t === "pos") onPosCb?.(data.from, data.d);
    else if (data.t === "intent" && data.d && typeof data.d.action === "string") onIntentCb?.(data.from, data.d);
    else if (data.t === "bye") {
      peers.delete(data.from);
      emitRoster();
    }
  };

  for (const url of BROKERS) {
    const c = mqtt.connect(url, {
      clientId: `tl-${myPeerId}-${clients.length}`,
      clean: true,
      connectTimeout: 7000,
      reconnectPeriod: 4000,
      keepalive: 30
    });
    c.on("connect", () => {
      c.subscribe([topics.presence, topics.msg], { qos: 0 });
      sendPresence();
    });
    c.on("message", handleMessage);
    c.on("error", () => {});
    clients.push(c);
  }

  const heartbeat = window.setInterval(() => {
    sendPresence();
    // GC de fantasmas
    let changed = false;
    const now = Date.now();
    for (const [peerId, data] of peers) {
      if (now - data.lastSeen > PEER_TTL_MS) {
        peers.delete(peerId);
        changed = true;
      }
    }
    if (changed) emitRoster();
  }, HEARTBEAT_MS);

  return {
    code,
    isHost,
    transport: "relay",
    get peerCount() {
      return peers.size + 1;
    },
    updateProfile(next) {
      myProfile = { ...myProfile, ...next };
      sendPresence();
      emitRoster();
    },
    sendIntent(action, payload = null) {
      sendMsg("intent", { action, payload, at: Date.now() });
    },
    onIntent(cb) {
      onIntentCb = cb;
    },
    onRoster(cb) {
      onRosterChange = cb;
      emitRoster();
    },
    sendPos(payload) {
      const now = Date.now();
      if (now - lastPosAt < 95) return;
      lastPosAt = now;
      sendMsg("pos", payload);
    },
    onPos(cb) {
      onPosCb = cb;
    },
    sendSnapshot(payload) {
      latestSnapshot = payload;
      sendMsg("snap", payload);
    },
    onSnapshot(cb) {
      onSnapshotCb = cb;
    },
    // la voz necesita WebRTC de verdad; en modo relay todavía no hay
    async enableMic() {
      return false;
    },
    disableMic() {},
    get micOn() {
      return false;
    },
    leave() {
      closed = true;
      onRosterChange = null;
      window.clearInterval(heartbeat);
      sendMsg("bye", null);
      for (const c of clients) {
        try {
          c.end(true);
        } catch {
          /* ya cerrado */
        }
      }
      clients.length = 0;
    }
  };
}
