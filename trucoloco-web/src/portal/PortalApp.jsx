import { lazy, Suspense, useEffect, useState } from "react";

const GameApp = lazy(() => import("../App"));

const NAV_ITEMS = [
  { id: "home", label: "Inicio", icon: "home" },
  { id: "play", label: "Jugar", icon: "play" },
  { id: "score", label: "Anotador", icon: "score" },
  { id: "shop", label: "Tienda", icon: "shop" },
  { id: "rules", label: "Reglas", icon: "rules" }
];

const INDIVIDUAL_RANKING = [
  ["Alma Ríos", "Negociante", 1840],
  ["Toto Ferreyra", "Jugador Estrella", 1710],
  ["Lola Benítez", "Cartachin", 1655],
  ["Nico Sosa", "Negociante", 1520],
  ["Mora Paz", "Jugador Estrella", 1485],
  ["Bauti Luna", "Cartachin", 1390]
];

const TEAM_RANKING = [
  ["Los Anchos", ["Alma · Negociante", "Toto · Jugador Estrella", "Lola · Cartachin"], 5220],
  ["La Revancha", ["Nico · Negociante", "Mora · Jugador Estrella", "Bauti · Cartachin"], 4890],
  ["Mesa Brava", ["Cata · Negociante", "Joaco · Jugador Estrella", "Lucho · Cartachin"], 4610],
  ["Flor y Truco", ["Mili · Negociante", "Teo · Jugador Estrella", "Paz · Cartachin"], 4380],
  ["Los del Fondo", ["Ivo · Negociante", "Uma · Jugador Estrella", "Fran · Cartachin"], 4120],
  ["Sin Miedo", ["Sol · Negociante", "Dante · Jugador Estrella", "Romi · Cartachin"], 3975]
];

const RANK_LADDER = [
  ["Ancho de espadas · El Macho", [[1, "espadas"]]],
  ["Ancho de bastos · La Bota", [[1, "bastos"]]],
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
  ["¿Cuándo puede cantarse el envido?", ["En cualquier ronda", "Durante la primera", "Después del Truco"], 1]
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

const RANK_EXAMPLES = ["Ancho de espadas", "Ancho de bastos", "7 de espadas", "7 de oros", "3 de copas", "2 de oros", "Ancho de copas", "Rey de bastos", "Caballo de oros", "Sota de espadas", "7 de copas", "6 de bastos", "5 de oros", "4 de copas"];
const RANK_QUIZ = RANK_EXAMPLES.flatMap((higher, higherIndex) => RANK_EXAMPLES.slice(higherIndex + 1).map((lower, offset) => {
  const reversed = (higherIndex + offset) % 2 === 0;
  return [`¿Qué carta es más alta?`, reversed ? [lower, higher] : [higher, lower], reversed ? 1 : 0];
}));
const COMPLETE_TRADITIONAL_QUIZ = [...TRADITIONAL_QUIZ, ...RANK_QUIZ];

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

function PortalIcon({ name }) {
  if (name === "home") return <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13v-9.5" /></>;
  if (name === "play") return <path d="m7 4 12 8-12 8Z" />;
  if (name === "score") return <><rect x="5" y="4" width="14" height="16" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>;
  if (name === "shop") return <><path d="M4 9h16l-1.5-5h-13Z" /><path d="M5 9v11h14V9" /></>;
  return <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 17h.01" /></>;
}

function BackArrowIcon() {
  return <svg viewBox="0 0 28 28" aria-hidden="true"><path d="M23 21c0-7-3.7-10.5-10.8-10.5H5" /><path d="m10 5.5-5 5 5 5" /></svg>;
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
    <div className="portal-ranking-panel portal-reveal-panel" aria-label="Ranking de muestra">
      <div className="portal-panel-heading"><span>Ranking</span><small>Top 6 · datos de muestra</small></div>
      <div className="portal-ranking-columns">
        <section>
          <h2>Individual</h2>
          <ol>{INDIVIDUAL_RANKING.map(([name, role, points]) => <li key={name}><b>{name}</b>{showRoles ? <span>{role}</span> : null}<strong>{points} pts.</strong></li>)}</ol>
        </section>
        <section>
          <h2>Por equipos</h2>
          <ol>{TEAM_RANKING.map(([team, players, points]) => <li key={team}><b>{team}</b><span>{players.map((player) => showRoles ? player : player.split(" · ")[0]).join(" · ")}</span><strong>{points} pts.</strong></li>)}</ol>
        </section>
      </div>
    </div>
  );
}

