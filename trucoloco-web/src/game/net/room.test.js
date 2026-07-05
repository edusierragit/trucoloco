// Tests de la capa de red host-autoritativa: un guest NO debe aceptar
// snapshots forjados por otros guests, ni posiciones corruptas; el host es
// el único que procesa intents. Trystero se mockea para simular los peers.
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── mock de trystero: joinRoom captura las actions y permite inyectar
// mensajes como si vinieran de peers remotos ────────────────────────────────
const actionsByName = new Map();

vi.mock("trystero", () => ({
  selfId: "yo-mismo",
  joinRoom: vi.fn(() => ({
    makeAction: (name) => {
      const action = { name, send: vi.fn(), onMessage: null };
      actionsByName.set(name, action);
      return action;
    },
    onPeerJoin: null,
    onPeerLeave: null,
    onPeerStream: null,
    addStream: vi.fn(),
    removeStream: vi.fn(),
    leave: vi.fn()
  }))
}));

const { createTrucolocoRoom } = await import("./room.js");

// inyecta un mensaje entrante como si lo mandara el peer indicado
const receive = (actionName, data, peerId) => {
  const action = actionsByName.get(actionName);
  action.onMessage?.(data, { peerId });
};

const validSnapshot = () => ({
  state: { scores: { A: 3, B: 1 } },
  selectedRole: "Cartachin"
});

describe("guest: solo acepta snapshots del host", () => {
  let onSnapshot;

  beforeEach(() => {
    actionsByName.clear();
    onSnapshot = vi.fn();
    const room = createTrucolocoRoom("ABCD", { isHost: false, profile: { name: "Guest" } });
    room.onSnapshot(onSnapshot);
    // el host se presenta con hello.isHost — queda fijado como autoridad
    receive("hello", { name: "Host", isHost: true }, "peer-host");
  });

  it("acepta el snapshot del host", () => {
    receive("snap", validSnapshot(), "peer-host");
    expect(onSnapshot).toHaveBeenCalledTimes(1);
  });

  it("ignora un snapshot forjado por otro guest", () => {
    receive("snap", validSnapshot(), "peer-tramposo");
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it("un guest no puede robarse el rol de host despues (primero gana)", () => {
    receive("hello", { name: "Tramposo", isHost: true }, "peer-tramposo");
    receive("snap", validSnapshot(), "peer-tramposo");
    expect(onSnapshot).not.toHaveBeenCalled();
    receive("snap", validSnapshot(), "peer-host");
    expect(onSnapshot).toHaveBeenCalledTimes(1);
  });

  it("ignora snapshots que no son objetos", () => {
    receive("snap", "basura", "peer-host");
    receive("snap", null, "peer-host");
    expect(onSnapshot).not.toHaveBeenCalled();
  });
});

describe("guest: snap que llega antes del hello del host se bufferea", () => {
  it("se entrega recien cuando el remitente queda confirmado como host", () => {
    actionsByName.clear();
    const onSnapshot = vi.fn();
    const room = createTrucolocoRoom("ABCD", { isHost: false, profile: { name: "Guest" } });
    room.onSnapshot(onSnapshot);

    receive("snap", validSnapshot(), "peer-host");
    expect(onSnapshot).not.toHaveBeenCalled();

    receive("hello", { name: "Host", isHost: true }, "peer-host");
    expect(onSnapshot).toHaveBeenCalledTimes(1);
  });
});

describe("posiciones: x/z/yaw deben ser numeros finitos", () => {
  let onPos;

  beforeEach(() => {
    actionsByName.clear();
    onPos = vi.fn();
    const room = createTrucolocoRoom("ABCD", { isHost: true, profile: { name: "Host" } });
    room.onPos(onPos);
  });

  it("acepta una posicion valida", () => {
    receive("pos", { x: 1.5, z: -2, yaw: 0.3 }, "peer-1");
    expect(onPos).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["NaN", { x: NaN, z: 0, yaw: 0 }],
    ["Infinity", { x: 0, z: Infinity, yaw: 0 }],
    ["string", { x: 0, z: 0, yaw: "0.5" }],
    ["faltante", { x: 0, z: 0 }],
    ["null", null]
  ])("rechaza posicion corrupta (%s)", (_label, payload) => {
    receive("pos", payload, "peer-1");
    expect(onPos).not.toHaveBeenCalled();
  });
});

describe("intents: solo el host los procesa y con shape valido", () => {
  it("el host recibe un intent bien formado", () => {
    actionsByName.clear();
    const onIntent = vi.fn();
    const room = createTrucolocoRoom("ABCD", { isHost: true, profile: { name: "Host" } });
    room.onIntent(onIntent);
    receive("intent", { action: "playCard", seatId: "A-cartachin", payload: { handIndex: "x" } }, "peer-1");
    expect(onIntent).toHaveBeenCalledWith("peer-1", expect.objectContaining({ action: "playCard" }));
  });

  it("un guest ignora intents (no es autoridad)", () => {
    actionsByName.clear();
    const onIntent = vi.fn();
    const room = createTrucolocoRoom("ABCD", { isHost: false, profile: { name: "Guest" } });
    room.onIntent(onIntent);
    receive("intent", { action: "playCard", seatId: "A-cartachin" }, "peer-1");
    expect(onIntent).not.toHaveBeenCalled();
  });

  it("el host descarta intents sin action/seatId de string", () => {
    actionsByName.clear();
    const onIntent = vi.fn();
    const room = createTrucolocoRoom("ABCD", { isHost: true, profile: { name: "Host" } });
    room.onIntent(onIntent);
    receive("intent", { action: 42, seatId: "A-cartachin" }, "peer-1");
    receive("intent", { action: "playCard" }, "peer-1");
    receive("intent", "basura", "peer-1");
    expect(onIntent).not.toHaveBeenCalled();
  });
});
