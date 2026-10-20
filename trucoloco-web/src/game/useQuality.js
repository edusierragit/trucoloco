import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  QUALITY_ORDER,
  getProfile,
  readUrlTier,
  resolveDpr,
  resolveInitialTier,
  stepTier,
  writeStoredTier
} from "./perf.js";

// FPS medido: store externo y mínimo. Antes vivía en el estado de useQuality y
// re-renderizaba la App entera una vez por segundo (y con ella reiniciaba
// todos los timers de la mesa). Ahora solo se repinta el chip que lo muestra.
let fpsValue = 60;
const fpsListeners = new Set();
const reportFps = (value) => {
  if (value === fpsValue) return;
  fpsValue = value;
  fpsListeners.forEach((listener) => listener());
};
const subscribeFps = (listener) => {
  fpsListeners.add(listener);
  return () => fpsListeners.delete(listener);
};
const getFps = () => fpsValue;

export function useFps() {
  return useSyncExternalStore(subscribeFps, getFps, getFps);
}

// Estado de calidad de la sesión. Vive fuera del render loop: el Canvas solo
// lee `dpr` / `shadows` / `postprocessing` y React re-renderiza cuando el
// jugador (o el watchdog) cambia el tier. Nada de esto corre por frame.
export function useQuality() {
  const [tier, setTierState] = useState(() => resolveInitialTier());
  // escala fina de resolución: el watchdog la mueve ANTES de degradar el tier,
  // porque bajar píxeles es invisible y apagar sombras se nota.
  const [dprScale, setDprScale] = useState(1);
  const [auto, setAuto] = useState(() => readUrlTier() === null);
  const lockedRef = useRef(false);

  const setTier = useCallback((next, { manual = true } = {}) => {
    setTierState((current) => {
      if (current === next) return current;
      if (manual) {
        writeStoredTier(next);
        lockedRef.current = true;
        setAuto(false);
      }
      setDprScale(1);
      return next;
    });
  }, []);

  // El watchdog solo puede BAJAR. Subir solo tras un cambio manual evita el
  // ping-pong clásico (sube, cae el fps, baja, sube…) que se ve como tirones.
  const degrade = useCallback(() => {
    if (lockedRef.current) return;
    setDprScale((scale) => {
      if (scale > 0.72) return Math.round(scale * 0.85 * 100) / 100;
      setTierState((current) => stepTier(current, -1));
      return 1;
    });
  }, []);

  const profile = useMemo(() => getProfile(tier), [tier]);
  const dpr = useMemo(() => resolveDpr(tier, dprScale), [tier, dprScale]);

  return useMemo(
    () => ({
      tier,
      tiers: QUALITY_ORDER,
      profile,
      dpr,
      dprScale,
      auto,
      setTier,
      setAuto,
      reportFps,
      degrade
    }),
    [tier, profile, dpr, dprScale, auto, setTier, degrade]
  );
}

// Watchdog de frames. Va DENTRO del Canvas (necesita el render loop) y no
// dispara re-renders: acumula en refs y solo avisa una vez por segundo.
export function useFrameWatchdog({ onFps, onDegrade, enabled = true }) {
  const framesRef = useRef(0);
  const windowStartRef = useRef(0);
  const badWindowsRef = useRef(0);

  useEffect(() => {
    if (!enabled) return undefined;
    framesRef.current = 0;
    windowStartRef.current = 0;
    badWindowsRef.current = 0;
    return undefined;
  }, [enabled]);

  return useCallback(
    (elapsed) => {
      if (!enabled) return;
      if (!windowStartRef.current) {
        windowStartRef.current = elapsed;
        return;
      }
      framesRef.current += 1;
      const span = elapsed - windowStartRef.current;
      if (span < 1) return;

      const measured = framesRef.current / span;
      framesRef.current = 0;
      windowStartRef.current = elapsed;
      onFps?.(Math.round(measured));

      // Menos de 10 fps no es la GPU: es el navegador estrangulando una
      // pestaña en segundo plano. Degradar ahí deja el antro pixelado para
      // siempre cuando el jugador vuelve.
      if (measured < 10 || (typeof document !== "undefined" && document.hidden)) {
        badWindowsRef.current = 0;
        return;
      }

      // Dos segundos seguidos por debajo de 45 fps = la máquina no da.
      // Un solo bache (cargar un GLB, abrir un panel) no degrada nada.
      if (measured < 45) {
        badWindowsRef.current += 1;
        if (badWindowsRef.current >= 2) {
          badWindowsRef.current = 0;
          onDegrade?.();
        }
      } else if (measured > 55) {
        badWindowsRef.current = 0;
      }
    },
    [enabled, onDegrade, onFps]
  );
}