function PlaySection({ onLaunch }) {
  const [selectedMode, setSelectedMode] = useState(null);
  const [openPanel, setOpenPanel] = useState(null);
  const [teamNames, setTeamNames] = useState(["", ""]);
  const [teamsReady, setTeamsReady] = useState([false, false]);
  const [launchingMode, setLaunchingMode] = useState(null);
  const modeLabel = selectedMode === "comun" ? "Truco tradicional" : "Trucoloco";

  useEffect(() => {
    if (!launchingMode) return undefined;
    const timer = window.setTimeout(() => onLaunch(launchingMode), 1350);
    return () => window.clearTimeout(timer);
  }, [launchingMode, onLaunch]);

  const openMode = (mode) => {
    setSelectedMode(mode);
    setOpenPanel(null);
    setTeamNames(["", ""]);
    setTeamsReady([false, false]);
  };

  const closeMode = () => {
    setSelectedMode(null);
    setOpenPanel(null);
    setTeamNames(["", ""]);
    setTeamsReady([false, false]);
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
    if (nextReady.every(Boolean)) setLaunchingMode(selectedMode);
  };

  const cancelTeam = (teamIndex) => {
    const nextNames = [...teamNames];
    const nextReady = [...teamsReady];
    nextNames[teamIndex] = "";
    nextReady[teamIndex] = false;
    setTeamNames(nextNames);
    setTeamsReady(nextReady);
  };

  if (selectedMode) {
    return (
      <section className="portal-section portal-play-selected" aria-labelledby="portal-play-title">
        <button className="portal-back-button" type="button" aria-label="Volver" title="Volver" onClick={closeMode}><BackArrowIcon /></button>
        <header className="portal-section-head portal-mode-heading">
          <h1 id="portal-play-title">{modeLabel}</h1>
          <p>Elegí cómo jugar.</p>
        </header>
        <div className="portal-play-actions portal-actions-unfold">
          <button type="button" onClick={() => setLaunchingMode(selectedMode)}><svg viewBox="0 0 24 24" aria-hidden="true"><PortalIcon name="play" /></svg><strong>Jugar con un bot</strong><small>Entrá directo a una partida.</small></button>
          <button type="button" onClick={() => setLaunchingMode(selectedMode)}><svg viewBox="0 0 24 24" aria-hidden="true"><PortalIcon name="play" /></svg><strong>Jugar online</strong><small>Entrá a la mesa online.</small></button>
          <button className={openPanel === "tournament" ? "portal-action-active" : ""} type="button" aria-pressed={openPanel === "tournament"} onClick={() => setOpenPanel((current) => current === "tournament" ? null : "tournament")}><svg viewBox="0 0 24 24" aria-hidden="true"><PortalIcon name="play" /></svg><strong>Torneo</strong><small>Clasificatoria al mejor de tres.</small></button>
          <button className={openPanel === "ranking" ? "portal-action-active" : ""} type="button" aria-pressed={openPanel === "ranking"} onClick={() => setOpenPanel((current) => current === "ranking" ? null : "ranking")}><svg viewBox="0 0 24 24" aria-hidden="true"><PortalIcon name="score" /></svg><strong>Ranking</strong><small>Individual y por equipos.</small></button>
        </div>
        {openPanel === "tournament" ? (
          <div className="portal-tournament-setup portal-reveal-panel" aria-label="Clasificatoria del torneo">
            <div className="portal-panel-heading"><span>Clasificatoria</span><small>Los dos equipos deben confirmar para entrar.</small></div>
            <div className="portal-tournament-match">
              {[0, 1].map((teamIndex) => (
                <div className={teamsReady[teamIndex] ? "portal-team-entry portal-team-ready" : "portal-team-entry"} key={teamIndex}>
                  <label htmlFor={`portal-team-${teamIndex}`}>Equipo {teamIndex + 1}</label>
                  <input id={`portal-team-${teamIndex}`} type="text" value={teamNames[teamIndex]} maxLength={24} disabled={teamsReady[teamIndex]} placeholder="Nombre del equipo" onChange={(event) => setTeamNames((current) => current.map((name, index) => index === teamIndex ? event.target.value : name))} />
                  <div><button type="button" disabled={!teamNames[teamIndex].trim() || teamsReady[teamIndex]} onClick={() => confirmTeam(teamIndex)}>OK</button><button type="button" disabled={!teamNames[teamIndex] && !teamsReady[teamIndex]} onClick={() => cancelTeam(teamIndex)}>Cancelar</button></div>
                  <small>{teamsReady[teamIndex] ? "Listo para jugar" : "Esperando confirmación"}</small>
                </div>
              ))}
              <span className="portal-versus">VS</span>
            </div>
          </div>
        ) : null}
        {openPanel === "ranking" ? <RankingPanel mode={selectedMode} /> : null}
        {launchingMode ? <div className={`portal-launch-transition portal-launch-${launchingMode}`} aria-live="assertive"><div className="portal-smoke portal-smoke-one" /><div className="portal-smoke portal-smoke-two" /><div className="portal-smoke portal-smoke-three" /><strong>{launchingMode === "trucoloco" ? "Entrando a la locura…" : "Entrando a la mesa…"}</strong></div> : null}
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
          {[15, 30].map((value) => <button className="portal-choice-card portal-score-target" type="button" key={value} onClick={() => setTarget(value)}><span>A</span><strong>{value}</strong><small>puntos</small></button>)}
        </div>
      </section>
    );
  }

  return (
    <section className="portal-section" aria-labelledby="portal-score-title">
      <header className="portal-section-head portal-score-head">
        <h1 id="portal-score-title">Partida a {target} puntos</h1>
        <button className="portal-text-button" type="button" onClick={() => { setTarget(null); setScores({ us: 0, them: 0 }); }}>Cambiar partida</button>
      </header>
      <div className="portal-scoreboard">
        {[["us", "Nosotros"], ["them", "Ellos"]].map(([side, label]) => (
          <div className="portal-score-side" key={side}>
            <span>{label}</span><strong>{scores[side] >= target ? (side === "us" ? "¡Ganamos!" : "¡Ganaron!") : scores[side]}</strong>
            <div><button type="button" aria-label={`Restar a ${label}`} onClick={() => adjust(side, -1)}>−</button><button type="button" aria-label={`Sumar a ${label}`} onClick={() => adjust(side, 1)}>+</button></div>
          </div>
        ))}
      </div>
      <button className="portal-reset" type="button" onClick={() => setScores({ us: 0, them: 0 })}>Nueva partida</button>
    </section>
  );
}

