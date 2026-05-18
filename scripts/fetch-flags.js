#!/usr/bin/env node
// Descarga 48 SVGs de banderas de flagicons.lipis.dev (MIT) y los
// bundlea en src/ui/flags/flagMap.ts.
//
// Mapping FIFA -> ISO-3166-1 alpha-2. Algunos paises tienen codigo FIFA
// distinto al ISO. Esta lista se mantiene a mano.

const fs = require("fs");
const path = require("path");
const https = require("https");

const FIFA_TO_ISO = {
  // Grupo A
  MEX: "mx", RSA: "za", KOR: "kr", CZE: "cz",
  // Grupo B
  CAN: "ca", BIH: "ba", QAT: "qa", SUI: "ch",
  // Grupo C
  BRA: "br", MAR: "ma", HAI: "ht", SCO: "gb-sct",
  // Grupo D
  USA: "us", PAR: "py", AUS: "au", TUR: "tr",
  // Grupo E
  GER: "de", CUW: "cw", CIV: "ci", ECU: "ec",
  // Grupo F
  NED: "nl", JPN: "jp", SWE: "se", TUN: "tn",
  // Grupo G
  BEL: "be", EGY: "eg", IRN: "ir", NZL: "nz",
  // Grupo H
  ESP: "es", CPV: "cv", KSA: "sa", URU: "uy",
  // Grupo I
  FRA: "fr", SEN: "sn", IRQ: "iq", NOR: "no",
  // Grupo J
  ARG: "ar", ALG: "dz", AUT: "at", JOR: "jo",
  // Grupo K
  POR: "pt", COD: "cd", UZB: "uz", COL: "co",
  // Grupo L
  ENG: "gb-eng", CRO: "hr", GHA: "gh", PAN: "pa"
};

const BASE_URL = "https://cdn.jsdelivr.net/gh/lipis/flag-icons@latest/flags/4x3";
const OUT_DIR = path.join(__dirname, "..", "assets", "flags");
const OUT_TS = path.join(__dirname, "..", "src", "ui", "flags", "flagMap.ts");

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetch(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`${url} -> ${res.statusCode}`));
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

(async () => {
  const map = {};
  for (const [fifa, iso] of Object.entries(FIFA_TO_ISO)) {
    const url = `${BASE_URL}/${iso}.svg`;
    process.stdout.write(`Downloading ${fifa} (${iso})... `);
    try {
      const svg = await fetch(url);
      fs.writeFileSync(path.join(OUT_DIR, `${fifa}.svg`), svg);
      map[fifa] = svg.replace(/\s+/g, " ").trim();
      console.log("ok");
    } catch (e) {
      console.log(`FAIL — ${e.message}`);
    }
  }

  const lines = [
    "// Generado por scripts/fetch-flags.js. NO EDITAR A MANO.",
    "// Banderas SVG de flagicons.lipis.dev (MIT License).",
    "",
    "export const FLAG_MAP: Record<string, string> = {"
  ];
  for (const [fifa, svg] of Object.entries(map)) {
    const escaped = svg.replace(/`/g, "\\`").replace(/\$/g, "\\$");
    lines.push(`  ${fifa}: \`${escaped}\`,`);
  }
  lines.push("};");
  lines.push("");

  fs.mkdirSync(path.dirname(OUT_TS), { recursive: true });
  fs.writeFileSync(OUT_TS, lines.join("\n"));
  console.log(`\nWrote ${Object.keys(map).length} flags to ${OUT_TS}`);
})();
