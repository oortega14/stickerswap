#!/usr/bin/env node
// Extrae todos los 48 equipos del directorio mundial2026/ y los pone en
// assets/stickers/<CODE>-<N>.png (downscaled a 256 wide para bundle).
//
// Uso: node scripts/extract-all-stickers.js

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");
const sharp = require("sharp");

const ROOT = path.join(__dirname, "..");
const SRC_ROOT = path.join(ROOT, "mundial2026");
const OUT_DIR = path.join(ROOT, "assets", "stickers");

// Folder name (en SRC_ROOT) -> codigo FIFA del flag.
const FOLDER_TO_CODE = {
  ALEMANIA: "GER",
  "ARABIA SAUDITA": "KSA",
  ARGELIA: "ALG",
  ARGENTINA: "ARG",
  AUSTRALIA: "AUS",
  AUSTRIA: "AUT",
  BELGICA: "BEL",
  BOSNIA: "BIH",
  BRASIL: "BRA",
  "CABO VERDE": "CPV",
  CANADA: "CAN",
  COLOMBIA: "COL",
  "COSTA DE MARFIL": "CIV",
  CROACIA: "CRO",
  CURAZAO: "CUW",
  ECUADOR: "ECU",
  EGIPTO: "EGY",
  ESCOCIA: "SCO",
  "ESPAÑA": "ESP",
  "ESTADOS UNIDOS": "USA",
  FRANCIA: "FRA",
  GHANA: "GHA",
  HAITI: "HAI",
  HOLANDA: "NED",
  INGLATERRA: "ENG",
  IRAK: "IRQ",
  IRAN: "IRN",
  JAPON: "JPN",
  JORDANIA: "JOR",
  KOREA: "KOR",
  MARRUECOS: "MAR",
  MEXICO: "MEX",
  NORUEGA: "NOR",
  "NUEVA ZELANDA": "NZL",
  PANAMA: "PAN",
  PARAGUAY: "PAR",
  PORTUGAL: "POR",
  QATAR: "QAT",
  "RD CONGO": "COD",
  "REPUBLICA CHECA": "CZE",
  SENEGAL: "SEN",
  "SOUTH AFRICA": "RSA",
  SUECIA: "SWE",
  SUIZA: "SUI",
  TUNEZ: "TUN",
  TURQUIA: "TUR",
  URUGUAY: "URU",
  UZBEKISTAN: "UZB"
};

const COLS = 4;
const ROWS_PAGE1 = 4;
const ROWS_PAGE2 = 2;     // layout real de pag 2 (2 filas: stickers + especiales)
const MAX_ROWS_PAGE2 = 1; // iteramos solo fila 0
const TRIM_THRESHOLD = 30;
const OUTPUT_WIDTH = 256; // downscale para bundle

function pdfPosToAlbumCode(teamCode, pos) {
  if (pos === 1) return `${teamCode}-1`;
  if (pos === 2) return `${teamCode}-13`;
  if (pos >= 3 && pos <= 13) return `${teamCode}-${pos - 1}`;
  if (pos >= 14 && pos <= 20) return `${teamCode}-${pos}`;
  throw new Error(`Posicion fuera de rango: ${pos}`);
}

function findPdfInFolder(folder) {
  // Buscar PDF en la carpeta (excluyendo "Extras" / "Messi" / similar)
  const files = fs.readdirSync(folder).filter((f) => f.endsWith(".pdf"));
  if (files.length === 0) return null;
  // Si hay varios, preferir el que NO tenga "extra" o "messi" en el nombre
  const main = files.find((f) => !/extra|messi/i.test(f));
  return path.join(folder, main || files[0]);
}

function renderPdfPages(pdfPath, workDir) {
  // Renderizamos las paginas a PNG @ 300 DPI. Mas confiable que pdfimages
  // porque algunos PDFs embeben cada sticker como JPG separado y otros como
  // imagen plana de pagina entera. Renderizar funciona igual para los dos.
  execSync(`pdftoppm -r 300 -png "${pdfPath}" "${path.join(workDir, "p")}"`, { stdio: "pipe" });
  return fs
    .readdirSync(workDir)
    .filter((f) => /^p-\d+\.png$/.test(f))
    .sort()
    .map((f) => path.join(workDir, f));
}

async function cropAndSave(imgPath, rows, startPos, teamCode, maxRows) {
  const meta = await sharp(imgPath).metadata();
  const W = meta.width;
  const H = meta.height;
  const cellW = Math.floor(W / COLS);
  const cellH = Math.floor(H / rows);
  let count = 0;
  for (let r = 0; r < maxRows; r++) {
    for (let c = 0; c < COLS; c++) {
      const pos = startPos + r * COLS + c;
      const code = pdfPosToAlbumCode(teamCode, pos);
      const left = c * cellW;
      const top = r * cellH;
      const outFile = path.join(OUT_DIR, `${code}.jpg`);
      const base = sharp(imgPath).extract({ left, top, width: cellW, height: cellH });
      // Trim para sacar fondo uniforme, fallback si trim deja imagen vacia.
      let buf;
      try {
        buf = await base.clone().trim({ threshold: TRIM_THRESHOLD }).toBuffer();
      } catch {
        buf = await base.clone().toBuffer();
      }
      // JPG quality 80: rinde ~10-15KB c/u manteniendo calidad visual.
      await sharp(buf)
        .resize({ width: OUTPUT_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: 80, mozjpeg: true })
        .toFile(outFile);
      count++;
    }
  }
  return count;
}

async function processTeam(folderName, teamCode) {
  const folder = path.join(SRC_ROOT, folderName);
  const pdfPath = findPdfInFolder(folder);
  if (!pdfPath) {
    console.log(`  ⚠️  ${folderName}: no PDF`);
    return 0;
  }
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `render-${teamCode}-`));
  try {
    const pages = renderPdfPages(pdfPath, workDir);
    if (pages.length === 0) {
      console.log(`  ⚠️  ${folderName}: no se renderizaron paginas`);
      return 0;
    }
    let total = await cropAndSave(pages[0], ROWS_PAGE1, 1, teamCode, ROWS_PAGE1);
    if (pages[1]) {
      total += await cropAndSave(pages[1], ROWS_PAGE2, 17, teamCode, MAX_ROWS_PAGE2);
    }
    return total;
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const entries = Object.entries(FOLDER_TO_CODE);
  console.log(`Procesando ${entries.length} equipos...\n`);
  let grandTotal = 0;
  const t0 = Date.now();
  for (const [folder, code] of entries) {
    process.stdout.write(`${code.padEnd(4)} ${folder.padEnd(20)} ... `);
    try {
      const n = await processTeam(folder, code);
      grandTotal += n;
      console.log(`${n} stickers`);
    } catch (e) {
      console.log(`FAIL: ${e.message}`);
    }
  }
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nDone. ${grandTotal} stickers totales en ${elapsed}s. Output: ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
