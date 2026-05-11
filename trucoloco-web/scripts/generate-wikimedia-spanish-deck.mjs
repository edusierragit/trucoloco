import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const frontsDir = join(root, "public", "assets", "cards", "fronts");
const sourcePath = join(root, "public", "assets", "cards", "source", "baraja-espanola-wikimedia.svg");
const sourceSvg = readFileSync(sourcePath, "utf8");

mkdirSync(frontsDir, { recursive: true });

const cell = {
  width: 207,
  height: 318
};

const ranks = [
  ["ancho", "1", "1"],
  ["dos", "2", "2"],
  ["tres", "3", "3"],
  ["cuatro", "4", "4"],
  ["cinco", "5", "5"],
  ["seis", "6", "6"],
  ["siete", "7", "7"],
  ["sota", "10", "10"],
  ["caballo", "jack", "11"],
  ["rey", "queen", "12"]
];

const suits = [
  ["oro", "diamond", "Oro"],
  ["copa", "heart", "Copa"],
  ["espada", "spade", "Espada"],
  ["basto", "club", "Basto"]
];

const fallbackSuits = {
  oro: { label: "ORO", color: "#d6a329", dark: "#6e4311", code: "O" },
  copa: { label: "COPA", color: "#b8342b", dark: "#5e1514", code: "C" },
  espada: { label: "ESPADA", color: "#506a78", dark: "#172a35", code: "E" },
  basto: { label: "BASTO", color: "#4f8b34", dark: "#1d3917", code: "B" }
};

const cardBody = {
  x: 0.5,
  y: -871.13782
};

const layer = getTranslateNear("id=\"layer1\"", 8);
const sourceIds = suits.flatMap(([, sourceSuit]) => ranks.map(([, sourceRank]) => `${sourceRank}_${sourceSuit}`));
const firstCardStart = Math.min(...sourceIds.map((sourceId) => findGroupStart(sourceId)));
const sourcePrefix = preparePrefix(sourceSvg.slice(0, firstCardStart));

function cardSvg({ sourceId, rankLabel, suitLabel }) {
  const group = extractGroup(sourceId);
  const dependencies = collectDependencies(group);
  const body = getCardBodyTranslate(sourceId);
  const x = layer.x + body.group.x + body.use.x + cardBody.x;
  const y = layer.y + body.group.y + body.use.y + cardBody.y;
  const ariaLabel = `${rankLabel} de ${suitLabel}`;
  const viewBox = `${x} ${y} ${cell.width} ${cell.height}`;

  return sourcePrefix
    .replace(/<\?xml[^>]*>\s*/u, `<?xml version="1.0" encoding="UTF-8"?>\n`)
    .replace(/<!--[\s\S]*?-->\s*/u, "")
    .replace(/<svg\b[\s\S]*?>/u, (openingTag) => {
      const cleaned = openingTag
        .replace(/\swidth="[^"]*"/u, "")
        .replace(/\sheight="[^"]*"/u, "")
        .replace(/\sid="[^"]*"/u, "");

      return cleaned.replace(
        />$/u,
        ` width="420" height="644" viewBox="${viewBox}" role="img" aria-label="${ariaLabel}">`
      );
    }) + dependencies + group + "\n  </g>\n</svg>\n";
}

function preparePrefix(prefix) {
  return prefix.replace(/\s*$/u, "\n");
}

function getTranslateNear(marker, linesBack) {
  const lines = sourceSvg.split(/\r?\n/u);
  const index = lines.findIndex((line) => line.includes(marker));

  if (index === -1) throw new Error(`Missing marker ${marker}`);

  for (let lineIndex = index; lineIndex >= Math.max(0, index - linesBack); lineIndex -= 1) {
    const translate = parseTranslate(lines[lineIndex]);
    if (translate) return translate;
  }

  throw new Error(`Missing translate near ${marker}`);
}

function getCardBodyTranslate(sourceId) {
  const lines = sourceSvg.split(/\r?\n/u);
  const index = lines.findIndex((line) => line.includes(`id="${sourceId}"`));

  if (index === -1) throw new Error(`Missing card ${sourceId}`);

  let group = null;
  for (let lineIndex = index; lineIndex >= Math.max(0, index - 8); lineIndex -= 1) {
    group = parseTranslate(lines[lineIndex]);
    if (group) break;
  }

  if (!group) throw new Error(`Missing card group transform for ${sourceId}`);

  for (let lineIndex = index; lineIndex < lines.length; lineIndex += 1) {
    if (!lines[lineIndex].includes('xlink:href="#card_body"')) continue;

    for (let scanIndex = lineIndex; scanIndex >= Math.max(index, lineIndex - 8); scanIndex -= 1) {
      const use = parseTranslate(lines[scanIndex]);
      if (use) return { group, use };
    }
  }

  throw new Error(`Missing card body transform for ${sourceId}`);
}

