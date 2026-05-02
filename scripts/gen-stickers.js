#!/usr/bin/env node
// Genera assets/stickers.json con la estructura típica del Panini Mundial 2026.
// Player names son placeholders ("Argentina #1") — cuando vayas pegando los
// stickers reales, abrís el JSON y reemplazás `name` por el nombre real.
//
// Para regenerar:  node scripts/gen-stickers.js > assets/stickers.json

const fs = require("fs");
const path = require("path");

const TEAMS = [
  // Anfitriones
  { code: "USA", name: "United States" },
  { code: "CAN", name: "Canada" },
  { code: "MEX", name: "Mexico" },
  // Conmebol
  { code: "ARG", name: "Argentina" },
  { code: "BRA", name: "Brasil" },
  { code: "URU", name: "Uruguay" },
  { code: "COL", name: "Colombia" },
  { code: "ECU", name: "Ecuador" },
  { code: "PAR", name: "Paraguay" },
  // UEFA
  { code: "ESP", name: "España" },
  { code: "FRA", name: "Francia" },
  { code: "ENG", name: "Inglaterra" },
  { code: "GER", name: "Alemania" },
  { code: "POR", name: "Portugal" },
  { code: "ITA", name: "Italia" },
  { code: "NED", name: "Países Bajos" },
  { code: "BEL", name: "Bélgica" },
  { code: "CRO", name: "Croacia" },
  { code: "DEN", name: "Dinamarca" },
  { code: "SUI", name: "Suiza" },
  { code: "POL", name: "Polonia" },
  { code: "AUT", name: "Austria" },
  { code: "HUN", name: "Hungría" },
  { code: "TUR", name: "Turquía" },
  { code: "SCO", name: "Escocia" },
  { code: "UKR", name: "Ucrania" },
  // CAF
  { code: "MAR", name: "Marruecos" },
  { code: "SEN", name: "Senegal" },
  { code: "EGY", name: "Egipto" },
  { code: "TUN", name: "Túnez" },
  { code: "NGA", name: "Nigeria" },
  { code: "GHA", name: "Ghana" },
  { code: "ALG", name: "Argelia" },
  { code: "CMR", name: "Camerún" },
  { code: "CIV", name: "Costa de Marfil" },
  // AFC
  { code: "JPN", name: "Japón" },
  { code: "KOR", name: "Corea del Sur" },
  { code: "AUS", name: "Australia" },
  { code: "IRN", name: "Irán" },
  { code: "KSA", name: "Arabia Saudita" },
  { code: "QAT", name: "Qatar" },
  { code: "UZB", name: "Uzbekistán" },
  { code: "JOR", name: "Jordania" },
  // Concacaf
  { code: "CRC", name: "Costa Rica" },
  { code: "PAN", name: "Panamá" },
  { code: "JAM", name: "Jamaica" },
  // OFC
  { code: "NZL", name: "Nueva Zelanda" },
  // Wildcard
  { code: "BFA", name: "Burkina Faso" }
];

const INTRO = [
  "Trofeo FIFA",
  "Mascota Maple",
  "Mascota Zayu",
  "Mascota Clutch",
  "Pelota Oficial",
  "Logo FIFA World Cup 2026",
  "Países Anfitriones",
  "Bandera USA",
  "Bandera Canadá",
  "Bandera México",
  "Calendario",
  "Bracket"
];

const STADIUMS = [
  "MetLife Stadium · East Rutherford",
  "AT&T Stadium · Arlington",
  "SoFi Stadium · Inglewood",
  "Mercedes-Benz Stadium · Atlanta",
  "Lincoln Financial Field · Philadelphia",
  "Lumen Field · Seattle",
  "Levi's Stadium · Santa Clara",
  "NRG Stadium · Houston",
  "Hard Rock Stadium · Miami",
  "Arrowhead Stadium · Kansas City",
  "Gillette Stadium · Foxborough",
  "BMO Field · Toronto",
  "BC Place · Vancouver",
  "Estadio Azteca · Ciudad de México",
  "Estadio BBVA · Monterrey",
  "Estadio Akron · Guadalajara"
];

const LEGENDS = [
  "Pelé",
  "Diego Maradona",
  "Lionel Messi (Leyenda)",
  "Cristiano Ronaldo (Leyenda)",
  "Zinedine Zidane",
  "Ronaldo Nazário",
  "Johan Cruyff",
  "Franz Beckenbauer",
  "Bobby Charlton",
  "Paolo Maldini",
  "Roberto Baggio",
  "Lothar Matthäus",
  "Ronaldinho",
  "Kaká",
  "Iniesta",
  "Xavi"
];

const stickers = [];
let n = 1;

function pushSticker(rest) {
  stickers.push({
    code: `FWC-${n}`,
    number: n,
    ...rest
  });
  n++;
}

for (const name of INTRO) {
  pushSticker({ name, team: null, section: "Intro", type: "icon" });
}

for (const name of STADIUMS) {
  pushSticker({ name, team: null, section: "Estadios", type: "stadium" });
}

for (const name of LEGENDS) {
  pushSticker({ name, team: null, section: "Leyendas", type: "special" });
}

for (const team of TEAMS) {
  pushSticker({
    name: `${team.name} (Escudo)`,
    team: team.code,
    section: team.name,
    type: "team_badge"
  });
  for (let p = 1; p <= 12; p++) {
    pushSticker({
      name: `${team.name} #${p}`,
      team: team.code,
      section: team.name,
      type: "player"
    });
  }
}

const dataset = {
  version: 3,
  album: "FIFA World Cup 2026",
  stickers
};

const out = JSON.stringify(dataset, null, 2);
const target = path.join(__dirname, "..", "assets", "stickers.json");
fs.writeFileSync(target, out + "\n");
console.error(`✓ wrote ${stickers.length} stickers to ${target}`);
