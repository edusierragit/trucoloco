import { lazy, Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { sfx } from "../game/audio/sfx";

const GameApp = lazy(() => import("../App"));
const ShopProduct3D = lazy(() => import("./ShopProduct3D"));

const NAV_ITEMS = [
  { id: "home", label: "Inicio", icon: "home" },
  { id: "play", label: "Jugar", icon: "play" },
  { id: "score", label: "Anotador", icon: "score" },
  { id: "shop", label: "Tienda", icon: "shop" },
  { id: "rules", label: "Reglas", icon: "rules" }
];

const EMPTY_RANKING = Array.from({ length: 6 }, (_, index) => index + 1);

const SHOP_CARD_RANKS = [["ancho", "1"], ["dos", "2"], ["tres", "3"], ["cuatro", "4"], ["cinco", "5"], ["seis", "6"], ["siete", "7"], ["sota", "10"], ["caballo", "11"], ["rey", "12"]];
const SHOP_CARD_SUITS = [["espada", "espadas"], ["basto", "bastos"], ["oro", "oros"], ["copa", "copas"]];
const SPANISH_SHOP_CARDS = SHOP_CARD_SUITS.flatMap(([fileSuit, suit]) => SHOP_CARD_RANKS.map(([fileRank, rank]) => ({
  rank,
  suit,
  src: `/assets/cards/fronts/${fileRank}-${fileSuit}.svg`
})));
const TRAZOS_SHOP_CARDS = SHOP_CARD_SUITS.flatMap(([, suit]) => SHOP_CARD_RANKS.map(([, rank]) => ({ rank, suit })));
const GAZPACHO_SHOP_CARDS = SHOP_CARD_SUITS.flatMap(([, suit], suitIndex) => SHOP_CARD_RANKS.map(([, rank], rankIndex) => ({
  rank,
  suit,
  portrait: Number(rank) >= 10 ? (rankIndex + suitIndex) % 3 + 1 : null,
  crowned: rank === "12"
})));

const CARD_PIP_LAYOUTS = {
  1: [[50, 50]],
  2: [[50, 28], [50, 72]],
  3: [[50, 24], [50, 50], [50, 76]],
  4: [[34, 31], [66, 31], [34, 69], [66, 69]],
  5: [[32, 28], [68, 28], [50, 50], [32, 72], [68, 72]],
  6: [[32, 24], [68, 24], [32, 50], [68, 50], [32, 76], [68, 76]],
  7: [[32, 22], [68, 22], [32, 43], [68, 43], [50, 55], [32, 77], [68, 77]]
};

const PRODUCT_VARIANTS = {
  lentes: ["Esmeralda", "Violeta imperial", "Azul acero", "Rojo criollo", "Negro nocturno", "Champagne"],
  skins: ["Negociador ejecutivo", "Negociador con chaleco", "Jugador Estrella · básquet", "Jugador Estrella · fútbol", "Cartachín · karate", "Cartachín · samurái"],
  fichines: ["Verde y crema", "Negro y dorado", "Bordó y bronce"]
};

const RANK_LADDER = [
  ["Ancho de espadas · El Macho", [[1, "espadas"]]],
  ["Ancho de bastos · La Hembra", [[1, "bastos"]]],
  ["7 de espadas · El Manco", [[7, "espadas"]]],
  ["7 de oros · La Culata", [[7, "oros"]]],
  ["Todos los 3", [[3, "espadas"], [3, "copas"], [3, "oros"], [3, "bastos"]]],
  ["Todos los 2", [[2, "espadas"], [2, "copas"], [2, "oros"], [2, "bastos"]]],
  ["Anchos falsos", [[1, "oros"], [1, "copas"]]],
  ["Todos los 12 · Reyes", [[12, "espadas"], [12, "copas"], [12, "oros"], [12, "bastos"]]],
  ["Todos los 11 · Caballos", [[11, "espadas"], [11, "copas"], [11, "oros"], [11, "bastos"]]],
  ["Todos los 10 · Sotas", [[10, "espadas"], [10, "copas"], [10, "oros"], [10, "bastos"]]],
  ["Sietes falsos", [[7, "copas"], [7, "bastos"]]],
  ["Todos los 6", [[6, "espadas"], [6, "copas"], [6, "oros"], [6, "bastos"]]],
  ["Todos los 5", [[5, "espadas"], [5, "copas"], [5, "oros"], [5, "bastos"]]],
  ["Todos los 4", [[4, "espadas"], [4, "copas"], [4, "oros"], [4, "bastos"]]]
];

const TRADITIONAL_QUIZ = [
  ["¿Cuál es la carta más alta del truco?", ["Ancho de espadas", "Ancho de oros", "Rey de bastos"], 0],
  ["Tenés 4 y 5 de copas. ¿Cuánto envido tenés?", ["27", "29", "31"], 1],
  ["¿Cuánto valen el 10, 11 y 12 para calcular el envido?", ["10 puntos", "Su número", "0 puntos"], 2],
  ["¿A cuántos puntos se juega una partida larga?", ["15", "20", "30"], 2],
  ["Cantás Truco y responden No quiero. ¿Cuánto ganás?", ["1 punto", "2 puntos", "3 puntos"], 0],
  ["¿Cuánto vale un Retruco querido?", ["2 puntos", "3 puntos", "4 puntos"], 1],
  ["¿Cuánto vale un Vale cuatro querido?", ["3 puntos", "4 puntos", "5 puntos"], 1],
  ["¿Qué palabra acepta correctamente un canto?", ["Dale", "Vale", "Quiero"], 2],
  ["Envido más Envido querido: ¿cuántos puntos se juegan?", ["2", "3", "4"], 2],
  ["Envido más Real Envido querido: ¿cuántos puntos se juegan?", ["4", "5", "6"], 1],
  ["Si hay empate de envido, ¿quién gana?", ["El mano", "Quien repartió", "Se anula"], 0],
  ["¿Cuándo puede cantarse el envido?", ["En cualquier ronda", "Durante la primera", "Después del Truco"], 1],
  ["¿Cuántas cartas recibe cada jugador?", ["Dos", "Tres", "Cuatro"], 1],
  ["¿Quién juega primero una mano?", ["El mano", "Quien repartió", "Quien ganó la partida anterior"], 0],
  ["¿Cuántas jugadas puede tener una mano?", ["Hasta dos", "Hasta tres", "Siempre cuatro"], 1],
  ["Si un equipo gana las dos primeras jugadas, ¿qué pasa con la tercera?", ["Vale doble", "Se juega igual", "Ya no se juega"], 2],
  ["Tenés 6 y 7 del mismo palo. ¿Cuánto envido tenés?", ["13", "27", "33"], 2],
  ["Si no tenés dos cartas del mismo palo, ¿cómo se calcula el envido?", ["Vale la carta numérica más alta", "Siempre son 20", "Se suman las tres cartas"], 0]
];

const TRUCOLOCO_QUIZ = [
  ["¿Quién maneja el Mazo de Armas?", ["El Negociador", "El Cartachin", "El Jugador Estrella"], 1],
  ["¿Quién puede cantar los súper cantos?", ["Cualquier jugador", "El Barman", "El Jugador Estrella"], 2],
  ["¿Cuánto vale un Trucoloco querido?", ["4 puntos", "8 puntos", "10 puntos"], 1],
  ["¿Qué exige la Ley L'Merk antes de anotar?", ["Un brindis", "Acuerdo y apretón de manos", "Mostrar las cartas"], 1],
  ["¿Cuánto dura el Tiempo Arena?", ["1 minuto", "2 minutos", "3 minutos"], 1],
  ["¿Quién controla el Mazo Trucoloco?", ["El repartidor", "El Cartachin", "El Negociador"], 0],
  ["¿Puede Torneo Z terminar empatado?", ["Sí", "No", "Solo con acuerdo"], 1],
  ["¿Qué sanción base tiene hacer trampa?", ["4 puntos", "5 puntos", "10 puntos"], 2]
];

const TRUCOLOCO_CARD_NAMES = [
  "Modo Clásico", "Modo Invertido", "Oculto / Oculto", "Oculto / Descubierto", "Descubierto / Oculto",
  "Espada negra", "Espada plateada", "Espada dorada", "Versus", "SUPER Versus", "Gafas",
  "Hexágono 6 gafas", "Hexágono 3 gafas", "Hexágono 3 gafas", "Hexágono 2 gafas", "Hexágono 2 gafas",
  "Hexágono 6 espadas", "Hexágono 3 espadas", "Hexágono 3 espadas", "Hexágono 2 espadas", "Hexágono 2 espadas",
  "Ronda a la izquierda", "Descarta una", "Descarta dos", "Pasa gafas", "Prohibido negociar", "Igualador",
  "Revólver", "Gomera", "Sustancia X", "J.E. aliado elige", "J.E. oponente elige", "Némesis elige", "R.I.P.", "Súper J.E.yn", "Torneo Z"
];

const TRUCOLOCO_DESCRIPTIONS = [
  "Truco clásico, sin negociación, armas, habilidades ni súper cantos.", "Todos sostienen sus cartas al revés.", "Elegís y jugás tus cartas boca abajo.", "Elegís boca abajo y jugás boca arriba.", "Elegís viendo y jugás boca abajo.",
  "Otorga un arma del Mazo de Armas.", "Otorga un arma del Mazo de Armas.", "Otorga un arma del Mazo de Armas.", "Duelo directo con tu antagonista.", "Cada equipo arma una mano de tres y se superduela.", "Obliga a usar gafas del hexágono.",
  "Toda la mesa usa gafas.", "Tres participantes usan gafas.", "Tres participantes usan gafas.", "Dos participantes usan gafas.", "Dos participantes usan gafas.",
  "Todos reciben una carta de armas.", "Tres participantes reciben una carta de armas.", "Tres participantes reciben una carta de armas.", "Dos participantes reciben una carta de armas.", "Dos participantes reciben una carta de armas.",
  "La ronda corre hacia la izquierda.", "Todos pasan una carta hacia la izquierda.", "Todos pasan dos cartas hacia la izquierda.", "Las gafas pasan a la derecha al terminar cada ronda.", "No se negocia durante la mano.", "Los 1 pasan a ser 4 y los 4 pasan a ser 1.",
  "Elimina una carta de cada participante con seis tiros.", "Elimina una carta de un oponente.", "Invencibilidad ante armas más una habilidad inventada.", "Tu Jugador Estrella elige qué cartas tirás.", "El Jugador Estrella rival elige qué cartas tirás.", "Tu némesis elige qué carta tirás.", "El mazo decidió eliminarte de la mano.", "Toma las cartas de su equipo y juega solo.", "Duelo de Jugadores Estrella al mejor de nueve."
];

const WEAPON_CARD_NAMES = [
  "As", "Comodín", "Varita Mágica", "Bloqueo Envido", "Bloqueo Truco", "Cuatruno", "Ojo", "Gafas", "Anti-gafas", "Mudo",
  "Sordos", "Ciego", "Espejito-Espejito", "Fuego", "Parca", "Cambio", "Intercambio", "Remolino", "Tornado", "Agujero Negro",
  "Hypno", "Lámpara de Aladino", "Escudo", "Corta Césped", "Trampolín", "Dinamita", "Mina", "Gancho", "Poison", "Incógnito"
];

const WEAPON_DESCRIPTIONS = [
  "Poder absoluto. Pertenece al último MVP.", "Puede usarse como cualquier carta menos el As.", "Cambia el palo de una carta, no su número.", "No permite cantar envido.", "No permite cantar truco.",
  "Los 1 se convierten en 4 y los 4 en 1.", "Permite ver una carta de cada oponente.", "Obliga a usar gafas del hexágono.", "Permite quitar las gafas.", "No permite hablar e inhabilita el canto.",
  "Inhabilita el canto del otro equipo.", "Obliga a jugar sin ver.", "Devuelve el arma contra el oponente.", "Quema una carta.", "Manda a un participante al mazo.",
  "Cambia cartas propias por cartas no jugadas del mazo.", "Cambia cartas propias por cartas no jugadas del rival.", "Revuelve las cartas jugadas y rearma la jugada.", "Revuelve las cartas no jugadas y rearma las manos.", "Devuelve las nueve cartas del equipo al mazo y entrega nueve nuevas.",
  "Pone a un jugador bajo tu poder.", "El genio concede un deseo.", "Protege de cualquier arma o habilidad.", "Elimina la carta rival y la aliada que tiene enfrente.", "Hace rebotar una carta hacia otro jugador.",
  "Explota la carta sobre la que se apoya.", "Explota la carta que se coloca encima.", "Toma cualquier carta no jugada de un mazo o una mano.", "Envenena: un turno sin jugar.", "Permite jugar una carta boca abajo."
];

const RANK_EXAMPLES = ["Ancho de espadas", "La Hembra (ancho de bastos)", "7 de espadas", "7 de oros", "3 de copas", "2 de oros", "Ancho de copas", "Rey de bastos", "Caballo de oros", "Sota de espadas", "7 de copas", "6 de bastos", "5 de oros", "4 de copas"];
const RANK_QUIZ = RANK_EXAMPLES.flatMap((higher, higherIndex) => RANK_EXAMPLES.slice(higherIndex + 1).map((lower, offset) => {
  const reversed = (higherIndex + offset) % 2 === 0;
  return [`¿Qué carta es más alta?`, reversed ? [lower, higher] : [higher, lower], reversed ? 1 : 0];
}));
function shuffled(items) {
  return [...items].sort(() => Math.random() - .5);
}

function buildTraditionalQuiz() {
  const rules = shuffled(TRADITIONAL_QUIZ);
  const ranks = shuffled(RANK_QUIZ).slice(0, 7);
  return rules.flatMap((question, index) => index < ranks.length && index % 2 === 1 ? [question, ranks[index]] : [question]);
}

function buildDeckQuiz(names, descriptions, deckLabel) {
  return names.flatMap((name, index) => {
    const wrongOne = names[(index + 5) % names.length];
    const wrongTwo = names[(index + 11) % names.length];
    const descWrongOne = descriptions[(index + 3) % descriptions.length];
    const descWrongTwo = descriptions[(index + 8) % descriptions.length];
    return [
      [`En el ${deckLabel}, ¿qué carta hace esto: ${descriptions[index]}`, [wrongOne, name, wrongTwo], 1],
      [`¿Qué hace la carta ${name}?`, [descriptions[index], descWrongOne, descWrongTwo], 0]
    ];
  });
}
const COMPLETE_TRUCOLOCO_QUIZ = [
  ...TRUCOLOCO_QUIZ,
  ...buildDeckQuiz(TRUCOLOCO_CARD_NAMES, TRUCOLOCO_DESCRIPTIONS, "Mazo Trucoloco"),
  ...buildDeckQuiz(WEAPON_CARD_NAMES, WEAPON_DESCRIPTIONS, "Mazo de Armas")
];

function runPortalTransition(update, { direction = "forward", tone = "portal" } = {}) {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.dataset.portalDirection = direction;
  root.dataset.portalTone = tone;

  const clearTransitionState = () => {
    delete root.dataset.portalDirection;
    delete root.dataset.portalTone;
  };

  if (!document.startViewTransition || reducedMotion) {
    update();
    clearTransitionState();
    return;
  }

  const transition = document.startViewTransition(update);
  transition.finished.finally(clearTransitionState);
}

function PortalIcon({ name }) {
  if (name === "home") return <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13v-9.5" /></>;
  if (name === "play") return <path d="m7 4 12 8-12 8Z" />;
  if (name === "score") return <><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>;
  if (name === "shop") return <><path d="M4 9h16l-1.5-5h-13Z" /><path d="M5 9v11h14V9" /></>;
  return <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 17h.01" /></>;
}

function BackArrowIcon() {
  return <svg viewBox="0 0 48 28" aria-hidden="true"><path className="portal-back-tail" d="M43 14H8" /><path className="portal-back-head" d="m16 5-9 9 9 9" /></svg>;
}

function SoundIcon({ enabled }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M5 13h5l7-6v18l-7-6H5Z" />
      {enabled ? <><path className="portal-sound-wave portal-sound-wave-one" d="M21 12c2.2 2.3 2.2 5.7 0 8" /><path className="portal-sound-wave" d="M24.5 8.5c4.3 4.4 4.3 10.6 0 15" /></> : <path className="portal-sound-muted-line" d="m21 12 8 8M29 12l-8 8" />}
    </svg>
  );
}

