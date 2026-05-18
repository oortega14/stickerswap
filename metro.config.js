const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// expo-sqlite/web/worker.ts importa wa-sqlite.wasm; Metro no resuelve .wasm
// por default. Aunque el target sea Android, Metro a veces arma el bundle
// web (deep links de OAuth) y este import lo rompe. Lo declaramos como asset.
config.resolver.assetExts = [...config.resolver.assetExts, "wasm"];

module.exports = withNativeWind(config, { input: "./global.css" });
