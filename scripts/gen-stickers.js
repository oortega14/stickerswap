#!/usr/bin/env node
// Genera assets/stickers.json con la estructura del álbum de cromos.
//
// Es una colección genérica de banderas del mundo, en una lista plana
// en el orden de las páginas del álbum. No hay grupos ni agrupaciones de
// ningún tipo. No representa ningún torneo, evento, federación ni
// competición real, ni reproduce su estructura ni su agrupación.
//
// Estructura:
//   - 9 stickers de intro (INT-1..INT-9)
//   - 48 banderas (lista plana, orden del álbum)
//   - Por bandera: 20 cromos
//       N1  = bandera principal (team_badge)
//       N2..N12  = 11 cromos
//       N13 = foto del set (team_photo)
//       N14..N20 = 7 cromos más
//   - 11 stickers de Extras (EXT-1..EXT-11)
//   - 14 stickers de Estrellas (STR-1..STR-14)
//
// Para regenerar: node scripts/gen-stickers.js

const fs = require("fs");
const path = require("path");

// Lista plana de banderas en el orden de las páginas del álbum (sin grupos).
const FLAGS = [
  { code: "MEX", section: "México" },
  { code: "RSA", section: "Sudáfrica" },
  { code: "KOR", section: "Corea del Sur" },
  { code: "CZE", section: "República Checa" },
  { code: "CAN", section: "Canadá" },
  { code: "BIH", section: "Bosnia y Herzegovina" },
  { code: "QAT", section: "Catar" },
  { code: "SUI", section: "Suiza" },
  { code: "BRA", section: "Brasil" },
  { code: "MAR", section: "Marruecos" },
  { code: "HAI", section: "Haití" },
  { code: "SCO", section: "Escocia" },
  { code: "USA", section: "USA" },
  { code: "PAR", section: "Paraguay" },
  { code: "AUS", section: "Australia" },
  { code: "TUR", section: "Turquía" },
  { code: "GER", section: "Alemania" },
  { code: "CUW", section: "Curazao" },
  { code: "CIV", section: "Costa de Marfil" },
  { code: "ECU", section: "Ecuador" },
  { code: "NED", section: "Países Bajos" },
  { code: "JPN", section: "Japón" },
  { code: "SWE", section: "Suecia" },
  { code: "TUN", section: "Túnez" },
  { code: "BEL", section: "Bélgica" },
  { code: "EGY", section: "Egipto" },
  { code: "IRN", section: "Irán" },
  { code: "NZL", section: "Nueva Zelanda" },
  { code: "ESP", section: "España" },
  { code: "CPV", section: "Cabo Verde" },
  { code: "KSA", section: "Arabia Saudita" },
  { code: "URU", section: "Uruguay" },
  { code: "FRA", section: "Francia" },
  { code: "SEN", section: "Senegal" },
  { code: "IRQ", section: "Irak" },
  { code: "NOR", section: "Noruega" },
  { code: "ARG", section: "Argentina" },
  { code: "ALG", section: "Argelia" },
  { code: "AUT", section: "Austria" },
  { code: "JOR", section: "Jordania" },
  { code: "POR", section: "Portugal" },
  { code: "COD", section: "RD Congo" },
  { code: "UZB", section: "Uzbekistán" },
  { code: "COL", section: "Colombia" },
  { code: "ENG", section: "Inglaterra" },
  { code: "CRO", section: "Croacia" },
  { code: "GHA", section: "Ghana" },
  { code: "PAN", section: "Panamá" }
];

const INTRO_CODES = ["INT-1", "INT-2", "INT-3", "INT-4", "INT-5", "INT-6", "INT-7", "INT-8", "INT-9"];
const EXTRAS_CODES = ["EXT-1", "EXT-2", "EXT-3", "EXT-4", "EXT-5", "EXT-6", "EXT-7", "EXT-8", "EXT-9", "EXT-10", "EXT-11"];
const STARS_CODES = ["STR-1", "STR-2", "STR-3", "STR-4", "STR-5", "STR-6", "STR-7", "STR-8", "STR-9", "STR-10", "STR-11", "STR-12", "STR-13", "STR-14"];

const stickers = [];
let n = 1;

for (const code of INTRO_CODES) {
  stickers.push({ code, number: n++, team: null, section: "Intro", type: "icon" });
}

for (const flag of FLAGS) {
  stickers.push({
    code: `${flag.code}-1`, number: n++, team: flag.code, section: flag.section, type: "team_badge"
  });
  for (let i = 0; i < 11; i++) {
    stickers.push({
      code: `${flag.code}-${i + 2}`, number: n++, team: flag.code, section: flag.section, type: "player"
    });
  }
  stickers.push({
    code: `${flag.code}-13`, number: n++, team: flag.code, section: flag.section, type: "team_photo"
  });
  for (let i = 0; i < 7; i++) {
    stickers.push({
      code: `${flag.code}-${i + 14}`, number: n++, team: flag.code, section: flag.section, type: "player"
    });
  }
}

for (const code of EXTRAS_CODES) {
  stickers.push({ code, number: n++, team: null, section: "Extras", type: "special" });
}

for (const code of STARS_CODES) {
  stickers.push({ code, number: n++, team: null, section: "Estrellas", type: "special" });
}

const dataset = {
  version: 11,
  album: "Stickerswap",
  stickers
};

const target = path.join(__dirname, "..", "assets", "stickers.json");
fs.writeFileSync(target, JSON.stringify(dataset, null, 2) + "\n");
console.error(`✓ wrote ${stickers.length} stickers to ${target}`);
