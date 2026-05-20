#!/usr/bin/env node
// Extrae stickers individuales de un PDF Panini.
// Usa `pdfimages -all` para sacar los JPG embebidos (las paginas como
// imagen plana, sin overhead de render). Despues corta en grilla 4x4
// con sharp y opcionalmente trim del fondo.
//
// Mapeo posicion PDF -> codigo de album:
//   pos 1   -> CODE-1   (escudo)
//   pos 2   -> CODE-13  (team_photo)
//   pos 3..13 -> CODE-2..CODE-12  (11 jugadores antes del team_photo)
//   pos 14..20 -> CODE-14..CODE-20 (7 jugadores despues)
//
// Uso:
//   node scripts/extract-stickers.js <team_code> <pdf_path> [out_dir]

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");
const sharp = require("sharp");

const COLS = 4;
const ROWS_PAGE1 = 4;
// Pagina 2 tiene grilla logica 2x4: fila 0 son los 4 ultimos stickers (17-20),
// fila 1 tiene el "We Are" especial + huecos. Iteramos solo fila 0.
const ROWS_PAGE2 = 2;
const MAX_ROWS_PAGE2 = 1;
// Threshold para trim del background (mayor = mas agresivo).
// 30 funciona para fondos uniformes teal/verde sin perder detalle del sticker.
const TRIM_THRESHOLD = 30;

function pdfPosToAlbumCode(teamCode, pos) {
  if (pos === 1) return `${teamCode}-1`;
  if (pos === 2) return `${teamCode}-13`;
  if (pos >= 3 && pos <= 13) return `${teamCode}-${pos - 1}`;
  if (pos >= 14 && pos <= 20) return `${teamCode}-${pos}`;
  throw new Error(`Posicion fuera de rango: ${pos}`);
}

/**
 * Extrae los JPG embebidos via pdfimages, retorna los paths de las
 * 1 o 2 imagenes grandes (paginas), ignorando logos/decoracion chica.
 */
function extractEmbeddedImages(pdfPath, workDir) {
  const prefix = path.join(workDir, "page");
  execSync(`pdfimages -all "${pdfPath}" "${prefix}"`, { stdio: "inherit" });
  const files = fs
    .readdirSync(workDir)
    .filter((f) => f.startsWith("page-"))
    .map((f) => ({
      name: f,
      path: path.join(workDir, f),
      size: fs.statSync(path.join(workDir, f)).size
    }))
    .sort((a, b) => b.size - a.size);

  // Filtramos a las que son >100KB (las paginas) y ordenamos por nombre
  // para que page-000.jpg vaya primero.
  const pages = files
    .filter((f) => f.size > 100 * 1024)
    .sort((a, b) => a.name.localeCompare(b.name));
  return pages;
}

async function cropGrid(imgPath, rows, startPos, outDir, teamCode, maxRows = rows) {
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
      const outFile = path.join(outDir, `${code}.png`);
      const left = c * cellW;
      const top = r * cellH;
      try {
        await sharp(imgPath)
          .extract({ left, top, width: cellW, height: cellH })
          .trim({ threshold: TRIM_THRESHOLD })
          .png({ compressionLevel: 9 })
          .toFile(outFile);
      } catch {
        // Trim fallo (resultado vacio); guardar sin trim.
        await sharp(imgPath)
          .extract({ left, top, width: cellW, height: cellH })
          .png({ compressionLevel: 9 })
          .toFile(outFile);
      }
      count++;
      process.stdout.write(`${code} `);
    }
  }
  return count;
}

async function main() {
  const [, , teamCode, pdfPath, outDirArg] = process.argv;
  if (!teamCode || !pdfPath) {
    console.error("Uso: node extract-stickers.js <team_code> <pdf_path> [out_dir]");
    process.exit(1);
  }
  const outDir = outDirArg || "/tmp/stickers-test";
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `pdfimg-${teamCode}-`));
  try {
    const pages = extractEmbeddedImages(pdfPath, workDir);
    if (pages.length === 0) throw new Error("No se encontraron paginas en el PDF");

    console.log(`Pagina 1 (${pages[0].name}, ${COLS}x${ROWS_PAGE1}):`);
    let total = await cropGrid(pages[0].path, ROWS_PAGE1, 1, outDir, teamCode);

    if (pages[1]) {
      console.log(`\nPagina 2 (${pages[1].name}, ${COLS}x${ROWS_PAGE2}):`);
      total += await cropGrid(pages[1].path, ROWS_PAGE2, 17, outDir, teamCode, MAX_ROWS_PAGE2);
    }

    console.log(`\n\nDone. ${total} stickers en ${outDir}/${teamCode}-*.png`);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