function DeckFan({ type }) {
  if (type === "gazpacho") {
    return <div className="portal-deck-image portal-product-spin"><img src="/assets/shop/gazpacho-court-fan.png" alt="Tres figuras del Mazo Gazpacho con los rostros de Gazpacho" /></div>;
  }
  if (type === "trazos") {
    return <div className="portal-deck-fan portal-product-spin" aria-label="Tres cartas de ejemplo del Mazo Trazos">{[[7, "oros"], [1, "espadas"], [3, "copas"]].map(([rank, suit], index) => <div className={`portal-fan-card portal-fan-${index + 1} portal-trazos-card`} key={suit}><b>{rank}</b><SuitGlyph suit={suit} /></div>)}</div>;
  }
  return (
    <div className="portal-spanish-deck" aria-label="Mazo español visto desde arriba">
      <span className="portal-deck-layer portal-deck-layer-three" />
      <span className="portal-deck-layer portal-deck-layer-two" />
      <img src="/assets/cards/fronts/ancho-espada.svg" alt="Ancho de espadas sobre el mazo español" />
    </div>
  );
}

function ShopExtraVisual({ type }) {
  if (type === "lentes") {
    return <div className="portal-extra-visual portal-glasses-preview" aria-hidden="true"><span className="portal-extra-item">◇—◇</span><span className="portal-extra-item">○—○</span><span className="portal-extra-item">⬡—⬡</span></div>;
  }
  if (type === "skins") {
    return (
      <div className="portal-extra-visual portal-skins-preview" aria-label="Smoking de Negociante, ropa de golf y traje de Cartachin">
        <span className="portal-extra-item" title="Negociante"><svg viewBox="0 0 64 88"><path d="M22 9 8 20l5 58h38l5-58L42 9l-10 9Z" /><path d="m22 9 10 9 10-9M25 19l7 10 7-10M32 29v49" /><circle cx="27" cy="38" r="1" /><circle cx="27" cy="48" r="1" /></svg></span>
        <span className="portal-extra-item" title="Jugador Estrella"><svg viewBox="0 0 64 88"><path d="M20 11 8 23l7 18 7-8v45h24V33l7 8 3-18-12-12-12 8Z" /><path d="M20 11c2 8 22 8 24 0M22 52h24M49 12l7-8" /></svg></span>
        <span className="portal-extra-item" title="Cartachin"><svg viewBox="0 0 64 88"><path d="M20 9 7 22l10 17 5-7-5 46h30l-5-46 5 7 10-17L44 9 32 19Z" /><path d="m20 9 12 10L44 9M18 48h28M17 55h30M13 52h38" /></svg></span>
      </div>
    );
  }
  return <div className="portal-extra-visual portal-chips-preview" aria-label="Montón de fichines verdes y dorados"><img src="/assets/shop/fichines-premium.png" alt="Montón de fichines verdes y dorados en relieve" /></div>;
}

