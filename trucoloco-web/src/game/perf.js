// ─────────────────────────────────────────────────────────────────────────────
// TRUCOLOCO · MOTOR DE CALIDAD ADAPTATIVO
//
// El bug histórico: `getInitialPerformanceProfile()` devolvía SIEMPRE el mismo
// perfil (sombras + bloom + dpr hasta 1.25) y el override `?perf=low` no
// apagaba nada. Resultado: en un monitor 1440p con devicePixelRatio 1.25 el
// antro se rendereaba a ~3200x1800 con PCFSoft + bloom, y en un 1080p @ dpr 1
// a 1920x1080. Misma "buena PC", 2.7x más píxeles. De ahí venía el "en una
// buena PC iba lento y en una normal bien".
//
// Acá hay tres capas:
//   1. DETECCIÓN — adivina un tier de arranque leyendo la GPU real.
//   2. TIERS — presets honestos (bajo apaga cosas de verdad).
//   3. ADAPTACIÓN — PerformanceMonitor baja el dpr y, si sigue sufriendo,
//      degrada el tier solo. Nadie tiene que saber qué es un "dpr".
// ─────────────────────────────────────────────────────────────────────────────

export const QUALITY_ORDER = ["bajo", "medio", "alto", "ultra"];

export const QUALITY_TIERS = {
  bajo: {
    id: "bajo",
    label: "Bajo",
    blurb: "Para notebooks y placas integradas. Sin sombras ni bloom.",
    dprRange: [0.55, 0.85],
    shadows: false,
    postprocessing: false,
    shadowMapSize: 512,
    particleScale: 0.3,
    accents: false,
    contactShadows: false,
    anisotropy: 1,
    antialias: false
  },
  medio: {
    id: "medio",
    label: "Medio",
    blurb: "Equilibrado. Bloom sí, sombras no.",
    dprRange: [0.7, 1],
    shadows: false,
    postprocessing: true,
    shadowMapSize: 512,
    particleScale: 0.6,
    accents: true,
    contactShadows: true,
    anisotropy: 2,
    antialias: true
  },
  alto: {
    id: "alto",
    label: "Alto",
    blurb: "El antro completo: sombras suaves, humo y bloom.",
    dprRange: [0.85, 1],
    shadows: true,
    postprocessing: true,
    shadowMapSize: 1024,
    particleScale: 1,
    accents: true,
    contactShadows: true,
    anisotropy: 4,
    antialias: true
  },
  ultra: {
    id: "ultra",
    label: "Ultra",
    blurb: "Para fierros. Resolución nativa y sombras grandes.",
    dprRange: [1, 1.6],
    shadows: true,
    postprocessing: true,
    shadowMapSize: 2048,
    particleScale: 1,
    accents: true,
    contactShadows: true,
    anisotropy: 8,
    antialias: true
  }
};

const STORAGE_KEY = "trucoloco:quality:v1";

export function clampTier(id) {
  return QUALITY_ORDER.includes(id) ? id : null;
}

export function stepTier(id, delta) {
  const index = QUALITY_ORDER.indexOf(id);
  if (index < 0) return "alto";
  return QUALITY_ORDER[Math.min(QUALITY_ORDER.length - 1, Math.max(0, index + delta))];
}

// Lee el string real de la GPU. Es la única señal honesta que da el navegador:
// `hardwareConcurrency` miente (un i9 con una integrada reporta 24 hilos).
export function readGpuRenderer() {
  if (typeof document === "undefined") return "";
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) return "";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = ext
      ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return String(renderer ?? "");
  } catch {
    return "";
  }
}

// Heurística de arranque. No busca acertar el FPS exacto: busca no arrancar
// en ultra sobre una Intel UHD. El PerformanceMonitor corrige después.
export function detectQualityTier() {
  if (typeof window === "undefined") return "alto";

  const gpu = readGpuRenderer().toLowerCase();
  const cores = navigator.hardwareConcurrency ?? 4;
  const memory = navigator.deviceMemory ?? 8;
  const mobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent ?? "");

  // Renderer por software: WebGL emulado en CPU. Acá no hay nada que salvar.
  if (/swiftshader|llvmpipe|software|basic render|microsoft basic/.test(gpu)) return "bajo";
  if (mobile) return cores >= 8 && memory >= 6 ? "medio" : "bajo";

  let tier = "alto";

  // Integradas: Intel HD/UHD/Iris y las viejas Vega/Radeon Graphics de APU.
  if (/intel|uhd|hd graphics|iris|mesa|vega \d|radeon\(tm\) graphics|apple m1/.test(gpu)) {
    tier = /iris xe|arc|apple m[1-9]/.test(gpu) ? "medio" : "bajo";
  } else if (/rtx (40|50)\d\d|rtx [45]0|rx 7\d\d\d|rx 9\d\d\d/.test(gpu)) {
    tier = "ultra";
  } else if (/rtx|geforce|radeon|quadro|nvidia|amd/.test(gpu)) {
    tier = "alto";
  }

  if (cores <= 4 || memory <= 4) tier = stepTier(tier, -1);

  // Un monitor de alta densidad multiplica los píxeles antes de que la GPU
  // dibuje nada. Es la razón #1 de "buena PC pero va lento".
  if ((window.devicePixelRatio ?? 1) >= 2 && tier === "ultra") tier = "alto";

  return tier;
}

export function readStoredTier() {
  if (typeof window === "undefined") return null;
  try {
    return clampTier(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredTier(tier) {
  if (typeof window === "undefined") return;
  try {
    if (tier) window.localStorage.setItem(STORAGE_KEY, tier);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* modo incógnito: la calidad vive solo en esta sesión */
  }
}

// `?perf=bajo|medio|alto|ultra` (o los viejos low/high) gana sobre todo.
export function readUrlTier() {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("perf");
  if (!raw) return null;
  const legacy = { low: "bajo", high: "alto", med: "medio", mid: "medio", auto: null };
  return clampTier(raw.toLowerCase()) ?? clampTier(legacy[raw.toLowerCase()]);
}

export function resolveInitialTier() {
  return readUrlTier() ?? readStoredTier() ?? detectQualityTier();
}

// El dpr efectivo nunca supera el del dispositivo: subirlo solo quema GPU.
export function resolveDpr(tier, scale = 1) {
  const preset = QUALITY_TIERS[tier] ?? QUALITY_TIERS.alto;
  const device = typeof window === "undefined" ? 1 : window.devicePixelRatio ?? 1;
  const [min, max] = preset.dprRange;
  const ceiling = Math.min(max, Math.max(min, device));
  return Math.max(min, Math.round(ceiling * scale * 100) / 100);
}

export function getProfile(tier) {
  return QUALITY_TIERS[tier] ?? QUALITY_TIERS.alto;
}

// Puente con los componentes viejos, que hablaban de "low" / "high". Todo lo
// que sea bajo o medio usa la geometría reducida: menos segmentos, menos
// props sueltos, menos partículas.
const TIER_INDEX = { bajo: 0, low: 0, medio: 1, alto: 2, high: 2, ultra: 3 };

export function tierIndex(mode) {
  return TIER_INDEX[mode] ?? 2;
}

export function isLowPower(mode) {
  return tierIndex(mode) <= 1;
}
