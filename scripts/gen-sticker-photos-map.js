#!/usr/bin/env node
// Genera src/ui/album/stickerPhotos.ts a partir de los archivos en
// assets/stickers/*.jpg. Cada archivo se expone via require() en un mapa
// para que StickerFullCard pueda hacer STICKER_PHOTOS[sticker.code].

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "assets", "stickers");
const OUT = path.join(ROOT, "src", "ui", "album", "stickerPhotos.ts");

const files = fs.readdirSync(SRC).filter((f) => f.endsWith(".jpg"));
const codes = files.map((f) => f.replace(/\.jpg$/, "")).sort();

const lines = [
  "// Generado por scripts/gen-sticker-photos-map.js. NO EDITAR A MANO.",
  "// Para regenerar: node scripts/extract-all-stickers.js && node scripts/gen-sticker-photos-map.js",
  "",
  "import type { ImageSourcePropType } from \"react-native\";",
  "",
  "export const STICKER_PHOTOS: Record<string, ImageSourcePropType> = {"
];
for (const code of codes) {
  lines.push(`  "${code}": require("../../../assets/stickers/${code}.jpg"),`);
}
lines.push("};");
lines.push("");

fs.writeFileSync(OUT, lines.join("\n"));
console.log(`Wrote ${codes.length} sticker photo entries to ${OUT}`);
