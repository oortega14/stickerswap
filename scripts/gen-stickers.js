#!/usr/bin/env node
// Genera assets/stickers.json con la estructura del álbum Panini Mundial 2026.
// Estructura:
//   - 9 stickers de intro (0-0 + FWC-1..FWC-8)
//   - 48 equipos en 12 grupos × 4 equipos
//   - Por equipo: 20 stickers
//       N1 = escudo (team_badge)
//       N2..N12 = 11 jugadores
//       N13 = team_photo "{Country} Team"
//       N14..N20 = 7 jugadores más
//
// Para regenerar: node scripts/gen-stickers.js
// Player names que no estén en KNOWN_PLAYERS arrancan como "{Country} #N";
// los reemplazás cuando los tengas reales.

const fs = require("fs");
const path = require("path");

// 12 grupos del Mundial 2026 — orden por nombre del grupo (A-L), y dentro de
// cada grupo el orden tal como me lo pasaste.
const GROUPS = [
  ["A", [
    { code: "MEX", section: "México",                english: "Mexico" },
    { code: "RSA", section: "Sudáfrica",             english: "South Africa" },
    { code: "KOR", section: "Corea del Sur",         english: "Korea Republic" },
    { code: "CZE", section: "República Checa",       english: "Czechia" }
  ]],
  ["B", [
    { code: "CAN", section: "Canadá",                english: "Canada" },
    { code: "BIH", section: "Bosnia y Herzegovina",  english: "Bosnia-Herzegovina" },
    { code: "QAT", section: "Catar",                 english: "Qatar" },
    { code: "SUI", section: "Suiza",                 english: "Switzerland" }
  ]],
  ["C", [
    { code: "BRA", section: "Brasil",                english: "Brazil" },
    { code: "MAR", section: "Marruecos",             english: "Morocco" },
    { code: "HAI", section: "Haití",                 english: "Haiti" },
    { code: "SCO", section: "Escocia",               english: "Scotland" }
  ]],
  ["D", [
    { code: "USA", section: "USA",                   english: "USA" },
    { code: "PAR", section: "Paraguay",              english: "Paraguay" },
    { code: "AUS", section: "Australia",             english: "Australia" },
    { code: "TUR", section: "Turquía",               english: "Türkiye" }
  ]],
  ["E", [
    { code: "GER", section: "Alemania",              english: "Germany" },
    { code: "CUW", section: "Curazao",               english: "Curaçao" },
    { code: "CIV", section: "Costa de Marfil",       english: "Côte d'Ivoire" },
    { code: "ECU", section: "Ecuador",               english: "Ecuador" }
  ]],
  ["F", [
    { code: "NED", section: "Países Bajos",          english: "Netherlands" },
    { code: "JPN", section: "Japón",                 english: "Japan" },
    { code: "SWE", section: "Suecia",                english: "Sweden" },
    { code: "TUN", section: "Túnez",                 english: "Tunisia" }
  ]],
  ["G", [
    { code: "BEL", section: "Bélgica",               english: "Belgium" },
    { code: "EGY", section: "Egipto",                english: "Egypt" },
    { code: "IRN", section: "Irán",                  english: "Iran" },
    { code: "NZL", section: "Nueva Zelanda",         english: "New Zealand" }
  ]],
  ["H", [
    { code: "ESP", section: "España",                english: "Spain" },
    { code: "CPV", section: "Cabo Verde",            english: "Cape Verde" },
    { code: "KSA", section: "Arabia Saudita",        english: "Saudi Arabia" },
    { code: "URU", section: "Uruguay",               english: "Uruguay" }
  ]],
  ["I", [
    { code: "FRA", section: "Francia",               english: "France" },
    { code: "SEN", section: "Senegal",               english: "Senegal" },
    { code: "IRQ", section: "Irak",                  english: "Iraq" },
    { code: "NOR", section: "Noruega",               english: "Norway" }
  ]],
  ["J", [
    { code: "ARG", section: "Argentina",             english: "Argentina" },
    { code: "ALG", section: "Argelia",               english: "Algeria" },
    { code: "AUT", section: "Austria",               english: "Austria" },
    { code: "JOR", section: "Jordania",              english: "Jordan" }
  ]],
  ["K", [
    { code: "POR", section: "Portugal",              english: "Portugal" },
    { code: "COD", section: "RD Congo",              english: "Congo DR" },
    { code: "UZB", section: "Uzbekistán",            english: "Uzbekistan" },
    { code: "COL", section: "Colombia",              english: "Colombia" }
  ]],
  ["L", [
    { code: "ENG", section: "Inglaterra",            english: "England" },
    { code: "CRO", section: "Croacia",               english: "Croatia" },
    { code: "GHA", section: "Ghana",                 english: "Ghana" },
    { code: "PAN", section: "Panamá",                english: "Panama" }
  ]]
];

