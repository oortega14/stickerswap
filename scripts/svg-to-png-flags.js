#!/usr/bin/env node
// Convierte assets/flags/*.svg a PNG @1x, @2x, @3x para usarse con
// <Image source={require(...)} /> en lugar de SVG runtime parsing.
// React Native elige automaticamente la variante segun el densidad del
// device (Image scale resolver de Metro).
//
// Tamano base: 96px (bolita ~70px + headroom). @2x = 192, @3x = 288.

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SRC_DIR = path.join(__dirname, "..", "assets", "flags");
const OUT_DIR = path.join(__dirname, "..", "assets", "flags-png");

const BASE_SIZE = 96;
const VARIANTS = [
  { suffix: "",      scale: 1 },
  { suffix: "@2x",   scale: 2 },
  { suffix: "@3x",   scale: 3 }
];

async function convert(svgPath) {
  const fifa = path.basename(svgPath, ".svg");
  const buf = fs.readFileSync(svgPath);
  for (const { suffix, scale } of VARIANTS) {
    const size = BASE_SIZE * scale;
    const outPath = path.join(OUT_DIR, `${fifa}${suffix}.png`);
    await sharp(buf, { density: 200 })
      .resize(size, size, { fit: "cover" })
      .png({ compressionLevel: 9 })
      .toFile(outPath);
  }
  return fifa;
}

function writeFlagMap(codes) {
  const out = path.join(__dirname, "..", "src", "ui", "flags", "flagMap.ts");
  const lines = [
    "// Generado por scripts/svg-to-png-flags.js. NO EDITAR A MANO.",
    "// PNGs en assets/flags-png/ — RN elige automaticamente la variante",
    "// segun la densidad del device (1x / 2x / 3x).",
    "",
    "import type { ImageSourcePropType } from \"react-native\";",
    "",
    "export const FLAG_PNG: Record<string, ImageSourcePropType> = {"
  ];
  for (const code of codes) {
    lines.push(`  ${code}: require("../../../assets/flags-png/${code}.png"),`);
  }
  lines.push("};");
  lines.push("");
  fs.writeFileSync(out, lines.join("\n"));
  console.log(`Wrote ${codes.length} flag entries to ${out}`);
}

(async () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const svgs = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith(".svg"));
  console.log(`Converting ${svgs.length} flags (${BASE_SIZE}/${BASE_SIZE * 2}/${BASE_SIZE * 3}px)...`);
  const codes = [];
  for (const svg of svgs) {
    const fifa = await convert(path.join(SRC_DIR, svg));
    codes.push(fifa);
    process.stdout.write(`${fifa} `);
  }
  console.log(`\nDone. PNGs in ${OUT_DIR}`);
  writeFlagMap(codes.sort());
})();
