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
  ["sota", "jack", "10"],
  ["caballo", "queen", "11"],
  ["rey", "king", "12"]
];

const suits = [
  ["oro", "diamond", "Oro"],
  ["copa", "heart", "Copa"],
  ["espada", "spade", "Espada"],
  ["basto", "club", "Basto"]
];

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

    writeFileSync(
      join(frontsDir, `${rankId}-${suitId}.svg`),
      cardSvg({ sourceId, rankLabel, suitLabel })
    );
  }
}

console.log("Generated self-contained Wikimedia Spanish deck front SVGs.");
