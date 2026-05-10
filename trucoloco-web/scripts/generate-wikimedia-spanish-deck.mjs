import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const frontsDir = join(root, "public", "assets", "cards", "fronts");
const sourceHref = "/assets/cards/source/baraja-espanola-wikimedia.svg";

mkdirSync(frontsDir, { recursive: true });

const sheet = {
  width: 2496,
  height: 1595.0004,
  columns: 12,
  rows: 5
};

const cell = {
  width: sheet.width / sheet.columns,
  height: 319
};

const ranks = [
  ["ancho", 0, "1"],
  ["dos", 1, "2"],
  ["tres", 2, "3"],
  ["cuatro", 3, "4"],
  ["cinco", 4, "5"],
  ["seis", 5, "6"],
  ["siete", 6, "7"],
  ["sota", 9, "10"],
  ["caballo", 10, "11"],
  ["rey", 11, "12"]
];

const suits = [
  ["oro", 0, "Oro"],
  ["copa", 1, "Copa"],
  ["espada", 2, "Espada"],
  ["basto", 3, "Basto"]
];

function cardSvg({ col, row, rankLabel, suitLabel }) {
  const x = col * cell.width;
  const y = row * cell.height;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="644" viewBox="0 0 ${cell.width} ${cell.height}" role="img" aria-label="${rankLabel} de ${suitLabel}">
  <rect width="${cell.width}" height="${cell.height}" rx="10" fill="#f4ecd9"/>
  <image href="${sourceHref}" x="${-x}" y="${-y}" width="${sheet.width}" height="${sheet.height}"/>
</svg>
`;
}

for (const [suitId, row, suitLabel] of suits) {
  for (const [rankId, col, rankLabel] of ranks) {
    writeFileSync(
      join(frontsDir, `${rankId}-${suitId}.svg`),
      cardSvg({ col, row, rankLabel, suitLabel })
    );
  }
}

console.log("Generated Wikimedia Spanish deck front SVG wrappers.");