function ShopSection() {
  const decks = [
    ["Incluido", "Mazo español", "La baraja de toda la vida.", null, "espanol"],
    ["Próximamente", "Mazo Trazos", "El truco de siempre, dibujado con otra elegancia.", "$ --", "trazos"],
    ["Próximamente", "Mazo Gazpacho", "Una edición especial del mejor Jugador Estrella de Trucoloco.", "$ --", "gazpacho"]
  ];
  const extras = [
    ["Lentes del Hexágono", "Modelos absurdos para llevar el caos al siguiente nivel.", "$ --", "lentes"],
    ["Skins de personajes", "Smoking de Negociante, golfista estrella y traje de Cartachin.", "$ --", "skins"],
    ["Fichines", "Fichas para favores.", "$ --", "fichines"]
  ];
  return (
    <section className="portal-section" aria-labelledby="portal-shop-title">
      <header className="portal-section-head portal-shop-head portal-balanced-head"><h1 id="portal-shop-title">Tienda</h1><p>Equipá tu mesa.</p></header>
      <div className="portal-shop-grid">{decks.map(([status, name, copy, price, type]) => <article className="portal-shop-card" key={name}><strong>{name} <small>({status})</small></strong><DeckFan type={type} /><p>{copy}</p>{price ? <b>{price}</b> : null}</article>)}</div>
      <div className="portal-shop-grid portal-shop-grid-extras">{extras.map(([name, copy, price, type]) => <article className="portal-shop-card" key={name}><strong>{name} <small>(Próximamente)</small></strong><ShopExtraVisual type={type} /><p>{copy}</p><b>{price}</b></article>)}</div>
      <div className="portal-coming-soon"><strong>Todavía no se puede comprar nada acá.</strong><span>Esta sección es una vista previa de la tienda.</span></div>
    </section>
  );
}

function SuitGlyph({ suit }) {
  if (suit === "oros") return <svg className="portal-suit-glyph" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /></svg>;
  if (suit === "copas") return <svg className="portal-suit-glyph" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14c-1 6-3 9-7 9S6 10 5 4Z" /><path d="M12 13v5M8 20h8" /></svg>;
  if (suit === "bastos") return <svg className="portal-suit-glyph portal-suit-glyph-bat" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 21c-1-1-1-3 0-4L16 3c1-2 4 0 3 2l-8 15c-1 2-3 2-4 1Z" /></svg>;
  return <img className="portal-suit-glyph portal-suit-glyph-sword" src="/assets/brand/trucoloco-sword-hd.png" alt="" />;
}

