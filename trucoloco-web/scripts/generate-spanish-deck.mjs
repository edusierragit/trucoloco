import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const frontsDir = join(root, "public", "assets", "cards", "fronts");
const backsDir = join(root, "public", "assets", "cards", "backs");

mkdirSync(frontsDir, { recursive: true });
mkdirSync(backsDir, { recursive: true });

const ranks = [
  ["ancho", "1"],
  ["dos", "2"],
  ["tres", "3"],
  ["cuatro", "4"],
  ["cinco", "5"],
  ["seis", "6"],
  ["siete", "7"],
  ["sota", "10"],
  ["caballo", "11"],
  ["rey", "12"]
];

const suits = {
  oro: { label: "ORO", color: "#b77a13", dark: "#5d3510", code: "O" },
  copa: { label: "COPA", color: "#a72f27", dark: "#541614", code: "C" },
  espada: { label: "ESPADA", color: "#33596b", dark: "#101f2a", code: "E" },
  basto: { label: "BASTO", color: "#46743a", dark: "#1c3219", code: "B" }
};

function cardFrame({ rank, suit }) {
  const isFigure = Number(rank) >= 10;
  const figureName = rank === "10" ? "SOTA" : rank === "11" ? "CABALLO" : rank === "12" ? "REY" : "";
  const pipCount = Number(rank) <= 7 ? Number(rank) : 0;
  const pips = isFigure ? figureSymbol(suit, rank) : pipLayout(suit, pipCount);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="620" viewBox="0 0 420 620" role="img" aria-label="${rank} de ${suit.label}">
  <rect width="420" height="620" rx="28" fill="#f4e4bf"/>
  <rect x="14" y="14" width="392" height="592" rx="22" fill="#f7ebce" stroke="#6e4a2b" stroke-width="5"/>
  <rect x="31" y="31" width="358" height="558" rx="15" fill="none" stroke="${suit.color}" stroke-width="3"/>
  <rect x="44" y="44" width="332" height="532" rx="10" fill="none" stroke="#9f7040" stroke-width="1.6" opacity="0.48"/>
  ${corner(rank, suit, 58, 76, 0)}
  ${corner(rank, suit, 362, 544, 180)}
  <text x="210" y="102" text-anchor="middle" font-family="Georgia, serif" font-size="22" font-weight="700" letter-spacing="4" fill="${suit.dark}">${suit.label}</text>
  <g>${pips}</g>
  ${isFigure ? `<text x="210" y="519" text-anchor="middle" font-family="Georgia, serif" font-size="28" font-weight="700" letter-spacing="5" fill="${suit.dark}">${figureName}</text>` : ""}
</svg>`;
}

function corner(rank, suit, x, y, rotation) {
  return `<g transform="translate(${x} ${y}) rotate(${rotation})">
    <text x="0" y="0" text-anchor="middle" font-family="Georgia, serif" font-size="46" font-weight="800" fill="${suit.dark}">${rank}</text>
    <text x="0" y="31" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="900" fill="${suit.color}">${suit.code}</text>
  </g>`;
}

function pipLayout(suit, count) {
  const layouts = {
    1: [[210, 314, 1.42]],
    2: [[210, 210, 1], [210, 418, 1]],
    3: [[210, 190, 0.92], [210, 314, 1.1], [210, 438, 0.92]],
    4: [[145, 205, 0.82], [275, 205, 0.82], [145, 423, 0.82], [275, 423, 0.82]],
    5: [[145, 188, 0.76], [275, 188, 0.76], [210, 314, 0.96], [145, 440, 0.76], [275, 440, 0.76]],
    6: [[145, 176, 0.72], [275, 176, 0.72], [145, 314, 0.72], [275, 314, 0.72], [145, 452, 0.72], [275, 452, 0.72]],
    7: [[145, 166, 0.68], [275, 166, 0.68], [145, 286, 0.68], [275, 286, 0.68], [210, 346, 0.8], [145, 466, 0.68], [275, 466, 0.68]]
  };

  return layouts[count].map(([x, y, scale], index) => pipSymbol(suit, x, y, scale, index % 2 ? 180 : 0)).join("");
}

function pipSymbol(suit, x, y, scale = 1, rotation = 0) {
  const shape = {
    ORO: oroSymbol(suit),
    COPA: copaSymbol(suit),
    ESPADA: espadaSymbol(suit),
    BASTO: bastoSymbol(suit)
  }[suit.label];

  return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})">${shape}</g>`;
}

function oroSymbol(suit) {
  return `<circle cx="0" cy="0" r="46" fill="#d9a134" stroke="${suit.dark}" stroke-width="6"/>
  <circle cx="0" cy="0" r="27" fill="#f2cf68" stroke="#8e5b14" stroke-width="3"/>
  <path d="M-27 0H27M0-27V27" stroke="#8e5b14" stroke-width="5" stroke-linecap="round"/>`;
}

function copaSymbol(suit) {
  return `<path d="M-36-44H36L28 14C24 46-24 46-28 14Z" fill="${suit.color}" stroke="${suit.dark}" stroke-width="6" stroke-linejoin="round"/>
  <path d="M-22-25H22L18 8C15 26-15 26-18 8Z" fill="#eec7a4" opacity="0.38"/>
  <path d="M0 42V74M-28 74H28" stroke="${suit.dark}" stroke-width="8" stroke-linecap="round"/>`;
}