// Nombres reales tipeados por el usuario. Para los demás equipos quedan
// placeholders. Cuando tipees nombres reales para más equipos, pegalos acá y
// regenerás.
const KNOWN_PLAYERS = {
  MEX: [
    "Luis Malagon",
    "Johan Vasquez",
    "Jorge Sanchez",
    "Cesar Montes",
    "Jesus Gallardo",
    "Israel Reves",
    "Diego Lainez",
    "Carlos Rodriguez",
    "Edson Alvarez",
    "Orbelin Pineda",
    "Marcel Ruiz",
    // posición 12 ↑ — termina jugadores antes del team_photo (N13)
    "Erick Sanchez",
    "Hirving Lozano",
    "Santiago Gimenez",
    "Paul Jimenez",
    "Alexis Vega",
    "Roberto Alvarado",
    "Cesar Huerta"
    // hasta 18 jugadores en total (N2..N12 + N14..N20)
  ]
};

const INTRO = [
  { code: "0-0",   name: "Chilena Iconica" },
  { code: "FWC-1", name: "Trofeo FIFA Primera Parte" },
  { code: "FWC-2", name: "Trofeo FIFA Segunda Parte" },
  { code: "FWC-3", name: "Mascotas World Cup 2026" },
  { code: "FWC-4", name: "We Are Fifa World Cup 2026" },
  { code: "FWC-5", name: "Pelota Oficial" },
  { code: "FWC-6", name: "Emblema Oficial - Canada" },
  { code: "FWC-7", name: "Emblema Oficial - Mexico" },
  { code: "FWC-8", name: "Emblema Oficial - USA" }
];

const stickers = [];
let n = 1;

// === Intro ===
for (const item of INTRO) {
  stickers.push({
    code: item.code,
    number: n,
    name: item.name,
    team: null,
    section: "Intro",
    type: "icon",
    group: null
  });
  n++;
}

// === Equipos por grupo ===
for (const [groupLetter, teams] of GROUPS) {
  for (const team of teams) {
    const known = KNOWN_PLAYERS[team.code] ?? [];
    const players = []; // 18 nombres total (N2-N12 + N14-N20)
    for (let i = 0; i < 18; i++) {
      players.push(known[i] ?? `${team.section} #${i + 1}`);
    }

    // N1 escudo
    stickers.push({
      code: `${team.code}-1`,
      number: n++,
      name: `Escudo ${team.section}`,
      team: team.code,
      section: team.section,
      type: "team_badge",
      group: groupLetter
    });

    // N2..N12 → 11 jugadores
    for (let i = 0; i < 11; i++) {
      stickers.push({
        code: `${team.code}-${i + 2}`,
        number: n++,
        name: players[i],
        team: team.code,
        section: team.section,
        type: "player",
        group: groupLetter
      });
    }

    // N13 team_photo
    stickers.push({
      code: `${team.code}-13`,
      number: n++,
      name: `${team.english} Team`,
      team: team.code,
      section: team.section,
      type: "team_photo",
      group: groupLetter
    });

    // N14..N20 → 7 jugadores más
    for (let i = 0; i < 7; i++) {
      stickers.push({
        code: `${team.code}-${i + 14}`,
        number: n++,
        name: players[11 + i],
        team: team.code,
        section: team.section,
        type: "player",
        group: groupLetter
      });
    }
  }
}

const dataset = {
  version: 4,
  album: "FIFA World Cup 2026",
  stickers
};

const target = path.join(__dirname, "..", "assets", "stickers.json");
fs.writeFileSync(target, JSON.stringify(dataset, null, 2) + "\n");
console.error(`✓ wrote ${stickers.length} stickers to ${target}`);
