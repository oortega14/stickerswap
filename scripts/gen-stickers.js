#!/usr/bin/env node
// Genera assets/stickers.json con la estructura del album de cromos del Mundial.
// Estructura:
//   - 9 stickers de intro (0-0 + FWC-1..FWC-8)
//   - 48 equipos en 12 grupos × 4 equipos
//   - Por equipo: 20 stickers
//       N1 = escudo (team_badge)
//       N2..N12 = 11 jugadores
//       N13 = team_photo
//       N14..N20 = 7 jugadores más
//   - 11 stickers de Extras (FWC historicos)
//   - 14 stickers de Estrellas (set especial)
//
// Para regenerar: node scripts/gen-stickers.js

const fs = require("fs");
const path = require("path");

const GROUPS = [
  ["A", [
    { code: "MEX", section: "México" },
    { code: "RSA", section: "Sudáfrica" },
    { code: "KOR", section: "Corea del Sur" },
    { code: "CZE", section: "República Checa" }
  ]],
  ["B", [
    { code: "CAN", section: "Canadá" },
    { code: "BIH", section: "Bosnia y Herzegovina" },
    { code: "QAT", section: "Catar" },
    { code: "SUI", section: "Suiza" }
  ]],
  ["C", [
    { code: "BRA", section: "Brasil" },
    { code: "MAR", section: "Marruecos" },
    { code: "HAI", section: "Haití" },
    { code: "SCO", section: "Escocia" }
  ]],
  ["D", [
    { code: "USA", section: "USA" },
    { code: "PAR", section: "Paraguay" },
    { code: "AUS", section: "Australia" },
    { code: "TUR", section: "Turquía" }
  ]],
  ["E", [
    { code: "GER", section: "Alemania" },
    { code: "CUW", section: "Curazao" },
    { code: "CIV", section: "Costa de Marfil" },
    { code: "ECU", section: "Ecuador" }
  ]],
  ["F", [
    { code: "NED", section: "Países Bajos" },
    { code: "JPN", section: "Japón" },
    { code: "SWE", section: "Suecia" },
    { code: "TUN", section: "Túnez" }
  ]],
  ["G", [
    { code: "BEL", section: "Bélgica" },
    { code: "EGY", section: "Egipto" },
    { code: "IRN", section: "Irán" },
    { code: "NZL", section: "Nueva Zelanda" }
  ]],
  ["H", [
    { code: "ESP", section: "España" },
    { code: "CPV", section: "Cabo Verde" },
    { code: "KSA", section: "Arabia Saudita" },
    { code: "URU", section: "Uruguay" }
  ]],
  ["I", [
    { code: "FRA", section: "Francia" },
    { code: "SEN", section: "Senegal" },
    { code: "IRQ", section: "Irak" },
    { code: "NOR", section: "Noruega" }
  ]],
  ["J", [
    { code: "ARG", section: "Argentina" },
    { code: "ALG", section: "Argelia" },
    { code: "AUT", section: "Austria" },
    { code: "JOR", section: "Jordania" }
  ]],
  ["K", [
    { code: "POR", section: "Portugal" },
    { code: "COD", section: "RD Congo" },
    { code: "UZB", section: "Uzbekistán" },
    { code: "COL", section: "Colombia" }
  ]],
  ["L", [
    { code: "ENG", section: "Inglaterra" },
    { code: "CRO", section: "Croacia" },
    { code: "GHA", section: "Ghana" },
    { code: "PAN", section: "Panamá" }
  ]]
];

const INTRO_CODES = ["0-0", "FWC-1", "FWC-2", "FWC-3", "FWC-4", "FWC-5", "FWC-6", "FWC-7", "FWC-8"];
const EXTRAS_CODES = ["FWC-9", "FWC-10", "FWC-11", "FWC-12", "FWC-13", "FWC-14", "FWC-15", "FWC-16", "FWC-17", "FWC-18", "FWC-19"];
const STARS_CODES = ["CC1", "CC2", "CC3", "CC4", "CC5", "CC6", "CC7", "CC8", "CC9", "CC10", "CC11", "CC12", "CC13", "CC14"];

const stickers = [];
let n = 1;

for (const code of INTRO_CODES) {
  stickers.push({ code, number: n++, team: null, section: "Intro", type: "icon", group: null });
}

for (const [groupLetter, teams] of GROUPS) {
  for (const team of teams) {
    stickers.push({
      code: `${team.code}-1`, number: n++, team: team.code, section: team.section, type: "team_badge", group: groupLetter
    });
    for (let i = 0; i < 11; i++) {
      stickers.push({
        code: `${team.code}-${i + 2}`, number: n++, team: team.code, section: team.section, type: "player", group: groupLetter
      });
    }
    stickers.push({
      code: `${team.code}-13`, number: n++, team: team.code, section: team.section, type: "team_photo", group: groupLetter
    });
    for (let i = 0; i < 7; i++) {
      stickers.push({
        code: `${team.code}-${i + 14}`, number: n++, team: team.code, section: team.section, type: "player", group: groupLetter
      });
    }
  }
}

for (const code of EXTRAS_CODES) {
  stickers.push({ code, number: n++, team: null, section: "Extras", type: "special", group: null });
}

for (const code of STARS_CODES) {
  stickers.push({ code, number: n++, team: null, section: "Estrellas", type: "special", group: null });
}

const dataset = {
  version: 9,
  album: "Stickerswap",
  stickers
};

const target = path.join(__dirname, "..", "assets", "stickers.json");
fs.writeFileSync(target, JSON.stringify(dataset, null, 2) + "\n");
console.error(`✓ wrote ${stickers.length} stickers to ${target}`);
