// scripts/auto-update.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Démarrage mise à jour automatique...');

try {
  // 1. Incrémenter version patch
  console.log('📦 Incrémentation version patch...');
  execSync('npm run version:patch', { stdio: 'inherit' });
  
  // 2. Lire nouvelle version
  const appJson = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'app.json'), 
    'utf8'
  ));
  const newVersion = appJson.expo.version;
  
  // 3. Publier mise à jour Android
  console.log(`📱 Publication Android v${newVersion}...`);
  execSync(`npx eas-cli@latest update --channel production --platform android --message "v${newVersion}" --auto`, { stdio: 'inherit' });
  
  // 4. Publier mise à jour iOS
  console.log(`🍎 Publication iOS v${newVersion}...`);
  execSync(`npx eas-cli@latest update --channel production --platform ios --message "v${newVersion}" --auto`, { stdio: 'inherit' });
  
  console.log('✅ Mise à jour complète publiée !');
} catch (error) {
  console.error('❌ Erreur:', error.message);
  process.exit(1);
}