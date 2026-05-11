const CARD_ASSET_VERSION = "real-deck-3";
const CARD_BACK_IMAGE = "/assets/cards/backs/truco-back.svg";

const card = (id, name, suit, power, tone, lane = "Cartachin", flavor = "", group = "truco") => ({
  id,
  name,
  suit,
  power,
  tone,
  lane,
  flavor,
  group,
  image: group === "truco" ? `/assets/cards/fronts/${id}.svg?v=${CARD_ASSET_VERSION}` : null,
  backImage: CARD_BACK_IMAGE
});

const rankNumbers = {
  Ancho: "1",
  Dos: "2",
  Tres: "3",
  Cuatro: "4",
  Cinco: "5",
  Seis: "6",
  Siete: "7",
  Sota: "10",
  Caballo: "11",
  Rey: "12"
};

const suitCodes = {
  Espada: "ESPADA",
  Basto: "BASTO",
  Oro: "ORO",
  Copa: "COPA",
  "Yu-Gi-Oh": "YGO",
  Trucoloco: "LOCO"
};

export const getCardRankLabel = (card) => card?.name?.split(" de ")[0] ?? "";
export const getCardRankNumber = (card) => rankNumbers[getCardRankLabel(card)] ?? "?";
export const getCardSuitCode = (card) => suitCodes[card?.suit] ?? card?.suit ?? "";

// Jerarquia oficial del truco argentino (valores canonicos)
// 1 espada=14, 1 basto=13, 7 espada=12, 7 oro=11, 3=10, 2=9, 1 oro=8, 1 copa=8, 12=7, 11=6, 10=5, 7 copa/basto=4, 6=3, 5=2, 4=1
export const deck = [
  card("ancho-espada",   "Ancho de Espada",   "Espada", 14, "#d6a24b", "Jugador Estrella", "La carta que te hace pararte de la silla."),
  card("ancho-basto",    "Ancho de Basto",    "Basto",  13, "#7ca85e", "Negociante",       "No luce tanto, pero te acomoda la cara."),
  card("siete-espada",   "Siete de Espada",   "Espada", 12, "#d28c3f", "Jugador Estrella", "Silencio incomodo del rival."),
  card("siete-oro",      "Siete de Oro",      "Oro",    11, "#d89d32", "Negociante",       "Brilla mas de lo que conviene."),
  card("tres-copa",      "Tres de Copa",      "Copa",   10, "#c44b30", "Cartachin",        "Si entra esta, entran todas."),
  card("tres-basto",     "Tres de Basto",     "Basto",  10, "#5f944d", "Negociante",       "Un tablazo con diplomacia."),
  card("tres-espada",    "Tres de Espada",    "Espada", 10, "#c9d2a7", "Jugador Estrella", "Tres filos, una sola intención."),
  card("tres-oro",       "Tres de Oro",       "Oro",    10, "#cc8c22", "Negociante",       "Vale lo mismo que el resto, pero brilla."),
  card("dos-espada",     "Dos de Espada",     "Espada",  9, "#c9d2a7", "Jugador Estrella", "No impresiona, pero manda."),
  card("dos-basto",      "Dos de Basto",      "Basto",   9, "#6a9e55", "Negociante",       "Discreto y sin drama."),
  card("dos-copa",       "Dos de Copa",       "Copa",    9, "#b94040", "Cartachin",        "Entra calladito y cobra."),
  card("dos-oro",        "Dos de Oro",        "Oro",     9, "#cc7d22", "Negociante",       "Mucho metal para tan poca verguenza."),
  card("ancho-oro",      "Ancho de Oro",      "Oro",     8, "#e0b94a", "Negociante",       "El as que no manda, pero infla el pecho."),
  card("ancho-copa",     "Ancho de Copa",     "Copa",    8, "#d45050", "Cartachin",        "Copa sin poder real, pero mucha cara."),
  card("rey-espada",     "Rey de Espada",     "Espada",  7, "#b8c9a2", "Jugador Estrella", "Manda en la foto, no en la vuelta."),
  card("rey-basto",      "Rey de Basto",      "Basto",   7, "#5b8b44", "Negociante",       "Se sienta torcido, pero pega recto."),
  card("rey-copa",       "Rey de Copa",       "Copa",    7, "#c03838", "Cartachin",        "Corona de carton, pulso de acero."),
  card("rey-oro",        "Rey de Oro",        "Oro",     7, "#c9a020", "Negociante",       "Luce, pero no corta."),
  card("caballo-espada", "Caballo de Espada", "Espada",  6, "#a8bfa0", "Jugador Estrella", "Gallopa hacia la derrota con dignidad."),
  card("caballo-basto",  "Caballo de Basto",  "Basto",   6, "#598040", "Negociante",       "Mas palo que caballo."),
  card("caballo-copa",   "Caballo de Copa",   "Copa",    6, "#b83232", "Cartachin",        "Se le nota que no quiere estar aca."),
  card("caballo-oro",    "Caballo de Oro",    "Oro",     6, "#bb7721", "Cartachin",        "Cabalga como si supiera algo."),
  card("sota-espada",    "Sota de Espada",    "Espada",  5, "#9ab08a", "Jugador Estrella", "Sonrie y muerde."),
  card("sota-basto",     "Sota de Basto",     "Basto",   5, "#517836", "Negociante",       "Servicial hasta que no lo es."),
  card("sota-copa",      "Sota de Copa",      "Copa",    5, "#a02c2c", "Cartachin",        "Joven, impulsivo, incobrable."),
  card("sota-oro",       "Sota de Oro",       "Oro",     5, "#b07018", "Negociante",       "Oro barato con cara de caro."),
  card("siete-copa",     "Siete de Copa",     "Copa",    4, "#952828", "Cartachin",        "El 7 que no se festeja."),
  card("siete-basto",    "Siete de Basto",    "Basto",   4, "#4a7030", "Negociante",       "Parece fuerte; no lo es tanto."),
  card("seis-espada",    "Seis de Espada",    "Espada",  3, "#8da880", "Jugador Estrella", "Ni chicha ni limonada."),
  card("seis-basto",     "Seis de Basto",     "Basto",   3, "#496830", "Negociante",       "Discreto hasta el olvido."),
  card("seis-copa",      "Seis de Copa",      "Copa",    3, "#8a2222", "Cartachin",        "Relleno digno."),
  card("seis-oro",       "Seis de Oro",       "Oro",     3, "#a86810", "Negociante",       "Poca plata, mucho ruido."),
  card("cinco-espada",   "Cinco de Espada",   "Espada",  2, "#7c9870", "Jugador Estrella", "El que siempre llega tarde."),
  card("cinco-basto",    "Cinco de Basto",    "Basto",   2, "#406028", "Negociante",       "Rellena sin pena ni gloria."),
  card("cinco-copa",     "Cinco de Copa",     "Copa",    2, "#7a1c1c", "Cartachin",        "Cinco de nada."),
  card("cinco-oro",      "Cinco de Oro",      "Oro",     2, "#966010", "Negociante",       "Muerde polvo con elegancia."),
  card("cuatro-espada",  "Cuatro de Espada",  "Espada",  1, "#6a8860", "Jugador Estrella", "La peor carta con mas orgullo."),
  card("cuatro-basto",   "Cuatro de Basto",   "Basto",   1, "#385820", "Negociante",       "Digno aunque inutil."),
  card("cuatro-copa",    "Cuatro de Copa",    "Copa",    1, "#6a1616", "Cartachin",        "La copa que nadie quiere."),
  card("cuatro-oro",     "Cuatro de Oro",     "Oro",     1, "#845808", "Negociante",       "El fondo del cofre.")
];

