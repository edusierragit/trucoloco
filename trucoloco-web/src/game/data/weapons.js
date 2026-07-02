// Armas — cada una tiene efecto mecanico claro y un costo de uso implicito
// (se consume al activar; no se puede tener dos activas en simultáneo)
// Los ids NO se tocan: rules/truco.js y validate-truco-rules.mjs dependen de ellos.

export const weapons = [
  {
    id: "parca-utileria",
    name: "Sustancia X en el Naipe",
    summary: "Untás tu próxima carta. +2 de poder.",
    effectType: "boost_human",
    effectValue: 2,
    tone: "#8b1a1a"
  },
  {
    id: "bocanada-humo",
    name: "Pucho en el Ojo",
    summary: "Humo directo al rival. −2 a su próxima.",
    effectType: "debuff_rival",
    effectValue: 2,
    tone: "#7f6b58"
  }
];

export const weaponPool = weapons;
