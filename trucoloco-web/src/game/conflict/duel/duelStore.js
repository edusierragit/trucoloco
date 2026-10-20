import { useSyncExternalStore } from "react";
import { createDuel, duelReducer } from "./duelEngine.js";

// Store propio, fuera de App: el overlay y el escenario 3D se suscriben con
// selectores y SOLO ellos se re-renderizan (unas pocas veces por ronda). La
// lección del ring viejo: un setState en App por frame hundía todo a 10 fps.
function createDuelStore() {
  let state = null;
  const listeners = new Set();
  const emit = () => listeners.forEach((listener) => listener());

  return {
    get: () => state,
    start(options) {
      state = createDuel(options);
      emit();
    },
    dispatch(action) {
      const next = duelReducer(state, action);
      if (next === state) return false;
      state = next;
      emit();
      return true;
    },
    clear() {
      state = null;
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

export const duelStore = createDuelStore();

const identity = (value) => value;

export function useDuel(selector = identity) {
  return useSyncExternalStore(
    duelStore.subscribe,
    () => selector(duelStore.get()),
    () => selector(null)
  );
}