// Cartas bonus absurdas — aparecen como excepcion, no como ensalada
// Solo una puede entrar en una mano y tiene que ganarle el lugar a una carta base
export const bonusCards = [
  card("dragon-blanco",   "Dragon Blanco",       "Yu-Gi-Oh",  15, "#d7f2ff", "Jugador Estrella", "Le cae del cielo a Gazpacho y todos se pudren.",            "bonus"),
  card("mago-oscuro",     "Mago Oscuro",          "Yu-Gi-Oh",  12, "#9267cf", "Cartachin",        "Huele a trampa y colonia barata.",                          "bonus"),
  card("kuriboh-quincho", "Kuriboh del Quincho",  "Yu-Gi-Oh",   3, "#7c5b43", "Cartachin",        "Insoportable, pero siempre aparece.",                       "bonus"),
  card("ancho-falso",     "Ancho Falso",          "Trucoloco",  8, "#dd5a28", "Cartachin",        "Asusta de lejos; de cerca da lastima.",                     "bonus"),
  card("el-relator",      "El Relator",           "Trucoloco", 11, "#c46d1a", "Negociante",       "Cuando habla, la mano cambia de dueno.",                    "bonus"),
  card("carta-robada",    "Carta Robada",         "Trucoloco",  7, "#8b3a52", "Jugador Estrella", "Nadie sabe de donde salio, pero esta ahi.",                 "bonus")
];

// Para backward-compat: exportar deck unificado solo con grupos correctos
// (el hook usa deck para truco cards y bonusCards para las de excepcion)
export { bonusCards as bonusDeck };

export const modifiers = [
  {
    id: "modo-clasico",
    title: "Modo Clasico",
    summary: "Truco limpio. Sin rarezas del mazo Trucoloco en la mano base.",
    fx: "clasico"
  },
  {
    id: "sustancia-x",
    title: "Sustancia X",
    summary: "El antro vibra. Si ganas la vuelta, el punto vale doble.",
    fx: "sustancia"
  },
  {
    id: "gafas-legendarias",
    title: "Gafas Legendarias de Edu",
    summary: "Las luces del antro enganan. El rival juega su carta mas floja sin querer.",
    fx: "gafas"
  },
  {
    id: "tiempo-arena",
    title: "Tiempo Arena",
    summary: "La presion sube. Empate cuenta para ambos; victoria suma un punto extra.",
    fx: "arena"
  },
  {
    id: "exodia-bolsillo",
    title: "Exodia de Bolsillo",
    summary: "Si el rival tira Dragon Blanco, Gazpacho lo contrarresta desde la tribuna.",
    fx: "exodia"
  },
  {
    id: "humo-total",
    title: "Humo Total",
    summary: "No se ve nada. Los poderes de todas las cartas bajan 1 punto. El As de Espada no se inmuta.",
    fx: "humo"
  }
];
