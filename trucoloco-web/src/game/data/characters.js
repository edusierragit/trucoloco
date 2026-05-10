export const roleOptions = ["Negociante", "Jugador Estrella", "Cartachin"];

export const characterSkins = {
  "irvyn-negociante-glb": {
    modelSrc: "/assets/characters/irvyn.glb",
    modelScale: 1,
    modelPosition: [0, 0.02, 0],
    modelRotation: [0, 0, 0],
    modelTargetHeight: 1.72,
    modelPromptKey: "irvyn",
    chairSeatColor: "#241711",
    chairBackColor: "#1f1410"
  },
  "marvyn-negociante-glb": {
    modelSrc: "/assets/characters/marvyn.glb",
    modelScale: 1.04,
    modelPosition: [0, 0.03, -0.02],
    modelRotation: [0, 0, 0],
    modelTargetHeight: 1.78,
    modelPromptKey: "marvyn",
    chairSeatColor: "#20353a",
    chairBackColor: "#17272b"
  },
  "pochex-cartachin-glb": {
    modelSrc: "/assets/characters/pocho.glb",
    modelScale: 0.9,
    modelPosition: [0, 0.02, 0.04],
    modelRotation: [0, 0, 0],
    modelTargetHeight: 1.72,
    modelPromptKey: "pochex",
    chairSeatColor: "#241711",
    chairBackColor: "#1f1410"
  },
  "pol-cartachin-glb": {
    modelSrc: "/assets/characters/pol-arabe.glb",
    modelScale: 1,
    modelPosition: [0, 0.02, 0],
    modelRotation: [0, 0, 0],
    modelTargetHeight: 1.72,
    modelPromptKey: "pol",
    chairSeatColor: "#172217",
    chairBackColor: "#121a12"
  },
  "negociante-primer-skin": {
    modelKind: "negociante",
    modelPromptKey: "negociante",
    outfitColor: "#2f221d",
    shirtColor: "#161311",
    skinColor: "#c89774",
    beardColor: "#5b341f",
    accessoryColor: "#d8dce3",
    chairSeatColor: "#241711",
    chairBackColor: "#1f1410"
  },
  "gazpacho-star-skin": {
    modelKind: "gazpacho",
    modelPromptKey: "gazpacho",
    outfitColor: "#493228",
    shirtColor: "#5c554e",
    skinColor: "#b57a56",
    beardColor: "#34231a",
    hairColor: "#3a2418",
    accessoryColor: "#151515",
    chairSeatColor: "#28150f",
    chairBackColor: "#22120c"
  },
  "myke-keta-star-skin": {
    modelKind: "gazpacho",
    modelPromptKey: "myke-keta",
    outfitColor: "#242238",
    shirtColor: "#171622",
    skinColor: "#a96f4e",
    beardColor: "#2a1a14",
    hairColor: "#1a1415",
    accessoryColor: "#10151d",
    chairSeatColor: "#151823",
    chairBackColor: "#11141c"
  },
  "cartachin-norte-skin": {
    modelKind: "cartachin",
    modelPromptKey: "cartachin-norte",
    outfitColor: "#233529",
    shirtColor: "#151f18",
    skinColor: "#c18a64",
    beardColor: "#3a2418",
    accessoryColor: "#d0a15d",
    ponchoColor: "#355a3f",
    chairSeatColor: "#172217",
    chairBackColor: "#121a12"
  }
};

