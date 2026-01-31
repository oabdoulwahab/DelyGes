// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclure les assets .wasm du bundling
config.resolver.assetExts.push('wasm');
config.resolver.sourceExts = config.resolver.sourceExts.filter(ext => ext !== 'wasm');

// Exclure les fichiers web spécifiques
config.resolver.blockList = [
  ...(config.resolver.blockList || []),
  /\/web\/.*/, // Exclure tous les fichiers dans les dossiers web
  /\.wasm$/,
];

module.exports = config;