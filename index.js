const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');

// === CONFIGURATION ===
const repoZipUrl = "https://github.com/vinicbot-dev/Vesper-Xmd/archive/refs/heads/main.zip"; 

// === Persistent extraction path (no more re-downloads) ===
const extractionPath = path.join(__dirname, '.npm_pkg');
const versionFile = path.join(extractionPath, '.version');
const repoFolder = path.join(extractionPath, 'repo');

async function downloadAndExtractRepo() {
  try {
    console.log('[🌐] Downloading Vesper-Xmd...');

    // No token needed for public GitHub ZIP
    const headers = { 'User-Agent': 'Vesper-Xmd-main' };

    const response = await axios.get(repoZipUrl, {
      responseType: 'arraybuffer',
      headers
    });

    const zipBuffer = Buffer.from(response.data);

    // Clean previous extraction but preserve settings
    if (fs.existsSync(repoFolder)) {
      const settingsFile = path.join(repoFolder, 'settings.js');
      let userSettings = null;

      if (fs.existsSync(settingsFile)) {
        userSettings = fs.readFileSync(settingsFile, 'utf8');
      }

      fs.rmSync(repoFolder, { recursive: true, force: true });
      fs.mkdirSync(repoFolder, { recursive: true });

      if (userSettings) {
        fs.writeFileSync(settingsFile, userSettings);
      }
    } else {
      fs.mkdirSync(repoFolder, { recursive: true });
    }

    // Extract ZIP contents
    const zip = new AdmZip(zipBuffer);
    zip.extractAllTo(repoFolder, true);

    fs.writeFileSync(versionFile, Date.now().toString());
    console.log('[✅] VINIC XMD updated successfully.');
    
  } catch (error) {
    console.log('[⚠️] Using cached version');
  }
}

(async () => {
  console.log('🚀 Starting Vesper-Xmd...');
  
  const shouldDownload = !fs.existsSync(versionFile);
  
  if (shouldDownload) {
    await downloadAndExtractRepo();
  } else {
    console.log('[✅] Using existing installation');
  }

  if (!fs.existsSync(repoFolder)) {
    fs.mkdirSync(repoFolder, { recursive: true });
  }

  // Safe read
  let extractedFolders = [];
  try {
    extractedFolders = fs.readdirSync(repoFolder).filter(f =>
      fs.statSync(path.join(repoFolder, f)).isDirectory()
    );
  } catch (e) {
    extractedFolders = [];
  }

  let extractedRepoPath;

  if (!extractedFolders.length) {
    if (fs.existsSync(path.join(repoFolder, 'index.js'))) {
      extractedRepoPath = repoFolder;
    } else {
      console.error('❌ No bot files found.');
      process.exit(1);
    }
  } else {
    extractedRepoPath = path.join(repoFolder, extractedFolders[0]);
  }

  // Copy settings.js if present
  const localConfigPath = path.join(__dirname, 'settings.js');
  const botConfigPath = path.join(extractedRepoPath, 'settings.js');
  
  if (fs.existsSync(localConfigPath)) {
    fs.copyFileSync(localConfigPath, botConfigPath);
    console.log('[⚙️] Settings loaded');
  }

  // Install dependencies if missing
  const nodeModulesPath = path.join(extractedRepoPath, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('[📦] Installing dependencies...');
    const { execSync } = require('child_process');
    try {
      execSync('npm install --production', { 
        cwd: extractedRepoPath, 
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'production' }
      });
    } catch (e) {
      console.log('[⚠️] Using existing dependencies');
    }
  }

  // Switch working directory
  process.chdir(extractedRepoPath);

  console.log('[▶️] Initializing VINIC-XMD...\n');

  // Hide internal logs
  const originalLog = console.log;
  console.log = function(...args) {
    const message = args.join(' ');
    if (
      !message.includes('github') &&
      !message.includes('download') &&
      !message.includes('extract') &&
      !message.includes('temp') &&
      !message.includes('repo') &&
      !message.includes('hidden')
    ) {
      originalLog.apply(console, args);
    }
  };

  // Start bot
  require(path.join(extractedRepoPath, 'index.js'));
})();