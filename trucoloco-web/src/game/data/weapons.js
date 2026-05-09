// Armas — cada una tiene efecto mecanico claro y un costo de uso implicito
// (se consume al activar; no se puede tener dos activas en simultáneo)

export const weapons = [
  {
    id: "parca-utileria",
    name: "Parca de Utileria",
    summary: "Tu proxima carta sube dos lugares en la vuelta que juegues.",
    effectType: "boost_human",
    effectValue: 2,
    tone: "#8b1a1a"
  },
  {
    id: "bocanada-humo",
    name: "Bocanada de Humo",
    summary: "La proxima carta rival entra debilitada en esta vuelta.",
    effectType: "debuff_rival",
    effectValue: 2,
    tone: "#7f6b58"
  }
];

export const weaponPool = weapons;
