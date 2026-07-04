// Vista de match para GUESTS (multiplayer host-autoritativo).
//
// El guest hidrata el estado del host tal cual (espejo), pero su HUD y su
// mano 3D no deben mostrar la perspectiva del host: este proxy envuelve el
// match hidratado con la MISMA interfaz del hook y deriva la vista de la
// silla que el guest reclamó en la sala:
//   - humanHand pasa a ser la mano de SU silla
//   - los gates (canPlayCard, canCallEnvido, canCallTruco...) se recalculan
//     para su turno — son solo UX: el host revalida cada intent igual
//   - las acciones no mutan nada local: mandan un intent al host y la mesa
//     se actualiza cuando vuelve el snapshot
// Poderes de rol (armas, negociación, acuerdo) siguen siendo del host en
// esta versión: quedan deshabilitados para el guest.
import { tableSeats } from "../data/characters";

const noop = () => {};

const TRUCO_LABEL_BY_BET = { 1: "Truco", 2: "Retruco", 3: "Vale cuatro" };

export function buildGuestMatchView(match, seatId, sendIntent) {
  const spectator = {
    ...match,
    // espectador puro: cero acciones locales — manda el host
    canPlayCard: false,
    canUseWeapon: false,
    canCallEnvido: false,
    canCallTruco: false,
    canAdvance: false,
    canUseRolePower: false,
    canRespondTruco: false,
    canRaiseTrucoResponse: false,
    canSwitchRole: false,
    advanceLabel: null,
    playCard: noop,
    useWeapon: noop,
    negotiatePoints: noop,
    callEnvido: noop,
    settleEnvido: noop,
    callTruco: noop,
    acceptTruco: noop,
    rejectTruco: noop,
    raiseTrucoResponse: noop,
    startHand: noop,
    revealRivalLead: noop,
    clearTrick: noop,
    startNextHand: noop,
    applyAgreement: noop,
    restartMatch: noop,
    advance: noop,
    nextHand: noop
  };

  const seat = tableSeats.find((item) => item.seatId === seatId) ?? null;
  if (!seat) return spectator;

  const myTeam = seat.team;
  const myHand = match.handsBySeat?.[seatId] ?? [];
  const myTurn =
    match.handStarted &&
    !match.handClosed &&
    !match.envidoPending &&
    !match.trucoPending &&
    match.currentTurnSeatId === seatId &&
    match.tableCards.length < tableSeats.length;
  const firstCardWindow =
    myTurn && match.vueltaIndex === 0 && match.tableCards.length === 0 && match.trickHistory.length === 0;
  const canRaise = !match.trucoRaiseOwner || match.trucoRaiseOwner === myTeam;
  const pendingForMe = Boolean(match.trucoPending && match.trucoPending.target === myTeam && !match.handClosed);

  return {
    ...spectator,
    // la cámara del guest se sienta en SU silla (ver getOwnSeat en la escena)
    ownSeatId: seatId,
    humanHand: myHand,
    canPlayCard: myTurn,
    playCard: (handIndex) => sendIntent("playCard", { handIndex }),
    canCallEnvido: firstCardWindow && !match.envidoResolved && match.activeBet === 1,
    callEnvido: () => sendIntent("callEnvido", {}),
    canCallTruco: myTurn && canRaise && Boolean(TRUCO_LABEL_BY_BET[match.activeBet]),
    trucoCallLabel: TRUCO_LABEL_BY_BET[match.activeBet] ?? "Truco",
    callTruco: () => sendIntent("callTruco", {}),
    canRespondTruco: pendingForMe,
    acceptTruco: () => sendIntent("acceptTruco", {}),
    rejectTruco: () => sendIntent("rejectTruco", {})
  };
}
