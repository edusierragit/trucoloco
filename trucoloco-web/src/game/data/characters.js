import { assetUrl } from "../assetUrl.js";
export const roleOptions = ["Negociante", "Jugador Estrella", "Cartachin"];

export const characterSkins = {
  "irvyn-negociante-glb": {
    modelSrc: assetUrl("assets/characters/irvyn.glb"),
    modelScale: 1,
    modelPosition: [0, 0.02, 0],
    modelRotation: [0, 0, 0],
    modelTargetHeight: 1.72,
    modelPromptKey: "irvyn",
    walkFacingOffset: -Math.PI / 2,
    animationClipMap: {
      idle: null,
      walk: "NlaTrack.004",
      run: "NlaTrack.002",
      box: "NlaTrack.006",
      jump: "NlaTrack.001"
    },
    animationTimeScaleMap: {
      walk: 0.72,
      run: 0.98,
      box: 1,
      jump: 1
    },
    chairSeatColor: "#241711",
    chairBackColor: "#1f1410"
  },
  "marvyn-negociante-glb": {
    modelSrc: assetUrl("assets/characters/marvyn.glb"),
    modelScale: 1.04,
    modelPosition: [0, 0.03, -0.02],
    modelRotation: [0, 0, 0],
    modelTargetHeight: 1.78,
    modelPromptKey: "marvyn",
    walkFacingOffset: -Math.PI / 2,
    animationClipMap: {
      idle: null,
      walk: "NlaTrack.007",
      run: "NlaTrack",
      box: "NlaTrack.002",
      jump: "NlaTrack.005"
    },
    animationTimeScaleMap: {
      walk: 0.76,
      run: 0.98,
      box: 1,
      jump: 1
    },
    chairSeatColor: "#20353a",
    chairBackColor: "#17272b"
  },
  "pochex-cartachin-glb": {
    modelSrc: assetUrl("assets/characters/pocho.glb"),
    modelScale: 0.9,
    modelPosition: [0, 0.02, 0.04],
    modelRotation: [0, 0, 0],
    modelTargetHeight: 1.72,
    modelPromptKey: "pochex",
    walkFacingOffset: -Math.PI / 2,
    animationClipMap: {
      idle: null,
      walk: "NlaTrack.003",
      run: "NlaTrack.002",
      box: "NlaTrack.001",
      jump: "NlaTrack.004"
    },
    animationTimeScaleMap: {
      walk: 0.76,
      run: 0.98,
      box: 1,
      jump: 1
    },
    chairSeatColor: "#241711",
    chairBackColor: "#1f1410"
  },
  "cubano-cartachin-glb": {
    modelSrc: assetUrl("assets/characters/cubano.glb"),
    modelScale: 1,
    modelPosition: [0, 0.02, 0],
    modelRotation: [0, 0, 0],
    modelTargetHeight: 1.72,
    modelPromptKey: "cubano",
    walkFacingOffset: -Math.PI / 2,
    animationClipMap: {
      idle: null,
      walk: "NlaTrack.004",
      run: "NlaTrack.001",
      box: "NlaTrack",
      jump: "NlaTrack.003"
    },
    animationTimeScaleMap: {
      walk: 0.76,
      run: 0.98,
      box: 1,
      jump: 1
    },
    chairSeatColor: "#2a1c14",
    chairBackColor: "#1f1510"
  },
  "pol-cartachin-glb": {
    modelSrc: assetUrl("assets/characters/pol.glb"),
    modelScale: 1,
    modelPosition: [0, 0.02, 0],
    modelRotation: [0, 0, 0],
    modelTargetHeight: 1.72,
    modelPromptKey: "pol",
    walkFacingOffset: -Math.PI / 2,
    animationClipMap: {
      idle: null,
      walk: "NlaTrack.003",
      run: "NlaTrack.001",
      box: "NlaTrack.004",
      jump: "NlaTrack.002"
    },
    animationTimeScaleMap: {
      walk: 0.76,
      run: 0.98,
      box: 1,
      jump: 1
    },
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
    modelSrc: assetUrl("assets/characters/gazpacho.glb"),
    modelScale: 1,
    modelPosition: [0, 0.02, 0],
    modelRotation: [0, 0, 0],
    modelTargetHeight: 1.74,
    modelPromptKey: "gazpacho",
    walkFacingOffset: -Math.PI / 2,
    animationClipMap: {
      idle: null,
      walk: "NlaTrack.001",
      run: "NlaTrack.003",
      box: "NlaTrack",
      jump: "NlaTrack.004"
    },
    animationTimeScaleMap: {
      walk: 0.76,
      run: 0.98,
      box: 1,
      jump: 1
    },
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
    modelSrc: assetUrl("assets/characters/myketa.glb"),
    modelScale: 1,
    modelPosition: [0, 0.02, 0],
    modelRotation: [0, 0, 0],
    modelTargetHeight: 1.74,
    modelPromptKey: "myke-keta",
    walkFacingOffset: -Math.PI / 2,
    animationClipMap: {
      idle: null,
      walk: "NlaTrack.002",
      run: "NlaTrack.005",
      box: "NlaTrack",
      jump: "NlaTrack.004"
    },
    animationTimeScaleMap: {
      walk: 0.76,
      run: 0.98,
      box: 1,
      jump: 1
    },
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
    summary: "Puntos y riesgo.",
    powerName: "Negociar puntos",
    powerSummary: "8+ invierte el cobro."
  },
  "Jugador Estrella": {
    title: "Jugador Estrella",
    summary: "Mano clasica.",
    powerName: "Atrevida total",
    powerSummary: "Sin regla extra."
  },
  Cartachin: {
    title: "Cartachin",
    summary: "Armas de apertura.",
    powerName: "Mazo de armas",
    powerSummary: "Arma antes de la primera carta."
  }
};