function parseTranslate(line) {
  const match = line?.match(/transform="translate\(([-0-9.e]+),([-0-9.e]+)\)"/u);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

function findGroupStart(sourceId) {
  const idIndex = sourceSvg.indexOf(`id="${sourceId}"`);
  if (idIndex === -1) throw new Error(`Missing card group ${sourceId}`);

  return sourceSvg.lastIndexOf("<g", idIndex);
}

function extractGroup(sourceId) {
  const start = findGroupStart(sourceId);
  const tagPattern = /<\/?g\b[^>]*>/gu;
  tagPattern.lastIndex = start;

  let depth = 0;
  let match;

  while ((match = tagPattern.exec(sourceSvg))) {
    if (!match[0].endsWith("/>")) {
      depth += match[0].startsWith("</") ? -1 : 1;
    }

    if (depth === 0) {
      return sourceSvg.slice(start, tagPattern.lastIndex);
    }
  }

  throw new Error(`Unclosed group ${sourceId}`);
}

function collectDependencies(cardGroup) {
  let dependencies = "";

  while (true) {
    const svg = sourcePrefix + dependencies + cardGroup;
    const ids = getIds(svg);
    const refs = getRefs(svg);
    const missing = refs.filter((ref) => !ids.has(ref));

    if (missing.length === 0) return dependencies;

    for (const id of new Set(missing)) {
      dependencies += extractElementById(id) + "\n";
    }
  }
}

function getIds(svg) {
  return new Set([...svg.matchAll(/\sid="([^"]+)"/gu)].map((match) => match[1]));
}

function getRefs(svg) {
  return [...new Set([...svg.matchAll(/xlink:href="#([^"]+)"/gu)].map((match) => match[1]).filter((id) => id !== "(null)"))];
}

function extractElementById(id) {
  const idIndex = sourceSvg.indexOf(`id="${id}"`);
  if (idIndex === -1) throw new Error(`Missing referenced id ${id}`);

  const start = sourceSvg.lastIndexOf("<", idIndex);
  const tagMatch = sourceSvg.slice(start, start + 80).match(/^<([a-zA-Z0-9:_-]+)/u);

  if (!tagMatch) throw new Error(`Missing tag for referenced id ${id}`);
  if (tagMatch[1] === "g") return extractGroup(id);

  const openEnd = sourceSvg.indexOf(">", start) + 1;
  if (sourceSvg.slice(start, openEnd).endsWith("/>")) return sourceSvg.slice(start, openEnd);

  const closeTag = `</${tagMatch[1]}>`;
  const end = sourceSvg.indexOf(closeTag, openEnd);
  if (end === -1) throw new Error(`Unclosed referenced id ${id}`);

  return sourceSvg.slice(start, end + closeTag.length);
}

for (const [suitId, sourceSuit, suitLabel] of suits) {
  for (const [rankId, sourceRank, rankLabel] of ranks) {
    const sourceId = `${sourceRank}_${sourceSuit}`;
    const isFigure = rankId === "sota" || rankId === "caballo" || rankId === "rey";

    writeFileSync(
      join(frontsDir, `${rankId}-${suitId}.svg`),
      isFigure
        ? figureCardSvg({ rankId, rankLabel, suit: fallbackSuits[suitId] })
        : cardSvg({ sourceId, rankLabel, suitLabel })
    );
  }
}

console.log("Generated self-contained Wikimedia Spanish deck front SVGs.");

function figureCardSvg({ rankId, rankLabel, suit }) {
  const title = rankId === "sota" ? "SOTA" : rankId === "caballo" ? "CABALLO" : "REY";
  const crest = suitSymbol(suit, 1.28);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="644" viewBox="0 0 420 644" role="img" aria-label="${rankLabel} de ${suit.label}">
  <defs>
    <linearGradient id="paper" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#fffdf7"/>
      <stop offset="0.58" stop-color="#f4efe2"/>
      <stop offset="1" stop-color="#e6ddc8"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#20140b" flood-opacity="0.22"/>
    </filter>
  </defs>
  <rect x="1" y="1" width="418" height="642" rx="30" fill="url(#paper)" stroke="#1b1713" stroke-width="2"/>
  <rect x="28" y="28" width="364" height="588" fill="none" stroke="#1f1d19" stroke-width="2"/>
  <path d="M80 28h54M194 28h54M308 28h54M80 616h54M194 616h54M308 616h54" stroke="#1f1d19" stroke-width="3" stroke-linecap="square"/>
  ${corner(rankLabel, suit, 50, 70, 0)}
  ${corner(rankLabel, suit, 370, 574, 180)}
  <g filter="url(#softShadow)">
    <rect x="116" y="124" width="188" height="356" rx="24" fill="#f8f1df" stroke="${suit.dark}" stroke-width="4"/>
    <rect x="136" y="146" width="148" height="312" rx="16" fill="#ffffff" stroke="${suit.color}" stroke-width="3" opacity="0.84"/>
    <g transform="translate(210 255)">
      ${crest}
    </g>
    <path d="M149 358C166 326 254 326 271 358L286 431H134Z" fill="${suit.color}" stroke="${suit.dark}" stroke-width="6" stroke-linejoin="round"/>
    <path d="M165 385H255M171 414H249" stroke="#f7e5bd" stroke-width="5" stroke-linecap="round" opacity="0.66"/>
    <text x="210" y="433" text-anchor="middle" font-family="Georgia, serif" font-size="58" font-weight="800" fill="#fff1cd" stroke="${suit.dark}" stroke-width="2">${rankLabel}</text>
  </g>
  <text x="210" y="538" text-anchor="middle" font-family="Georgia, serif" font-size="31" font-weight="800" fill="${suit.dark}" letter-spacing="4">${title}</text>
  <text x="210" y="568" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="900" fill="${suit.color}" letter-spacing="5">${suit.label}</text>
</svg>
`;
}

function corner(rankLabel, suit, x, y, rotation) {
  return `<g transform="translate(${x} ${y}) rotate(${rotation})">
    <text x="0" y="0" text-anchor="middle" font-family="Georgia, serif" font-size="48" fill="#111">${rankLabel}</text>
    <text x="0" y="28" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" font-weight="900" fill="${suit.color}">${suit.code}</text>
  </g>`;
}

function suitSymbol(suit, scale = 1) {
  const symbols = {
    ORO: `<circle cx="0" cy="0" r="44" fill="#f3ca32" stroke="${suit.dark}" stroke-width="6"/><circle cx="0" cy="0" r="24" fill="#ffe777" stroke="#8f5a12" stroke-width="3"/><path d="M-24 0H24M0-24V24" stroke="#8f5a12" stroke-width="5" stroke-linecap="round"/>`,
    COPA: `<path d="M-38-42H38L29 18C24 50-24 50-29 18Z" fill="${suit.color}" stroke="${suit.dark}" stroke-width="6" stroke-linejoin="round"/><path d="M0 44V78M-30 78H30" stroke="${suit.dark}" stroke-width="8" stroke-linecap="round"/><path d="M-22-23H22L16 12C13 27-13 27-16 12Z" fill="#f0d4a6" opacity="0.38"/>`,
    ESPADA: `<path d="M0-74C21-35 25-4 8 25L0 38L-8 25C-25-4-21-35 0-74Z" fill="#dbe2e2" stroke="${suit.dark}" stroke-width="6" stroke-linejoin="round"/><path d="M-36 36H36M0 38V82" stroke="${suit.color}" stroke-width="9" stroke-linecap="round"/><circle cx="0" cy="36" r="10" fill="${suit.dark}"/>`,
    BASTO: `<g transform="rotate(-24)"><rect x="-17" y="-76" width="34" height="152" rx="16" fill="#75a51f" stroke="${suit.dark}" stroke-width="6"/><path d="M-10-50L10 54" stroke="#ffe45a" stroke-width="8" stroke-linecap="round"/><path d="M-17-34H17M-17 8H17M-17 48H17" stroke="#17300d" stroke-width="4" stroke-linecap="round" opacity="0.55"/></g>`
  };

  return `<g transform="scale(${scale})">${symbols[suit.label]}</g>`;
}