export const roleDefinitions = {
  Negociante: {
    title: "Negociante",
    summary: "Negocia los puntos de la mano. A veces salva a su equipo y a veces lo manda al muere.",
    powerName: "Negociar puntos",
    powerSummary: "Antes de la primera carta, los dos negociantes tiran un dado. Si suman 8 o mas, la mano se cobra al reves."
  },
  "Jugador Estrella": {
    title: "Jugador Estrella",
    summary: "Es el atrevido del antro. En este slice juega mano clasica, pero ya fija el tono del duelo.",
    powerName: "Atrevida total",
    powerSummary: "Por ahora no agrega una regla nueva. Este rol gana personalidad con sus cartas, frases y presencia."
  },
  Cartachin: {
    title: "Cartachin",
    summary: "Carga armas antes de arrancar y mete mugre fina cuando la mano pide trampa prolija.",
    powerName: "Mazo de armas",
    powerSummary: "Solo Cartachin puede cargar un arma al abrir la mano."
  }
};

export const teams = {
  A: [
    {
      id: "irvyn",
      name: "Irvyn",
      role: "Negociante",
      quote: "Si no se arregla charlando, se arregla cobrando.",
      accent: "#d9b36c",
      skinId: "irvyn-negociante-glb"
    },
    {
      id: "gazpacho",
      name: "Gazpacho",
      role: "Jugador Estrella",
      quote: "El As es mio por derecho divino.",
      accent: "#f0872d",
      skinId: "gazpacho-star-skin"
    },
    {
      id: "cartachin-sur",
      name: "Pochex",
      role: "Cartachin",
      quote: "No es suerte. Es mugre bien administrada.",
      accent: "#b4472d",
      skinId: "pochex-cartachin-glb"
    }
  ],
  B: [
    {
      id: "marvyn",
      name: "Marvyn",
      role: "Negociante",
      quote: "Todo se negocia, hasta la verguenza.",
      accent: "#a6eef0",
      skinId: "marvyn-negociante-glb"
    },
    {
      id: "myke-keta",
      name: "Myke Keta",
      role: "Jugador Estrella",
      quote: "Si me das un hueco, te vacio la noche.",
      accent: "#5c7fc0",
      skinId: "myke-keta-star-skin"
    },
    {
      id: "cartachin-norte",
      name: "Pol",
      role: "Cartachin",
      quote: "Siempre hay una carta pegada al forro del saco.",
      accent: "#59a06e",
      skinId: "pol-cartachin-glb"
    }
  ]
};

export const characterOptionsByRole = roleOptions.reduce((options, role) => {
  options[role] = [...teams.A, ...teams.B].filter((player) => player.role === role);
  return options;
}, {});

export const tableSeats = [
  {
    seatId: "A-negociante",
    team: "A",
    playerId: "irvyn",
    role: "Negociante",
    label: "Esquina Sur",
    tableOrder: 0,
    oppositeSeatId: "B-negociante",
    position: [-2.8, 0, -1.7]
  },
  {
    seatId: "B-negociante",
    team: "B",
    playerId: "marvyn",
    role: "Negociante",
    label: "Esquina Norte",
    tableOrder: 1,
    oppositeSeatId: "A-negociante",
    position: [2.8, 0, -1.7]
  },
  {
    seatId: "A-estrella",
    team: "A",
    playerId: "gazpacho",
    role: "Jugador Estrella",
    label: "Medio Sur",
    tableOrder: 2,
    oppositeSeatId: "B-estrella",
    position: [-3.6, 0, 1.6]
  },
  {
    seatId: "B-estrella",
    team: "B",
    playerId: "myke-keta",
    role: "Jugador Estrella",
    label: "Medio Norte",
    tableOrder: 3,
    oppositeSeatId: "A-estrella",
    position: [3.5, 0, 1.55]
  },
  {
    seatId: "A-cartachin",
    team: "A",
    playerId: "cartachin-sur",
    role: "Cartachin",
    label: "Punta Sur",
    tableOrder: 4,
    oppositeSeatId: "B-cartachin",
    position: [0, 0, -3.3]
  },
  {
    seatId: "B-cartachin",
    team: "B",
    playerId: "cartachin-norte",
    role: "Cartachin",
    label: "Punta Norte",
    tableOrder: 5,
    oppositeSeatId: "A-cartachin",
    position: [0, 0, 3.3]
  }
];
