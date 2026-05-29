#!/usr/bin/env node
// Genera assets/stickers.json con la estructura del álbum de cromos.
// Estructura:
//   - 9 stickers de intro (INT-1..INT-9)
//   - 48 equipos en 12 grupos × 4 equipos
//   - Por equipo: 20 stickers
//       N1 = escudo (team_badge)
//       N2..N12 = 11 jugadores
//       N13 = team_photo
//       N14..N20 = 7 jugadores más
//   - 11 stickers de Extras (EXT-1..EXT-11)
//   - 14 stickers de Estrellas (STR-1..STR-14)
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

const INTRO_CODES = ["INT-1", "INT-2", "INT-3", "INT-4", "INT-5", "INT-6", "INT-7", "INT-8", "INT-9"];
const EXTRAS_CODES = ["EXT-1", "EXT-2", "EXT-3", "EXT-4", "EXT-5", "EXT-6", "EXT-7", "EXT-8", "EXT-9", "EXT-10", "EXT-11"];
const STARS_CODES = ["STR-1", "STR-2", "STR-3", "STR-4", "STR-5", "STR-6", "STR-7", "STR-8", "STR-9", "STR-10", "STR-11", "STR-12", "STR-13", "STR-14"];

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
  version: 10,
  album: "Stickerswap",
  stickers
};

const target = path.join(__dirname, "..", "assets", "stickers.json");
fs.writeFileSync(target, JSON.stringify(dataset, null, 2) + "\n");
console.error(`✓ wrote ${stickers.length} stickers to ${target}`);
