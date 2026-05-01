// node scripts/gen-icon.js
// Genera icon.png, adaptive-icon.png, splash.png a partir de un SVG espacial.
const path = require("path");
const sharp = require("sharp");

const out = path.join(__dirname, "..", "assets");

const SVG = `
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#5b1ea3"/>
      <stop offset="60%" stop-color="#1a0d4d"/>
      <stop offset="100%" stop-color="#000000"/>
    </radialGradient>
    <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7c5cff"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <circle cx="512" cy="512" r="220" fill="url(#ring)" opacity="0.95"/>
  <circle cx="450" cy="460" r="40" fill="#a78bfa" opacity="0.9"/>
  <circle cx="600" cy="540" r="25" fill="#fff" opacity="0.7"/>
  <ellipse cx="512" cy="512" rx="320" ry="60" fill="none" stroke="#a78bfa" stroke-width="6" opacity="0.6" transform="rotate(-20 512 512)"/>
  <circle cx="200" cy="200" r="4" fill="#fff"/>
  <circle cx="850" cy="180" r="3" fill="#fff"/>
  <circle cx="800" cy="850" r="5" fill="#fff"/>
  <circle cx="180" cy="800" r="3" fill="#fff"/>
</svg>
`;

async function main() {
  const buf = Buffer.from(SVG);
  await sharp(buf).resize(1024, 1024).png().toFile(path.join(out, "icon.png"));
  await sharp(buf).resize(432, 432).png().toFile(path.join(out, "adaptive-icon.png"));
  // Splash: 1242×2436 (iPhone X), centra el ícono
  await sharp({
    create: { width: 1242, height: 2436, channels: 4, background: "#000000" }
  })
    .composite([{ input: await sharp(buf).resize(600, 600).png().toBuffer(), top: 918, left: 321 }])
    .png()
    .toFile(path.join(out, "splash.png"));
  console.log("✓ Generated icon.png, adaptive-icon.png, splash.png");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