function espadaSymbol(suit) {
  return `<path d="M0-78C22-42 30-9 9 25L0 39L-9 25C-30-9-22-42 0-78Z" fill="#8fb0bd" stroke="${suit.dark}" stroke-width="7" stroke-linejoin="round"/>
  <path d="M0-60C12-31 14-8 3 17" fill="none" stroke="#f4eedb" stroke-width="5" stroke-linecap="round" opacity="0.75"/>
  <path d="M-38 35H38M0 39V84" stroke="${suit.dark}" stroke-width="10" stroke-linecap="round"/>
  <path d="M-25 34H25M0 43V77" stroke="${suit.color}" stroke-width="5" stroke-linecap="round"/>
  <circle cx="0" cy="35" r="12" fill="#d7c594" stroke="${suit.dark}" stroke-width="4"/>`;
}

function bastoSymbol(suit) {
  return `<g transform="rotate(-24)">
    <rect x="-17" y="-72" width="34" height="144" rx="15" fill="#8a5a2b" stroke="${suit.dark}" stroke-width="6"/>
    <path d="M-16-34H16M-16 6H16M-16 46H16" stroke="#c68b4c" stroke-width="5" stroke-linecap="round"/>
    <circle cx="0" cy="-54" r="16" fill="${suit.color}" stroke="${suit.dark}" stroke-width="5"/>
  </g>`;
}

function figureSymbol(suit, rank) {
  const label = rank === "10" ? "S" : rank === "11" ? "C" : "R";
  const crown = rank === "12" ? `<path d="M-58-85L-28-48L0-92L28-48L58-85V-24H-58Z" fill="#d9a134" stroke="${suit.dark}" stroke-width="5" stroke-linejoin="round"/>` : "";
  const horse = rank === "11" ? `<path d="M-56 36C-30 8-6-6 33-3C58-1 68 19 53 43C33 27 8 29-18 56Z" fill="#d9c4a3" stroke="${suit.dark}" stroke-width="6" stroke-linejoin="round"/>` : "";

  return `<g transform="translate(210 304)">
    <rect x="-100" y="-136" width="200" height="272" rx="18" fill="#ead4ac" stroke="${suit.dark}" stroke-width="6"/>
    <rect x="-78" y="-113" width="156" height="226" rx="10" fill="#f5e7c8" stroke="${suit.color}" stroke-width="4"/>
    ${crown}
    <circle cx="0" cy="-48" r="36" fill="#c58b62" stroke="${suit.dark}" stroke-width="6"/>
    <path d="M-18-54C-8-68 14-67 24-52" fill="none" stroke="#3b2118" stroke-width="6" stroke-linecap="round"/>
    <circle cx="-12" cy="-47" r="4" fill="#1d110c"/>
    <circle cx="12" cy="-47" r="4" fill="#1d110c"/>
    <path d="M-52 4C-42-30 42-30 52 4L68 88H-68Z" fill="${suit.color}" stroke="${suit.dark}" stroke-width="7" stroke-linejoin="round"/>
    <path d="M-40 14H40M-50 45H50" stroke="#f5e7c8" stroke-width="5" stroke-linecap="round" opacity="0.46"/>
    ${horse}
    <text x="0" y="85" text-anchor="middle" font-family="Georgia, serif" font-size="78" font-weight="800" fill="#f7e8c7" stroke="${suit.dark}" stroke-width="3">${label}</text>
    ${pipSymbol(suit, 0, 157, 0.5)}
  </g>`;
}

function back() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="620" viewBox="0 0 420 620">
  <rect width="420" height="620" rx="28" fill="#4f2319"/>
  <rect x="14" y="14" width="392" height="592" rx="22" fill="#6d3021" stroke="#e0ad5b" stroke-width="5"/>
  <rect x="38" y="38" width="344" height="544" rx="14" fill="#2a120d" stroke="#c9974d" stroke-width="3"/>
  <path d="M210 88C278 151 310 224 310 310S278 469 210 532C142 469 110 396 110 310S142 151 210 88Z" fill="#7a3828" stroke="#e0ad5b" stroke-width="6"/>
  <circle cx="210" cy="310" r="86" fill="none" stroke="#e0ad5b" stroke-width="5"/>
  <path d="M130 310H290M210 230V390" stroke="#e0ad5b" stroke-width="6" stroke-linecap="round"/>
  <text x="210" y="300" text-anchor="middle" font-family="Georgia, serif" font-size="48" font-weight="800" fill="#f3dfb6">TRUCO</text>
  <text x="210" y="348" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="900" letter-spacing="5" fill="#d7a65a">LA TRAICION</text>
</svg>`;
}

for (const [rankId, rank] of ranks) {
  for (const [suitId, suit] of Object.entries(suits)) {
    writeFileSync(join(frontsDir, `${rankId}-${suitId}.svg`), cardFrame({ rank, suit }));
  }
}

writeFileSync(join(backsDir, "truco-back.svg"), back());
console.log("Generated Spanish deck SVG assets.");
