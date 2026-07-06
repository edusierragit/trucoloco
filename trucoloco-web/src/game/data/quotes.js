// El veneno de cada personaje. Tono de la casa: argentino, turbio, futbolero.
// Categorías: turno (le toca jugar), gana (su equipo cierra la mano),
// pierde (la pierde), sustancia (Sustancia X activa en la mesa).

const QUOTES = {
  gazpacho: {
    turno: ["Ya gané. Avisale al resto.", "El As es mío por derecho divino.", "Miren y aprendan, mortales.", "EXODIA está en camino, tranquilos."],
    gana: ["Obvio.", "Ni transpiré.", "Otra para el museo."],
    pierde: ["ROBO. Esto fue ROBO.", "La mesa está comprada.", "Pausa técnica. PAUSA TÉCNICA."],
    sustancia: ["Veo los cuatro anchos... en tu cara.", "El humo me habla y dice que gano."]
  },
  irvyn: {
    turno: ["Esto se negocia después.", "Tengo un papel que dice que ganamos.", "Firmá acá y nadie sale herido."],
    gana: ["Según contrato.", "Cláusula tercera: cobramos."],
    pierde: ["Vamos a arbitraje.", "Esto no estaba en el acta."],
    sustancia: ["Los números bailan pero cierran.", "¿Alguien más escucha al escribano?"]
  },
  marvyn: {
    turno: ["A llorar al campito.", "¿Eso era tu mejor carta? Qué ternura.", "Tomá nota, pibe."],
    gana: ["Andá a buscarla al fondo.", "Se los dije en el vestuario."],
    pierde: ["El árbitro nos mató.", "Con este equipo no se puede."],
    sustancia: ["Las copas me guiñan el ojo.", "Juego doble de lo que veo."]
  },
  "myke-keta": {
    turno: ["...", "...", "…ya está hecho."],
    gana: ["...", "…lo sabía desde ayer."],
    pierde: ["...", "…interesante."],
    sustancia: ["...", "…ahora sí veo TODO."]
  },
  pochex: {
    turno: ["Aguante el arma, loco.", "Esta carta la afané yo mismo.", "¡TRUCOLOCO!"],
    gana: ["¡Highlight!", "¡De rebote pero vale!"],
    pierde: ["Me distraje con el humo.", "La próxima traigo dos armas."],
    sustancia: ["El fieltro está RESPIRANDO.", "¿Las cartas siempre tuvieron ojos?"]
  },
  pol: {
    turno: ["Tranquilos, hay sistema.", "Calculado. Todo calculado.", "El Utoneo manda."],
    gana: ["Matemática pura.", "Sistema 1, corazón 0."],
    pierde: ["Error de redondeo.", "El sistema necesita ajustes."],
    sustancia: ["Dividí por cero y está todo bien.", "Los palitos se cuentan solos."]
  },
  cubano: {
    turno: ["Suave, que esto se cocina solo.", "En La Habana esto ya estaba ganado.", "Fumate esa."],
    gana: ["Sabroso.", "Como un habano: lento y seguro."],
    pierde: ["El clima. Fue el clima.", "Ni en Varadero se pierde así."],
    sustancia: ["El ventilador me está contando cosas.", "Todo gira, pero elegante."]
  },
  default: {
    turno: ["Truco viene, avisen.", "Ojo que muerdo.", "¡Cagón el que se va!"],
    gana: ["L'Merk lo quiso.", "¡Highlight!"],
    pierde: ["Al mazo me hubiese ido.", "Mañana es otro antro."],
    sustancia: ["¿Alguien más ve eso?", "El techo queda lejos, ¿no?"]
  }
};

// determinístico-ish pero variado: no repite la última frase del personaje
const lastByCharacter = new Map();

export function pickQuote(characterId, mood) {
  const pool = (QUOTES[characterId] ?? QUOTES.default)[mood] ?? QUOTES.default[mood];
  if (!pool?.length) return null;
  const lastKey = `${characterId}-${mood}`;
  const last = lastByCharacter.get(lastKey);
  let quote = pool[Math.floor(Math.random() * pool.length)];
  if (pool.length > 1 && quote === last) {
    quote = pool[(pool.indexOf(quote) + 1) % pool.length];
  }
  lastByCharacter.set(lastKey, quote);
  return quote;
}