function BrandMark({ compact = false }) {
  return (
    <div className={compact ? "portal-logo portal-logo-compact" : "portal-logo"} aria-label="Trucoloco 6.0">
      <img src="/assets/brand/trucoloco-logo-hd.png" alt="Trucoloco" />
      <span>6.0</span>
    </div>
  );
}

function PortalNav({ activeSection, onNavigate, game = false }) {
  return (
    <nav className={game ? "portal-nav portal-nav-game" : "portal-nav"} aria-label="Navegación principal">
      {NAV_ITEMS.map((item) => (
        <button className={activeSection === item.id ? "portal-nav-item portal-nav-item-active" : "portal-nav-item"} type="button" key={item.id} onClick={() => onNavigate(item.id)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><PortalIcon name={item.icon} /></svg><span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function RankingPanel({ mode }) {
  const showRoles = mode === "trucoloco";
  return (
    <div className="portal-ranking-panel portal-reveal-panel portal-ranking-empty" aria-label="Ranking todavía vacío">
      <div className="portal-panel-heading"><span>Ranking</span><small>Top 6 · esperando la primera partida</small></div>
      <div className="portal-ranking-callout"><strong>La gloria todavía está vacante.</strong><span>Jugá la primera partida y estrená la tabla.</span></div>
      <div className="portal-ranking-columns">
        <section>
          <h2>Individual</h2>
          <ol>{EMPTY_RANKING.map((position) => <li className="portal-ranking-slot" key={`individual-${position}`}><b>—</b><span>{showRoles ? "Sin jugador · sin rol" : "Sin jugador"}</span><strong>— pts.</strong></li>)}</ol>
        </section>
        <section>
          <h2>Por equipos</h2>
          <ol>{EMPTY_RANKING.map((position) => <li className="portal-ranking-slot" key={`team-${position}`}><b>—</b><span>{showRoles ? "Sin equipo · roles vacantes" : "Sin equipo"}</span><strong>— pts.</strong></li>)}</ol>
        </section>
      </div>
    </div>
  );
}

function PlaySection({ onLaunch }) {
  const [selectedMode, setSelectedMode] = useState(null);
  const [openPanel, setOpenPanel] = useState(null);
  const [teamNames, setTeamNames] = useState(["", "", "", ""]);
  const [teamsReady, setTeamsReady] = useState([false, false, false, false]);
  const [semifinalWinners, setSemifinalWinners] = useState([null, null]);
  const [finalReady, setFinalReady] = useState([false, false]);
  const [champion, setChampion] = useState(null);
  const [launchingMode, setLaunchingMode] = useState(null);
  const modeLabel = selectedMode === "comun" ? "Truco tradicional" : "Trucoloco";

  // el primer toque manda: doble clic (o un bot apurado) no reinicia la cuenta
  const launch = (intent) => setLaunchingMode((current) => current ?? { mode: selectedMode, intent });

  useEffect(() => {
    if (!launchingMode) return undefined;
    const timer = window.setTimeout(() => onLaunch(launchingMode.mode, launchingMode.intent), 1350);
    return () => window.clearTimeout(timer);
  }, [launchingMode, onLaunch]);

  const openMode = (mode) => {
    runPortalTransition(() => {
      setSelectedMode(mode);
      setOpenPanel(null);
      setTeamNames(["", "", "", ""]);
      setTeamsReady([false, false, false, false]);
      setSemifinalWinners([null, null]);
      setFinalReady([false, false]);
      setChampion(null);
    }, { direction: "forward", tone: mode });
  };

  const closeMode = () => {
    runPortalTransition(() => {
      setSelectedMode(null);
      setOpenPanel(null);
      setTeamNames(["", "", "", ""]);
      setTeamsReady([false, false, false, false]);
      setSemifinalWinners([null, null]);
      setFinalReady([false, false]);
      setChampion(null);
    }, { direction: "back", tone: selectedMode || "portal" });
  };

  const confirmTeam = (teamIndex) => {
    const cleanName = teamNames[teamIndex].trim();
    if (!cleanName) return;
    const nextNames = [...teamNames];
    const nextReady = [...teamsReady];
    nextNames[teamIndex] = cleanName;
    nextReady[teamIndex] = true;
    setTeamNames(nextNames);
    setTeamsReady(nextReady);
  };

  const cancelTeam = (teamIndex) => {
    const nextNames = [...teamNames];
    const nextReady = [...teamsReady];
    nextNames[teamIndex] = "";
    nextReady[teamIndex] = false;
    setTeamNames(nextNames);
    setTeamsReady(nextReady);
  };

  const registerSemifinalWinner = (semifinalIndex, teamIndex) => {
    const winner = teamNames[teamIndex].trim();
    if (!winner) return;
    setSemifinalWinners((current) => {
      const next = current.map((name, index) => index === semifinalIndex ? winner : name);
      if (next[0] && next[0] === next[1]) setChampion(next[0]);
      return next;
    });
    setFinalReady([false, false]);
  };

  const confirmFinalist = (index) => setFinalReady((current) => current.map((ready, itemIndex) => itemIndex === index ? true : ready));
  const cancelFinalist = (index) => {
    const rival = semifinalWinners[index === 0 ? 1 : 0];
    if (rival) setChampion(rival);
    setFinalReady((current) => current.map((ready, itemIndex) => itemIndex === index ? false : ready));
  };

  if (selectedMode) {
    return (
      <section className={`portal-section portal-play-selected portal-mode-${selectedMode}`} aria-labelledby="portal-play-title">
        <button className="portal-back-button" type="button" aria-label="Volver" title="Volver" onClick={closeMode}><BackArrowIcon /></button>
        <header className="portal-section-head portal-mode-heading">
          <h1 id="portal-play-title">{modeLabel}</h1>
          <p>Elegí cómo jugar.</p>
        </header>
        <div className="portal-play-actions portal-actions-unfold">
          <button type="button" onClick={() => launch("bot")}><svg viewBox="0 0 24 24" aria-hidden="true"><PortalIcon name="play" /></svg><strong>Jugar con un bot</strong><small>Entrá directo a una partida.</small></button>
          <button type="button" onClick={() => launch("online")}><svg viewBox="0 0 24 24" aria-hidden="true"><PortalIcon name="play" /></svg><strong>Jugar online</strong><small>Entrá a la mesa online.</small></button>
          <button className={openPanel === "tournament" ? "portal-action-active" : ""} type="button" aria-pressed={openPanel === "tournament"} onClick={() => setOpenPanel((current) => current === "tournament" ? null : "tournament")}><svg viewBox="0 0 24 24" aria-hidden="true"><PortalIcon name="play" /></svg><strong>Torneo</strong><small>Al mejor de tres.</small></button>
          <button className={openPanel === "ranking" ? "portal-action-active" : ""} type="button" aria-pressed={openPanel === "ranking"} onClick={() => setOpenPanel((current) => current === "ranking" ? null : "ranking")}><svg viewBox="0 0 24 24" aria-hidden="true"><PortalIcon name="score" /></svg><strong>Ranking</strong><small>Individual y por equipos.</small></button>
        </div>
        {openPanel === "tournament" ? (
          <div className="portal-tournament-setup portal-reveal-panel" aria-label="Clasificatoria del torneo">
            <div className="portal-panel-heading"><span>Clasificatoria</span><small>Al mejor de tres.</small></div>
            <div className="portal-tournament-bracket">
              <div className={champion ? "portal-champion-node portal-champion-ready" : "portal-champion-node"}>
                <small>Campeones</small>
                <strong>{champion || "— — —"}</strong>
              </div>
              <div className="portal-bracket-lines portal-bracket-lines-final" aria-hidden="true"><i /><i /></div>
              <div className="portal-final-row">
                {[0, 1].map((finalistIndex) => (
                  <div className={semifinalWinners[finalistIndex] ? "portal-finalist-ready" : ""} key={finalistIndex}>
                    <small>Finalista {finalistIndex === 0 ? "A" : "B"}</small>
                    <strong>{semifinalWinners[finalistIndex] || "— — —"}</strong>
                    {semifinalWinners[finalistIndex] && !champion && semifinalWinners[0] !== semifinalWinners[1] ? (
                      <div className="portal-finalist-actions">
                        <button type="button" disabled={finalReady[finalistIndex]} onClick={() => confirmFinalist(finalistIndex)}>OK</button>
                        <button type="button" onClick={() => cancelFinalist(finalistIndex)}>Cancelar</button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="portal-bracket-lines portal-bracket-lines-semis" aria-hidden="true"><i /><i /><b /><b /></div>
              <div className="portal-semifinal-grid">
                {[0, 2].map((firstTeam, semifinalIndex) => (
                  <section className="portal-semifinal" key={firstTeam}>
                    <header><strong>Semifinal {semifinalIndex + 1}</strong><small>Mejor de tres</small></header>
                    <div className="portal-tournament-match">
                      {[firstTeam, firstTeam + 1].map((teamIndex) => (
                        <div className={teamsReady[teamIndex] ? "portal-team-entry portal-team-ready" : "portal-team-entry"} key={teamIndex}>
                          <label htmlFor={`portal-team-${teamIndex}`}>Equipo {teamIndex + 1}</label>
                          <input id={`portal-team-${teamIndex}`} type="text" value={teamNames[teamIndex]} maxLength={24} disabled={teamsReady[teamIndex]} placeholder="Nombre del equipo" onChange={(event) => setTeamNames((current) => current.map((name, index) => index === teamIndex ? event.target.value : name))} />
                          <div className="portal-team-actions">
                            <button type="button" aria-label={`Confirmar equipo ${teamIndex + 1}`} title="Confirmar" disabled={!teamNames[teamIndex].trim() || teamsReady[teamIndex]} onClick={() => confirmTeam(teamIndex)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10" /></svg></button>
                            <button type="button" aria-label={`Cancelar equipo ${teamIndex + 1}`} title="Cancelar" disabled={!teamNames[teamIndex] && !teamsReady[teamIndex]} onClick={() => cancelTeam(teamIndex)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
                          </div>
                          <small>{teamsReady[teamIndex] ? "Listos para jugar" : "Esperando confirmación"}</small>
                        </div>
                      ))}
                      <span className="portal-versus">VS</span>
                    </div>
                    {teamsReady[firstTeam] && teamsReady[firstTeam + 1] && !semifinalWinners[semifinalIndex] ? (
                      <div className="portal-match-result" aria-label={`Resultado de semifinal ${semifinalIndex + 1}`}>
                        <small>Cuando termine la partida, registrá quién ganó:</small>
                        <div>
                          {[firstTeam, firstTeam + 1].map((teamIndex) => <button type="button" key={teamIndex} onClick={() => registerSemifinalWinner(semifinalIndex, teamIndex)}>Ganó {teamNames[teamIndex]}</button>)}
                        </div>
                      </div>
                    ) : null}
                  </section>
                ))}
              </div>
              {finalReady.every(Boolean) && !champion ? (
                <div className="portal-final-match">
                  <button className="portal-tournament-launch" type="button" onClick={() => launch("bot")}>Jugar la final</button>
                  <div><button type="button" onClick={() => setChampion(semifinalWinners[0])}>Ganó {semifinalWinners[0]}</button><button type="button" onClick={() => setChampion(semifinalWinners[1])}>Ganó {semifinalWinners[1]}</button></div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        {openPanel === "ranking" ? <RankingPanel mode={selectedMode} /> : null}
        {launchingMode ? (
          <div className={`portal-launch-transition portal-launch-${launchingMode.mode}`} aria-live="assertive">
            <div className="portal-smoke portal-smoke-one" /><div className="portal-smoke portal-smoke-two" /><div className="portal-smoke portal-smoke-three" />
            {launchingMode.mode === "comun" ? <div className="portal-launch-cards" aria-hidden="true"><span /><span /><span /></div> : <div className="portal-launch-sparks" aria-hidden="true"><i /><i /><i /><i /><i /></div>}
            <div className="portal-launch-stage">
              <BrandMark compact />
              <small className="portal-launch-mode">{launchingMode.mode === "trucoloco" ? "TRUCOLOCO" : "TRUCO TRADICIONAL"}</small>
              <strong className="portal-launch-versus">Tu equipo <b>VS</b> La mesa</strong>
              <p>{launchingMode.mode === "trucoloco" ? "Entrando a la locura…" : "Repartiendo la primera mano…"}</p>
              <div className="portal-launch-countdown" aria-hidden="true"><b>3</b><b>2</b><b>1</b></div>
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="portal-section" aria-labelledby="portal-play-title">
      <header className="portal-section-head portal-balanced-head portal-play-head">
        <h1 id="portal-play-title">Jugar</h1>
        <p>Elegí el modo.</p>
      </header>
      <div className="portal-choice-grid portal-choice-grid-two">
        <button className="portal-choice-card" type="button" onClick={() => openMode("comun")}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><PortalIcon name="play" /></svg>
          <strong>Truco tradicional</strong><small>El de siempre. Envido, truco y orgullo.</small><em>Entrar a la mesa</em>
        </button>
        <button className="portal-choice-card portal-choice-card-hot" type="button" onClick={() => openMode("trucoloco")}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><PortalIcon name="play" /></svg>
          <strong>Trucoloco</strong><small>El clásico, dos mazos extra y cero cordura.</small><em>Entrar a la locura</em>
        </button>
      </div>
    </section>
  );
}

function ScoreSection() {
  const [target, setTarget] = useState(null);
  const [scores, setScores] = useState({ us: 0, them: 0 });
  const adjust = (side, delta) => setScores((current) => ({ ...current, [side]: Math.max(0, Math.min(target, current[side] + delta)) }));

  if (!target) {
    return (
      <section className="portal-section" aria-labelledby="portal-score-title">
        <header className="portal-section-head portal-balanced-head"><h1 id="portal-score-title">Anotador</h1><p>¿A cuántos puntos juegan?</p></header>
        <div className="portal-choice-grid portal-choice-grid-two">
          {[15, 30].map((value) => <button className="portal-choice-card portal-score-target" type="button" key={value} onClick={() => runPortalTransition(() => setTarget(value), { tone: "score" })}><span>A</span><strong>{value}</strong><small>puntos</small></button>)}
        </div>
      </section>
    );
  }

  return (
    <section className="portal-section" aria-labelledby="portal-score-title">
      <header className="portal-section-head portal-score-head">
        <h1 id="portal-score-title">Partida a {target} puntos</h1>
        <button className="portal-text-button" type="button" onClick={() => runPortalTransition(() => { setTarget(null); setScores({ us: 0, them: 0 }); }, { direction: "back", tone: "score" })}>Cambiar partida</button>
      </header>
      <div className="portal-scoreboard">
        {[["us", "Nosotros"], ["them", "Ellos"]].map(([side, label]) => (
          <div className="portal-score-side" key={side}>
            <span>{label}</span>
            <div className={scores[side] >= target ? "portal-score-value portal-score-winner" : "portal-score-value"}>
              {scores[side] >= target ? <span className="portal-score-fireworks" aria-hidden="true"><i /><i /><i /></span> : null}
              <strong>{scores[side] >= target ? (side === "us" ? "¡ Ganamos !" : "¡ Ganaron !") : scores[side]}</strong>
            </div>
            <div><button type="button" aria-label={`Restar a ${label}`} onClick={() => adjust(side, -1)}>−</button><button type="button" aria-label={`Sumar a ${label}`} onClick={() => adjust(side, 1)}>+</button></div>
          </div>
        ))}
      </div>
      <button className="portal-reset" type="button" onClick={() => setScores({ us: 0, them: 0 })}>Nueva partida</button>
    </section>
  );
}

function DeckFan({ type }) {
  const label = type === "espanol" ? "Mazo español con el ancho de espadas" : type === "trazos" ? "Mazo Trazos con su uno de espadas" : "Mazo Gazpacho con la carta coronada";
  return (
    <div className={`portal-deck-stack portal-deck-${type}`} aria-label={label}>
      <span className="portal-deck-edge portal-deck-edge-three" />
      <span className="portal-deck-edge portal-deck-edge-two" />
      <div className="portal-deck-top">
        {type === "espanol" ? <img src="/assets/cards/fronts/ancho-espada.svg" alt="Uno de espadas" /> : null}
        {type === "trazos" ? <TrucoCardFace card={{ rank: "1", suit: "espadas" }} /> : null}
        {type === "gazpacho" ? <GazpachoCardFace card={{ rank: "12", suit: "oros", portrait: 2, crowned: true }} /> : null}
      </div>
    </div>
  );
}

function TrucoCourtFigure({ rank, suit }) {
  return (
    <div className={`portal-court-figure portal-court-${rank}`} aria-hidden="true">
      <svg viewBox="0 0 180 250">
        {rank === "11" ? <><path className="portal-court-horse" d="M38 184c4-56 38-81 84-64 27 10 34 42 19 82l-23-2-8-45-38 5-10 42H39Z" /><path className="portal-court-line" d="M61 138c13 8 34 7 49-2M118 200l20 31M62 201l-13 30" /></> : null}
        <circle className="portal-court-head" cx="90" cy={rank === "11" ? 72 : 62} r="24" />
        {rank === "12" ? <path className="portal-court-crown" d="m65 43 6-25 19 15 19-15 6 25Z" /> : null}
        <path className="portal-court-body" d={rank === "11" ? "M67 101Q90 86 113 101l13 67H54Z" : "M57 104Q90 82 123 104l18 103H39Z"} />
        <path className="portal-court-line" d={rank === "10" ? "M58 116 34 176M121 116l25 51" : "M58 116 32 70M121 116l27-62"} />
        <circle className="portal-court-hand" cx={rank === "10" ? 34 : 32} cy={rank === "10" ? 176 : 70} r="7" />
        <circle className="portal-court-hand" cx={rank === "10" ? 146 : 148} cy={rank === "10" ? 167 : 54} r="7" />
      </svg>
      <span className={rank === "10" ? "portal-court-held portal-court-held-down" : "portal-court-held portal-court-held-up"}><SuitGlyph suit={suit} /></span>
    </div>
  );
}

function TrucoCardFace({ card, mini = false }) {
  const numericRank = Number(card.rank);
  const pips = CARD_PIP_LAYOUTS[numericRank] ?? [];
  return (
    <div className={`portal-truco-card portal-truco-${card.suit}${mini ? " portal-truco-card-mini" : ""}`} aria-label={`${card.rank} de ${card.suit}`}>
      <span className="portal-card-corner portal-card-corner-top"><b>{card.rank}</b><SuitGlyph suit={card.suit} /></span>
      {numericRank <= 7 ? (
        <div className="portal-card-pips">{pips.map(([x, y], index) => <span style={{ "--pip-x": `${x}%`, "--pip-y": `${y}%` }} key={`${x}-${y}-${index}`}><SuitGlyph suit={card.suit} /></span>)}</div>
      ) : <TrucoCourtFigure rank={card.rank} suit={card.suit} />}
      <span className="portal-card-corner portal-card-corner-bottom"><b>{card.rank}</b><SuitGlyph suit={card.suit} /></span>
    </div>
  );
}

function GazpachoCardFace({ card }) {
  if (!card.portrait) return <div className="portal-gazpacho-card portal-gazpacho-number"><TrucoCardFace card={card} /></div>;
  return (
    <div className="portal-gazpacho-card">
      <b>{card.rank}</b>
      <div className={`portal-gazpacho-figure portal-gazpacho-rank-${card.rank}`}>
        {card.rank === "11" ? <span className="portal-gazpacho-horse" aria-hidden="true" /> : null}
        <span className="portal-gazpacho-body" aria-hidden="true" />
        <img src={`/assets/shop/gazpacho-${card.portrait}.png`} alt="Gazpacho" />
      </div>
      {card.crowned ? <svg className="portal-gazpacho-crown" viewBox="0 0 64 40" aria-hidden="true"><path d="M6 31 2 8l17 11L32 3l13 16L62 8l-4 23Z" /><path d="M7 31h50v6H7Z" /></svg> : null}
      <small>{card.rank}</small>
    </div>
  );
}

function ShopDeckCard({ type, card }) {
  if (type === "espanol") return <div className="portal-gallery-card"><img src={card.src} alt={`${card.rank} de ${card.suit}`} /></div>;
  if (type === "gazpacho") return <div className="portal-gallery-card"><GazpachoCardFace card={card} /></div>;
  return <div className="portal-gallery-card portal-gallery-trazos"><TrucoCardFace card={card} /></div>;
}

function ShopExtraVisual({ type, variant = 0, compact = true }) {
  return <Suspense fallback={<div className="portal-product-3d-loading" aria-label="Cargando modelo tridimensional" />}><ShopProduct3D type={type} variant={variant} compact={compact} /></Suspense>;
}

function PremiumShopCard({ product, onSelect }) {
  const [status, name, copy, price, type] = product;
  const moveProduct = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - .5;
    const y = (event.clientY - bounds.top) / bounds.height - .5;
    event.currentTarget.style.setProperty("--tilt-x", `${(-y * 7).toFixed(2)}deg`);
    event.currentTarget.style.setProperty("--tilt-y", `${(x * 9).toFixed(2)}deg`);
    event.currentTarget.style.setProperty("--light-x", `${((x + .5) * 100).toFixed(0)}%`);
    event.currentTarget.style.setProperty("--light-y", `${((y + .5) * 100).toFixed(0)}%`);
  };
  const resetProduct = (event) => {
    event.currentTarget.style.removeProperty("--tilt-x");
    event.currentTarget.style.removeProperty("--tilt-y");
    event.currentTarget.style.removeProperty("--light-x");
    event.currentTarget.style.removeProperty("--light-y");
  };

  return (
    <button className="portal-shop-card" type="button" onClick={() => onSelect(product)} onPointerMove={moveProduct} onPointerLeave={resetProduct}>
      <span className="portal-shop-status">{status}</span>
      <strong>{name}</strong>
      <div className="portal-product-stage">{["espanol", "trazos", "gazpacho"].includes(type) ? <DeckFan type={type} /> : <ShopExtraVisual type={type} />}</div>
      <p>{copy}</p>
      <b>{price || "Incluido"}</b>
      <em>Ver detalle</em>
    </button>
  );
}

function ShopSection() {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const decks = [
    ["Incluido", "Mazo español", "La baraja de toda la vida.", null, "espanol"],
    ["Próximamente", "Mazo Trazos", "El truco de siempre, dibujado con otra elegancia.", "$ 1", "trazos"],
    ["Próximamente", "Mazo Gazpacho", "Una edición especial del mejor Jugador Estrella de Trucoloco.", "$ 2", "gazpacho"]
  ];
  const extras = [
    ["Próximamente", "Lentes del Hexágono", "Modelos absurdos para llevar el caos al siguiente nivel.", "$ 1", "lentes"],
    ["Próximamente", "Skins de personajes", "Smoking de Negociante, golfista estrella y traje de Cartachin.", "$ 2", "skins"],
    ["Próximamente", "Fichines", "Fichas para favores.", "$ 1", "fichines"]
  ];
  const products = [...decks, ...extras];
  const selectedType = selectedProduct?.[4];
  const galleryItems = selectedType === "espanol" ? SPANISH_SHOP_CARDS
    : selectedType === "trazos" ? TRAZOS_SHOP_CARDS
    : selectedType === "gazpacho" ? GAZPACHO_SHOP_CARDS
    : PRODUCT_VARIANTS[selectedType] ?? [];
  const selectedItem = galleryItems[galleryIndex] ?? galleryItems[0];

  const openProduct = (product) => {
    setGalleryIndex(0);
    setPurchaseMessage("");
    setSelectedProduct(product);
  };

  const moveGallery = (direction) => {
    setGalleryIndex((current) => (current + direction + galleryItems.length) % galleryItems.length);
    setPurchaseMessage("");
  };

  useEffect(() => {
    if (!selectedProduct) return undefined;
    const close = (event) => {
      if (event.key === "Escape") setSelectedProduct(null);
      if (event.key === "ArrowRight") moveGallery(1);
      if (event.key === "ArrowLeft") moveGallery(-1);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selectedProduct]);

  return (
    <section className="portal-section" aria-labelledby="portal-shop-title">
      <header className="portal-section-head portal-shop-head portal-balanced-head"><h1 id="portal-shop-title">Tienda</h1><p>Equipá tu mesa.</p></header>
      <div className="portal-shop-grid">{products.map((product) => <PremiumShopCard product={product} onSelect={openProduct} key={product[1]} />)}</div>
      {selectedProduct ? createPortal((
        <div className="portal-product-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedProduct(null); }}>
          <article className="portal-product-modal" role="dialog" aria-modal="true" aria-labelledby="portal-product-title">
            <button className="portal-product-close" type="button" aria-label="Cerrar detalle" onClick={() => setSelectedProduct(null)}>×</button>
            <div className="portal-product-modal-gallery">
              <button className="portal-gallery-arrow portal-gallery-arrow-left" type="button" aria-label="Ver opción anterior" onClick={() => moveGallery(-1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7" /></svg></button>
              <div className="portal-product-modal-visual">
                {["espanol", "trazos", "gazpacho"].includes(selectedType) ? <ShopDeckCard type={selectedType} card={selectedItem} /> : <ShopExtraVisual type={selectedType} variant={galleryIndex} compact={false} />}
              </div>
              <button className="portal-gallery-arrow portal-gallery-arrow-right" type="button" aria-label="Ver opción siguiente" onClick={() => moveGallery(1)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 5 7 7-7 7" /></svg></button>
              <div className="portal-gallery-progress"><strong>{galleryIndex + 1} / {galleryItems.length}</strong><span>{typeof selectedItem === "string" ? selectedItem : `${selectedItem.rank} de ${selectedItem.suit}`}</span></div>
            </div>
            <div className="portal-product-modal-copy">
              <h2 id="portal-product-title">{selectedProduct[1]}</h2>
              <span className="portal-product-meta">{selectedProduct[0]}</span>
              <p>{selectedProduct[2]}</p>
              <div className="portal-product-finishes"><i>Verde noche</i><i>Crema</i><i>Dorado</i></div>
              {selectedProduct[3] ? <strong>{selectedProduct[3]}</strong> : null}
              {selectedProduct[3] ? <button className="portal-product-buy" type="button" onClick={() => setPurchaseMessage("Compra en preparación. Esta variante quedó seleccionada.")}>Comprar esta opción</button> : null}
              {purchaseMessage ? <small>{purchaseMessage}</small> : null}
            </div>
          </article>
        </div>
      ), document.body) : null}
    </section>
  );
}

function SuitGlyph({ suit }) {
  if (suit === "oros") return <svg className="portal-suit-glyph" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /><path d="M12 2.2v3M12 18.8v3M2.2 12h3M18.8 12h3M5.1 5.1l2.1 2.1M16.8 16.8l2.1 2.1M18.9 5.1l-2.1 2.1M7.2 16.8l-2.1 2.1" /></svg>;
  if (suit === "copas") return <svg className="portal-suit-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14c-1 6-3 9-7 9S6 10 5 4Z" /><path d="M12 13v5M8 20h8" /></svg>;
  if (suit === "bastos") return <svg className="portal-suit-glyph portal-suit-glyph-bat" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 21.5 8 16 16.2 2.8c.8-1.3 3.6.2 3 1.7L11.8 18Z" /></svg>;
  return <img className="portal-suit-glyph portal-suit-glyph-sword" src="/assets/brand/trucoloco-sword-hd.png" alt="" />;
}

function RankLadder() {
  return (
    <div className="portal-rank-ladder">
      {RANK_LADDER.map(([label, cards], index) => (
        <div className="portal-rank-row" key={label}>
          <span className="portal-rank-position">{index + 1}</span>
          <div className="portal-mini-cards">
            {cards.map(([rank, suit]) => <div className="portal-mini-card" key={`${rank}-${suit}`}><TrucoCardFace card={{ rank: String(rank), suit }} mini /></div>)}
          </div>
          <strong>{label}</strong>
        </div>
      ))}
    </div>
  );
}

function RulesQuiz({ questions }) {
  const makeQuestions = () => typeof questions === "function" ? questions() : shuffled(questions);
  const [questionSet, setQuestionSet] = useState(makeQuestions);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const question = questionSet[index];

  if (!question) {
    return (
      <div className="portal-quiz-result">
        <strong>{score} respuestas correctas</strong>
        <p>{score === questionSet.length ? "Perfecto. La mesa ya no tiene secretos." : "Buen intento. Podés volver a practicar cuando quieras."}</p>
        <button type="button" onClick={() => { setQuestionSet(makeQuestions()); setIndex(0); setSelected(null); setScore(0); }}>Reintentar</button>
      </div>
    );
  }

  const [prompt, options, correct] = question;
  const answer = (optionIndex) => {
    if (selected !== null) return;
    setSelected(optionIndex);
    if (optionIndex === correct) setScore((current) => current + 1);
  };

  return (
    <div className="portal-quiz-box">
      <strong>{prompt}</strong>
      <div className="portal-quiz-options">
        {options.map((option, optionIndex) => {
          const resultClass = selected === null ? "" : optionIndex === correct ? " portal-quiz-correct" : optionIndex === selected ? " portal-quiz-wrong" : "";
          return <button className={`portal-quiz-option${resultClass}`} type="button" key={`${optionIndex}-${option}`} onClick={() => answer(optionIndex)}>{option}</button>;
        })}
      </div>
      {selected !== null ? <button className="portal-quiz-next" type="button" onClick={() => { setIndex((current) => current + 1); setSelected(null); }}>{index === questionSet.length - 1 ? "Ver resultado" : "Siguiente"}</button> : null}
    </div>
  );
}

function CardGallery({ deck, names, descriptions }) {
  return (
    <div className="portal-card-gallery">
      {names.map((name, index) => (
        <figure key={`${name}-${index}`}>
          <img loading="lazy" src={`/assets/cards/${deck}/carta-${String(index + 1).padStart(2, "0")}.jpg`} alt={`Carta ${name}`} />
          <figcaption><strong>{name}</strong><span>{descriptions[index]}</span></figcaption>
        </figure>
      ))}
    </div>
  );
}

function TraditionalRules() {
  return (
    <div className="portal-rule-document">
      <section><h2>Lo básico</h2><p>Se juega con la baraja española de 40 cartas, sin 8 ni 9. El mínimo es 1 contra 1; también se juega de a 4 o 6, formando equipos de 2 o 3.</p></section>
      <section><h2>Cómo comienza</h2><p>Quien reparte entrega tres cartas a cada jugador, una por una. Juega primero el <strong>mano</strong>, ubicado a la derecha de quien repartió. El juego termina cuando un equipo llega a 15 o 30 puntos, según lo acordado antes de empezar.</p></section>
      <section><h2>Desarrollo de la mano</h2><p>Cada mano tiene hasta tres jugadas o rondas: primera, segunda y tercera. Cada participante tira una carta por jugada o ronda. Gana la mano quien gana dos de las tres jugadas o rondas. Si un equipo gana las dos primeras, la tercera ya no se juega.</p></section>
      <section>
        <h2>Envido <small className="portal-rule-kind">(canto)</small></h2>
        <p>Solo se canta durante la primera jugada y antes de responder el Truco. Para calcularlo, se buscan dos cartas del mismo palo: se suman sus valores y se agregan 20. El 10, 11 y 12 valen cero. Si no hay dos cartas del mismo palo, vale la carta numérica más alta.</p>
        <p>Se puede cantar con pocos puntos para hacer dudar al rival. Cuando alguien acepta diciendo <strong>Quiero</strong>, al terminar la mano se muestran los tantos. En caso de empate gana el mano.</p>
        <div className="portal-escalation"><div><strong>Envido</strong><span>2 puntos</span></div><b>→</b><div><strong>Real Envido</strong><span>3 puntos</span></div><b>→</b><div><strong>Falta Envido</strong><span>Lo que falta para ganar</span></div></div>
        <p><strong>No quiero:</strong> quien hizo el último canto válido cobra la apuesta anterior. Un Envido no querido vale 1 punto. <strong>Quiero:</strong> se juega por todos los puntos acumulados.</p>
        <p>Los cantos se pueden encadenar. Envido + Envido vale 4; Envido + Real Envido vale 5; dos Envidos + Real Envido valen 7. La Falta Envido completa la apuesta según el tanteador y la modalidad de la partida.</p>
      </section>
      <section>
        <h2>Truco <small className="portal-rule-kind">(canto)</small></h2>
        <p>Puede cantarse en cualquiera de las tres jugadas. El rival debe responder <strong>Quiero</strong> o <strong>No quiero</strong>. Solo quien recibió el canto puede subir al nivel siguiente.</p>
        <div className="portal-escalation"><div><strong>Truco</strong><span>No querido 1 · querido 2</span></div><b>→</b><div><strong>Retruco</strong><span>No querido 2 · querido 3</span></div><b>→</b><div><strong>Vale cuatro</strong><span>No querido 3 · querido 4</span></div></div>
        <p>Quien gana una jugada abre la siguiente. Si una jugada queda empatada, conserva la ventaja quien ganó la anterior; si la primera queda empatada, gana quien venza en la siguiente.</p>
      </section>
      <section><h2>Valores de las cartas</h2><p>Orden de la carta más alta a la más baja.</p><RankLadder /></section>
      <section><h2>Práctica</h2><p>Respondé y comprobá si ya podés sentarte a la mesa.</p><RulesQuiz questions={buildTraditionalQuiz} /></section>
    </div>
  );
}

function TrucolocoRules() {
  const tableRules = [
    ["Reparto", "Tres cartas de truco para cada jugador, una carta de armas para cada Cartachin, por último se revela una carta del Mazo Trucoloco y comienza la mano."],
    ["Mano no corta", "+1 punto al equipo que logra contacto, -1 al equipo golpeado y +2 al equipo que logra evadir."],
    ["Tiempo Arena", "El Negociador rival puede activar un reloj de dos minutos cuando alguien tarda en jugar su turno. No se puede avisar al propio equipo que el tiempo empezó."],
    ["Highlight", "El equipo que gana un Trucoloco querido y sus tres rondas recibe un Highlight. Quien lo genera puede inventar y desplegar una habilidad."],
    ["Ley L'Merk", "Los Negociadores deben acordar los puntos y estrecharse la mano antes de anotarlos."],
    ["El Hexágono", "Tablero con seis compartimientos y gafas que complican la visión y vuelven la mano más imprevisible. Las cartas del Mazo Trucoloco y del Mazo de Armas indican si deben usarlas seis, tres o dos personas."],
    ["Musicalización", "Pink Floyd."]
  ];
  const roles = [
    ["Negociador", "Administra el capital, apuesta, paga, argumenta, valida jugadas y acuerda con el rival.", "Negociación · Persuasión · Juez de jugadas · Validación de highlights."],
    ["Jugador Estrella", "Maneja la batuta y concentra los poderes especiales del equipo.", "Súper cantos · As si es MVP · Jaque · Jaque mate · Highlight."],
    ["Cartachin", "Maneja el Mazo de Armas y es el portador habitual de las espadas.", "Uso del Mazo de Armas."],
    ["Barman", "Hidrata a ambos equipos y funciona como mayordomo voluntario.", "Cada ficha recibida se cambia por un trago."]
  ];
  const sanctions = [["Salirse del personaje", "1p"], ["Caducidad del Tiempo Arena", "1p"], ["Conducta antideportiva", "2p"], ["Tocar cartas del oponente", "2p"], ["Uso reiterado del celular", "3p"], ["Ley L'Merk", "3p"], ["Abandonar", "4p"], ["Pantallear", "4p"], ["Cambiar la música", "5p"], ["Cartearse o hacer trampa", "10p"]];

  return (
    <div className="portal-rule-document">
      <section><p>Trucoloco toma el truco tradicional y agrega dos mazos: el <strong>Mazo Trucoloco</strong>, que establece el modo de cada mano, y el <strong>Mazo de Armas</strong>, que reparte poderes, defensas y trampas. Se juega 3 contra 3 con roles definidos.</p></section>
      <section><h2>Reglas de mesa</h2><div className="portal-table-rules">{tableRules.map(([name, copy]) => <article key={name}><h3>{name}</h3><p>{copy}</p></article>)}</div></section>
      <section><h2>Equipos y roles</h2><div className="portal-role-list">{roles.map(([name, copy, skills]) => <article key={name}><h3>{name}</h3><div><p>{copy}</p><strong>{skills}</strong></div></article>)}</div><div className="portal-rule-note"><strong>Fichines de favores</strong><span>Jugadores: 3 fichas. MVP: 4. Una ficha al Barman equivale a un trago; tres fichas al Negociador, a un favor.</span></div></section>
      <section><h2>Súper cantos</h2><p>Solo puede cantarlos el Jugador Estrella de cada equipo.</p><div className="portal-rule-panels"><article><h3>Súper envido</h3><p>Querido: 4 puntos. No querido: 2.</p></article><article><h3>Súper truco</h3><p>Querido: 4 puntos. No querido: 2.</p></article><article><h3>Trucoloco</h3><p>Querido: 8 puntos. No querido: 3. Anulado: 2. Para cobrar ocho hay que ganar las tres jugadas.</p></article></div></section>
      <section><h2>Mazo Trucoloco</h2><p>Lo controla el repartidor. Antes de cada mano se revela una carta y su regla gobierna la ronda.</p><CardGallery deck="trucoloco" names={TRUCOLOCO_CARD_NAMES} descriptions={TRUCOLOCO_DESCRIPTIONS} /></section>
      <section><h2>Mazo de Armas</h2><p>Lo maneja el Cartachin, salvo cuando una carta Trucoloco indique otra cosa.</p><CardGallery deck="armas" names={WEAPON_CARD_NAMES} descriptions={WEAPON_DESCRIPTIONS} /></section>
      <section><h2>Sanciones</h2><div className="portal-sanctions">{sanctions.map(([name, points]) => <div key={name}><span>{name}</span><strong>{points}</strong></div>)}</div><p className="portal-rule-note">Las sanciones se pagan con puntos de partido y pueden acordarse previamente entre los Negociadores.</p></section>
      <section><h2>Práctica</h2><RulesQuiz questions={COMPLETE_TRUCOLOCO_QUIZ} /></section>
    </div>
  );
}

function RulesSection() {
  const [topic, setTopic] = useState(null);
  if (!topic) {
    return (
      <section className="portal-section" aria-labelledby="portal-rules-title">
        <header className="portal-section-head portal-balanced-head"><h1 id="portal-rules-title">Reglas</h1><p>Elegí qué querés consultar.</p></header>
        <div className="portal-choice-grid portal-choice-grid-two">
          <button className="portal-choice-card" type="button" onClick={() => runPortalTransition(() => setTopic("comun"), { tone: "comun" })}><strong>Truco tradicional</strong><small>Reglas del juego, valores de las cartas, envido y truco.</small></button>
          <button className="portal-choice-card portal-choice-card-hot" type="button" onClick={() => runPortalTransition(() => setTopic("trucoloco"), { tone: "trucoloco" })}><strong>Trucoloco</strong><small>Reglas de mesa, roles, mazos y sanciones.</small></button>
        </div>
      </section>
    );
  }

  return (
    <section className="portal-section portal-rules-long portal-rules-detail" aria-labelledby="portal-rules-title">
      <button className="portal-back-button" type="button" aria-label="Volver" title="Volver" onClick={() => runPortalTransition(() => setTopic(null), { direction: "back", tone: topic })}><BackArrowIcon /></button>
      <header className="portal-section-head"><h1 id="portal-rules-title">{topic === "comun" ? "Truco tradicional" : "Trucoloco"}</h1><p>{topic === "comun" ? "Baraja española" : "Baraja española & barajas especiales"}</p></header>
      {topic === "comun" ? <TraditionalRules /> : <TrucolocoRules />}
    </section>
  );
}

export default function PortalApp() {
  const [activeSection, setActiveSection] = useState("home");
  // la URL es el estado: refrescar en el antro te deja en el antro, no en la portada
  const [gameOpen, setGameOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has("sala") || params.has("modo");
  });
  const [sectionResetKey, setSectionResetKey] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(() => !sfx.isMuted());
  const isHome = activeSection === "home";

  const toggleSound = () => {
    const nextEnabled = !soundEnabled;
    sfx.setMuted(!nextEnabled);
    if (nextEnabled) {
      sfx.ensure();
      if (!gameOpen) sfx.portalAmbient();
      sfx.tick();
    } else {
      sfx.stopPortalAmbient();
    }
    setSoundEnabled(nextEnabled);
  };

  const playButtonSound = (event) => {
    if (!soundEnabled || !event.target.closest("button")) return;
    sfx.ensure();
    if (!gameOpen) sfx.portalAmbient();
    sfx.tick();
  };

  useEffect(() => {
    document.documentElement.classList.toggle("portal-document", !gameOpen);
    return () => document.documentElement.classList.remove("portal-document");
  }, [gameOpen]);

  useEffect(() => {
    if (gameOpen || !soundEnabled) sfx.stopPortalAmbient();
    return () => { if (gameOpen) sfx.stopPortalAmbient(); };
  }, [gameOpen, soundEnabled]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); }, [activeSection, sectionResetKey]);

  const launchGame = (mode, intent = "bot") => {
    runPortalTransition(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("modo", mode);
      url.searchParams.set("jugar", intent);
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
      setGameOpen(true);
    }, { direction: "forward", tone: mode });
  };

  const returnToPortal = (destination = "home") => {
    runPortalTransition(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete("modo");
      url.searchParams.delete("jugar");
      url.searchParams.delete("sala");
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
      setGameOpen(false);
      setActiveSection(destination);
      setSectionResetKey((key) => key + 1);
    }, { direction: "back", tone: destination });
  };

  const navigate = (destination) => {
    runPortalTransition(() => {
      setActiveSection(destination);
      setSectionResetKey((key) => key + 1);
    }, { direction: destination === "home" ? "back" : "section", tone: destination });
  };

  if (gameOpen) {
    return (
      <div className="portal-game-frame" onPointerDownCapture={playButtonSound}>
        <div className="portal-game-stage">
          <Suspense fallback={<div className="portal-game-loading"><BrandMark /><span>Abriendo el antro…</span></div>}>
            <GameApp onExitToPortal={returnToPortal} />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className={isHome ? "portal-shell portal-shell-home" : `portal-shell portal-shell-section portal-shell-${activeSection}`} onPointerDownCapture={playButtonSound}>
      <div className="portal-suit portal-suit-sword" aria-hidden="true"><img src="/assets/brand/trucoloco-sword-hd.png" alt="" /></div>
      <div className="portal-suit portal-suit-coin" aria-hidden="true"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="43" /><circle className="portal-coin-inner" cx="50" cy="50" r="27" /><path className="portal-coin-rays" d="M50 14v9M50 77v9M14 50h9M77 50h9M24.5 24.5l6.4 6.4M69.1 69.1l6.4 6.4M75.5 24.5l-6.4 6.4M30.9 69.1l-6.4 6.4" /></svg></div>
      <div className="portal-suit portal-suit-cup" aria-hidden="true"><svg viewBox="0 0 100 120"><path d="M18 14h64c-2 28-13 43-32 43S20 42 18 14Z" /><path d="M50 57v35M31 103h38" /></svg></div>
      <div className="portal-suit portal-suit-club" aria-hidden="true"><svg viewBox="0 0 100 180"><path d="M26 166 34 132 72 18c4-12 22-6 18 7L53 140Z" /></svg></div>
      <button className="portal-sound-toggle" type="button" aria-label={soundEnabled ? "Silenciar sonido" : "Activar sonido"} title={soundEnabled ? "Silenciar sonido" : "Activar sonido"} aria-pressed={soundEnabled} onClick={toggleSound}><SoundIcon enabled={soundEnabled} /></button>
      <header className="portal-brand-stage">
        <div className="portal-brand-lockup">
          <BrandMark compact={!isHome} />
          <p>El truco, pero bien loco.</p>
          {isHome ? (
            <button className="portal-home-play" type="button" onClick={() => navigate("play")}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><PortalIcon name="play" /></svg>
              Jugar
            </button>
          ) : null}
        </div>
      </header>
      <main className="portal-content" aria-live="polite">
        {activeSection === "play" ? <PlaySection key={`play-${sectionResetKey}`} onLaunch={launchGame} /> : null}
        {activeSection === "score" ? <ScoreSection key={`score-${sectionResetKey}`} /> : null}
        {activeSection === "shop" ? <ShopSection /> : null}
        {activeSection === "rules" ? <RulesSection key={`rules-${sectionResetKey}`} /> : null}
      </main>
      <PortalNav activeSection={activeSection} onNavigate={navigate} />
    </div>
  );
}
