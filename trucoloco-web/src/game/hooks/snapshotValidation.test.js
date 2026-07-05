// El snapshot que hidrata a los guests viene de la red: isValidSnapshotState
// es la barrera que impide que un snapshot malformado o malicioso pise el
// estado del match (hydrate() lo consulta antes de setState).
import { describe, expect, it } from "vitest";
import { isValidSnapshotState } from "./useTrucolocoMatch.js";

const validState = () => ({
  handStarted: true,
  handClosed: false,
  handNumber: 2,
  scores: { A: 5, B: 3 },
  trickWins: { A: 1, B: 0 },
  vueltaIndex: 1,
  activeBet: 2,
  tableCards: [],
  trickHistory: [],
  handsBySeat: { "A-cartachin": [], "B-cartachin": [{ id: "x" }] }
});

describe("isValidSnapshotState", () => {
  it("acepta un estado bien formado", () => {
    expect(isValidSnapshotState(validState())).toBe(true);
  });

  it.each([
    ["null", null],
    ["string", "basura"],
    ["array", []],
    ["objeto vacio", {}]
  ])("rechaza %s", (_label, state) => {
    expect(isValidSnapshotState(state)).toBe(false);
  });

  it("rechaza scores no numericos (romperia getMatchWinner)", () => {
    const state = validState();
    state.scores = { A: "30", B: 3 };
    expect(isValidSnapshotState(state)).toBe(false);
  });

  it("rechaza scores NaN", () => {
    const state = validState();
    state.scores = { A: NaN, B: 3 };
    expect(isValidSnapshotState(state)).toBe(false);
  });

  it("rechaza handNumber invalido", () => {
    const state = validState();
    state.handNumber = 0;
    expect(isValidSnapshotState(state)).toBe(false);
  });

  it("rechaza handsBySeat que no es objeto de arrays", () => {
    const corrupt = validState();
    corrupt.handsBySeat = { "A-cartachin": "no-es-mano" };
    expect(isValidSnapshotState(corrupt)).toBe(false);

    const asArray = validState();
    asArray.handsBySeat = [];
    expect(isValidSnapshotState(asArray)).toBe(false);
  });

  it("rechaza tableCards/trickHistory que no son arrays", () => {
    const state = validState();
    state.tableCards = {};
    expect(isValidSnapshotState(state)).toBe(false);
  });

  it("rechaza flags de mano que no son booleanos", () => {
    const state = validState();
    state.handStarted = "si";
    expect(isValidSnapshotState(state)).toBe(false);
  });
});
