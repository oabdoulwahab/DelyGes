const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ajout du support WASM (si vous en avez besoin)
config.resolver.assetExts.push('wasm');

// Correction de la blockList : 
// On ne bloque QUE les fichiers .wasm si nécessaire, 
// mais on laisse Reanimated accéder à ses dossiers internes.
config.resolver.blockList = [
  /\.wasm$/,
  // Ne mettez PAS de règle sur "/web/" ici
];

module.exports = config;
