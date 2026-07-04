export const MATCH_CONFIG = {
  winningScore: 30,
  humanTeam: "La Banda del Antro",
  rivalTeam: "Los Hijos del Humo",
  defaultRole: "Cartachin",
  // "comun" = truco argentino puro; "trucoloco" = truco + cartas absurdas,
  // armas, poderes de rol y acto de acuerdo entre negociantes
  defaultGameMode: "trucoloco"
};

export const GAME_MODES = {
  comun: {
    id: "comun",
    label: "Truco Común",
    tagline: "El truco de siempre, sin trampas raras. Envido, truco y orgullo."
  },
  trucoloco: {
    id: "trucoloco",
    label: "TRUCOLOCO",
    tagline: "Truco + cartas absurdas, armas, poderes y acuerdos turbios."
  }
};
