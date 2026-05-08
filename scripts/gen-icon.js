// node scripts/gen-icon.js
// Genera icon.png, adaptive-icon.png, splash.png a partir del SVG fuente.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const out = path.join(__dirname, "..", "assets");
const SVG_SOURCE = path.join(out, "logo-drafts", "04f-gold-band.svg");
const BG = "#1a1410"; // espresso, tiene que matchear el fondo del SVG

async function main() {
  const svg = fs.readFileSync(SVG_SOURCE);

  // iOS icon: 1024×1024 cuadrado (iOS redondea esquinas automáticamente)
  await sharp(svg).resize(1024, 1024).png().toFile(path.join(out, "icon.png"));

  // Android adaptive icon: 432×432, foreground se masquea por el OS.
  // Safe zone es ~66% del centro — la banda MUNDIAL puede recortarse según el shape.
  await sharp(svg).resize(432, 432).png().toFile(path.join(out, "adaptive-icon.png"));

  // Splash: 1242×2436 (iPhone X), ícono centrado sobre fondo espresso
  await sharp({
    create: { width: 1242, height: 2436, channels: 4, background: BG },
  })
    .composite([
      { input: await sharp(svg).resize(600, 600).png().toBuffer(), top: 918, left: 321 },
    ])
    .png()
    .toFile(path.join(out, "splash.png"));

  // Splash icon (Expo splash plugin lo usa en algunas versiones)
  await sharp(svg).resize(1024, 1024).png().toFile(path.join(out, "splash-icon.png"));

  // Favicon web 48×48
  await sharp(svg).resize(48, 48).png().toFile(path.join(out, "favicon.png"));

  console.log("✓ Generated icon.png, adaptive-icon.png, splash.png, splash-icon.png, favicon.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
