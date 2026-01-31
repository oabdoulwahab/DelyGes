// scripts/version.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const type = args[0] || 'patch';

// Lire app.json
const appJsonPath = path.join(__dirname, '..', 'app.json');
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

// Incrémenter la version
const versionParts = appJson.expo.version.split('.').map(Number);

switch(type) {
  case 'major':
    versionParts[0] += 1;
    versionParts[1] = 0;
    versionParts[2] = 0;
    break;
  case 'minor':
    versionParts[1] += 1;
    versionParts[2] = 0;
    break;
  case 'patch':
  default:
    versionParts[2] += 1;
    break;
}

const newVersion = versionParts.join('.');
const oldVersion = appJson.expo.version;
appJson.expo.version = newVersion;

// Écrire le nouveau app.json
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));

console.log(`✅ Version: ${oldVersion} → ${newVersion}`);

// Optionnel: Commit automatique
try {
  execSync(`git add app.json`, { stdio: 'inherit' });
  execSync(`git commit -m "v${newVersion}"`, { stdio: 'inherit' });
  console.log(`📝 Commit créé pour v${newVersion}`);
} catch (error) {
  console.log('ℹ️  Pas de commit automatique (pas dans un repo git ou erreur)');
}