function RankLadder() {
  return (
    <div className="portal-rank-ladder">
      {RANK_LADDER.map(([label, cards], index) => (
        <div className="portal-rank-row" key={label}>
          <span className="portal-rank-position">{index + 1}</span>
          <div className="portal-mini-cards">
            {cards.map(([rank, suit]) => <div className="portal-mini-card" key={`${rank}-${suit}`}><b>{rank}</b><SuitGlyph suit={suit} /></div>)}
          </div>
          <strong>{label}</strong>
        </div>
      ))}
    </div>
  );
}

function RulesQuiz({ questions }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const question = questions[index];

  if (!question) {
    return (
      <div className="portal-quiz-result">
        <strong>{score} respuestas correctas</strong>
        <p>{score === questions.length ? "Perfecto. La mesa ya no tiene secretos." : "Buen intento. Podés volver a practicar cuando quieras."}</p>
        <button type="button" onClick={() => { setIndex(0); setSelected(null); setScore(0); }}>Reintentar</button>
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
      {selected !== null ? <button className="portal-quiz-next" type="button" onClick={() => { setIndex((current) => current + 1); setSelected(null); }}>{index === questions.length - 1 ? "Ver resultado" : "Siguiente"}</button> : null}
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
      <section><h2>Práctica</h2><p>Respondé y comprobá si ya podés sentarte a la mesa.</p><RulesQuiz questions={COMPLETE_TRADITIONAL_QUIZ} /></section>
    </div>
  );
}

function TrucolocoRules() {
  const tableRules = [
    ["Reparto", "Tres cartas de truco para cada jugador; después, una carta de armas para cada Cartachin. Por último se revela una carta del Mazo Trucoloco y comienza la mano."],
    ["Mano no corta", "+1 punto al equipo que logra contacto, -1 al equipo golpeado y +2 al equipo que logra evadir."],
    ["Tiempo Arena", "El Negociador rival puede activar un reloj de dos minutos cuando alguien tarda. No se puede avisar al propio equipo que el tiempo empezó."],
    ["Versus", "Se resuelve apenas aparece la carta, como un paréntesis antes de continuar con el envido o el truco. Sus puntos cuentan para el marcador."],
    ["Torneo Z", "Duelo de Jugadores Estrella al mejor de nueve. No puede terminar empatado."],
    ["Highlight", "Una jugada maestra permite a quien la genera inventar y desplegar una habilidad."],
    ["Ley L'Merk", "Los Negociadores deben acordar los puntos y estrecharse la mano antes de anotarlos."],
    ["El Hexágono", "Tablero con seis compartimientos y gafas. La carta indica si deben usarlas seis, tres o dos personas."],
    ["Sustancia X", "Da invencibilidad ante las armas durante la mano y habilita una habilidad inventada."],
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
      <section><p>Trucoloco toma el truco tradicional y agrega dos mazos: el <strong>Mazo Trucoloco</strong>, que altera la mano completa, y el <strong>Mazo de Armas</strong>, que reparte poderes, defensas y trampas. Se juega 3 contra 3 con roles definidos.</p></section>
      <section><h2>Reglas de mesa</h2><div className="portal-rule-panels">{tableRules.map(([name, copy]) => <article key={name}><h3>{name}</h3><p>{copy}</p></article>)}</div></section>
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
          <button className="portal-choice-card" type="button" onClick={() => setTopic("comun")}><strong>Truco tradicional</strong><small>Reglas del juego, valores de las cartas, envido y truco.</small></button>
          <button className="portal-choice-card portal-choice-card-hot" type="button" onClick={() => setTopic("trucoloco")}><strong>Trucoloco</strong><small>Reglas de mesa, roles, mazos y sanciones.</small></button>
        </div>
      </section>
    );
  }

  return (
    <section className="portal-section portal-rules-long portal-rules-detail" aria-labelledby="portal-rules-title">
      <button className="portal-back-button" type="button" aria-label="Volver" title="Volver" onClick={() => setTopic(null)}><BackArrowIcon /></button>
      <header className="portal-section-head"><h1 id="portal-rules-title">{topic === "comun" ? "Truco tradicional" : "Trucoloco"}</h1><p>{topic === "comun" ? "Baraja española" : "Baraja española & barajas especiales"}</p></header>
      {topic === "comun" ? <TraditionalRules /> : <TrucolocoRules />}
    </section>
  );
}

