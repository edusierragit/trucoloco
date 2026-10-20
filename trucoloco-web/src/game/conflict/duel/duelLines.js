// ─────────────────────────────────────────────────────────────────────────────
// DUELO DE BARDO · el repertorio
//
// Cada bardo tiene UN remate que lo contesta de verdad (se engancha de una
// palabra o de la lógica del insulto). Los otros remates, puestos como
// señuelo, suenan bien pero no responden a ESE bardo. Se aprenden jugando:
// la primera vez adivinás leyendo fino, después te los sabés de memoria.
// ─────────────────────────────────────────────────────────────────────────────

export const BARDOS = [
  {
    id: "falta-envido",
    bardo: "Te vi cantar falta envido con un cuatro de mano.",
    remate: "Y aun así te gané, que tenías treinta y tres y te fuiste al mazo."
  },
  {
    id: "gafas",
    bardo: "Tus gafas no te sirven ni para ver las cartas.",
    remate: "Me sirven para no verte la cara, que ya es un montón."
  },
  {
    id: "vestuario",
    bardo: "Tenés olor a vestuario de ascenso en febrero.",
    remate: "Por lo menos yo alguna vez pisé una cancha."
  },
  {
    id: "lento",
    bardo: "Sos tan lento que el turno te pasa por al lado.",
    remate: "Tiempo arena activado: el que espera, cobra."
  },
  {
    id: "servilleta",
    bardo: "Tenés la personalidad de una servilleta de bar.",
    remate: "Y aun así absorbí todos tus chistes aguados."
  },
  {
    id: "gazpacho",
    bardo: "El Gazpacho te mira y se caga de risa.",
    remate: "Se ríe porque le conté que la vuelta la pagás vos."
  },
  {
    id: "ultimo-picado",
    bardo: "En el picado te eligieron último.",
    remate: "Me guardaron para el final, como al postre."
  },
  {
    id: "generala",
    bardo: "Jugás al truco como si fuera la generala.",
    remate: "Y te gané con un full de anchos, así que calladito."
  },
  {
    id: "humo",
    bardo: "Tenés más humo que el antro entero.",
    remate: "Y vos más ceniza: te quemaste solo."
  },
  {
    id: "cartero",
    bardo: "Vas más al mazo que el cartero al correo.",
    remate: "Y vos ni carta tenés para mandar."
  },
  {
    id: "retruco",
    bardo: "Cantás retruco con la voz temblando.",
    remate: "Lo que tiembla es la mesa cuando me siento."
  },
  {
    id: "suplentes",
    bardo: "Tu ídolo es el banco de suplentes.",
    remate: "Desde ahí se ve clarito cómo perdés."
  },
  {
    id: "chamuyo",
    bardo: "Sos puro chamuyo y cero cartas.",
    remate: "El chamuyo es la carta que vos nunca aprendiste a jugar."
  },
  {
    id: "lmerk",
    bardo: "¡L'Merk te persigue en sueños!",
    remate: "L'Merk me pide consejos, hermano."
  },
  {
    id: "pared",
    bardo: "Perdés hasta jugando a la pelota contra la pared.",
    remate: "La pared por lo menos me la devuelve; vos, ni el saludo."
  },
  {
    id: "espejo",
    bardo: "Con esa cara el truco se canta solo.",
    remate: "Y con la tuya se va al mazo solo."
  }
];

export const BARDO_BY_ID = Object.fromEntries(BARDOS.map((entry) => [entry.id, entry]));

// Relator: {a} = el que actúa, {b} = el otro. Un pool por evento para que no
// se repita la misma frase dos rondas seguidas.
export const RELATOR = {
  start: [
    "Se cerró la puerta. Uno sale caminando y el otro sale pagando.",
    "Pink Floyd de fondo, un revólver de corchos y dos egos. ¡TRUCOLOCO!",
    "Acá no se discute: se bardea."
  ],
  highlight: [
    "¡HIGHLIGHT! {a} lo dejó mudo.",
    "¡Qué remate! {b} no sabe dónde meterse.",
    "¡Lo bajó de un hondazo! {a} toma la palabra."
  ],
  miss: [
    "{a} se la comió enterita.",
    "Remate de jardín de infantes. Al gatillo, {a}.",
    "{a} tartamudeó y la tribuna lo vio."
  ],
  cagon: [
    "¡CAGÓN! {a} se quedó sin palabras.",
    "{a} se congeló. El tiempo no perdona.",
    "Silencio de {a}. En el antro, callarse es perder."
  ],
  click: [
    "Click. {a} respira.",
    "Click… vacío. {a} vuelve a la vida.",
    "Click. {a} transpira, pero sigue."
  ],
  spin: [
    "{a} gira el tambor. ¡El Utoneo manda!",
    "¡Tambor girado! {a} le pide un milagro a la ruleta."
  ],
  corchazo: [
    "¡CORCHAZO! {a} quedó pagando.",
    "¡PAF! {a} se comió el corcho. Al mazo.",
    "¡CORCHAZO! La vuelta la paga {a}."
  ]
};