export const teams = {
  A: [
    {
      id: "irvyn",
      name: "Irvyn",
      role: "Negociante",
      accent: "#d9b36c",
      skinId: "irvyn-negociante-glb"
    },
    {
      id: "gazpacho",
      name: "Gazpacho",
      role: "Jugador Estrella",
      accent: "#f0872d",
      skinId: "gazpacho-star-skin"
    },
    {
      id: "cartachin-sur",
      name: "Pochex",
      role: "Cartachin",
      accent: "#b4472d",
      skinId: "pochex-cartachin-glb"
    },
    {
      id: "cubano",
      name: "Cubano",
      role: "Cartachin",
      accent: "#d7a45d",
      skinId: "cubano-cartachin-glb"
    }
  ],
  B: [
    {
      id: "marvyn",
      name: "Marvyn",
      role: "Negociante",
      accent: "#a6eef0",
      skinId: "marvyn-negociante-glb"
    },
    {
      id: "myke-keta",
      name: "Myke Keta",
      role: "Jugador Estrella",
      accent: "#5c7fc0",
      skinId: "myke-keta-star-skin"
    },
    {
      id: "cartachin-norte",
      name: "Pol",
      role: "Cartachin",
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
  // [VISUAL] Seat anchors form a tighter oval so characters read as seated around one mesa, not scattered in the room.
  {
    seatId: "A-negociante",
    team: "A",
    playerId: "irvyn",
    role: "Negociante",
    label: "Esquina Sur",
    tableOrder: 0,
    oppositeSeatId: "B-negociante",
    position: [-2.62, 0, -1.78]
  },
  {
    seatId: "B-negociante",
    team: "B",
    playerId: "marvyn",
    role: "Negociante",
    label: "Esquina Norte",
    tableOrder: 1,
    oppositeSeatId: "A-negociante",
    position: [2.62, 0, -1.78]
  },
  {
    seatId: "A-estrella",
    team: "A",
    playerId: "gazpacho",
    role: "Jugador Estrella",
    label: "Medio Sur",
    tableOrder: 2,
    oppositeSeatId: "B-estrella",
    position: [-3.12, 0, 1.42]
  },
  {
    seatId: "B-estrella",
    team: "B",
    playerId: "myke-keta",
    role: "Jugador Estrella",
    label: "Medio Norte",
    tableOrder: 3,
    oppositeSeatId: "A-estrella",
    position: [3.12, 0, 1.42]
  },
  {
    seatId: "A-cartachin",
    team: "A",
    playerId: "cartachin-sur",
    role: "Cartachin",
    label: "Punta Sur",
    tableOrder: 4,
    oppositeSeatId: "B-cartachin",
    position: [0, 0, -3.18]
  },
  {
    seatId: "B-cartachin",
    team: "B",
    playerId: "cartachin-norte",
    role: "Cartachin",
    label: "Punta Norte",
    tableOrder: 5,
    oppositeSeatId: "A-cartachin",
    position: [0, 0, 3.18]
  }
];