export default function PortalApp() {
  const [activeSection, setActiveSection] = useState("home");
  const [gameOpen, setGameOpen] = useState(() => new URLSearchParams(window.location.search).has("sala"));
  const [sectionResetKey, setSectionResetKey] = useState(0);
  const [navigationRequest, setNavigationRequest] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const isHome = activeSection === "home";

  useEffect(() => {
    document.documentElement.classList.toggle("portal-document", !gameOpen);
    return () => document.documentElement.classList.remove("portal-document");
  }, [gameOpen]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); }, [activeSection, sectionResetKey]);

  const launchGame = (mode) => {
    const url = new URL(window.location.href);
    url.searchParams.set("modo", mode);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    setGameOpen(true);
  };

  const returnToPortal = (destination = "home") => {
    const url = new URL(window.location.href);
    url.searchParams.delete("modo");
    url.searchParams.delete("sala");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    setGameOpen(false);
    setActiveSection(destination);
    setSectionResetKey((key) => key + 1);
    setNavigationRequest(null);
  };

  const navigate = (destination) => {
    if (gameOpen) {
      setNavigationRequest({ destination, token: Date.now() });
      return;
    }
    setActiveSection(destination);
    setSectionResetKey((key) => key + 1);
  };

  if (gameOpen) {
    return (
      <div className="portal-game-frame">
        <PortalNav activeSection="play" onNavigate={navigate} game />
        <div className="portal-game-stage">
          <Suspense fallback={<div className="portal-game-loading"><BrandMark /><span>Abriendo el antro…</span></div>}>
            <GameApp onExitToPortal={returnToPortal} portalNavigationRequest={navigationRequest} />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className={isHome ? "portal-shell portal-shell-home" : "portal-shell portal-shell-section"}>
      <div className="portal-suit portal-suit-sword" aria-hidden="true"><img src="/assets/brand/trucoloco-sword-hd.png" alt="" /></div>
      <div className="portal-suit portal-suit-coin" aria-hidden="true"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="43" /><circle cx="50" cy="50" r="29" /></svg></div>
      <div className="portal-suit portal-suit-cup" aria-hidden="true"><svg viewBox="0 0 100 120"><path d="M18 14h64c-2 28-13 43-32 43S20 42 18 14Z" /><path d="M50 57v35M31 103h38" /></svg></div>
      <div className="portal-suit portal-suit-club" aria-hidden="true"><img src="/assets/shop/basto-reference.png" alt="" /></div>
      {isHome ? <button className="portal-login-button" type="button" onClick={() => setAuthOpen(true)}>Iniciar sesión</button> : null}
      <header className="portal-brand-stage">
        <div className="portal-brand-lockup">
          <BrandMark compact={!isHome} />
          <p>El truco, pero bien loco.</p>
        </div>
      </header>
      <main className="portal-content" aria-live="polite">
        {activeSection === "play" ? <PlaySection key={`play-${sectionResetKey}`} onLaunch={launchGame} /> : null}
        {activeSection === "score" ? <ScoreSection key={`score-${sectionResetKey}`} /> : null}
        {activeSection === "shop" ? <ShopSection /> : null}
        {activeSection === "rules" ? <RulesSection key={`rules-${sectionResetKey}`} /> : null}
      </main>
      <PortalNav activeSection={activeSection} onNavigate={navigate} />
      {authOpen ? (
        <div className="portal-auth-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false); }}>
          <section className="portal-auth-modal" role="dialog" aria-modal="true" aria-labelledby="portal-auth-title">
            <button className="portal-auth-close" type="button" aria-label="Cerrar" onClick={() => setAuthOpen(false)}>×</button>
            <span>Próximamente</span>
            <h2 id="portal-auth-title">Creá tu perfil</h2>
            <p>Esta es una muestra del acceso. Las cuentas reales se habilitarán más adelante.</p>
            <form onSubmit={(event) => event.preventDefault()}>
              <label>Nombre<input type="text" placeholder="Tu nombre" /></label>
              <label>Email<input type="email" placeholder="nombre@email.com" /></label>
              <label>Fecha de nacimiento<input type="date" /></label>
              <small>Solo pueden crear una cuenta las personas mayores de 18 años.</small>
              <button type="submit" disabled>Crear cuenta</button>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
