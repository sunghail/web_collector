const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const standaloneDir = path.join(projectRoot, '.next', 'standalone');
const staticSrc = path.join(projectRoot, '.next', 'static');
const publicSrc = path.join(projectRoot, 'public');

function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`Source not found, skipping: ${src}`);
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function rmDirSync(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * Find the directory containing server.js inside the standalone output.
 */
function findServerDir(dir) {
  const serverPath = path.join(dir, 'server.js');
  if (fs.existsSync(serverPath)) return dir;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') {
      const found = findServerDir(path.join(dir, entry.name));
      if (found) return found;
    }
  }
  return null;
}

console.log('Preparing standalone build...\n');

// Verify standalone output exists
if (!fs.existsSync(standaloneDir)) {
  console.error('ERROR: .next/standalone/ not found.');
  console.error('Make sure next.config.ts has output: "standalone" and run "next build" first.');
  process.exit(1);
}

// Find where server.js actually is
const serverDir = findServerDir(standaloneDir);
if (!serverDir) {
  console.error('ERROR: server.js not found in standalone output.');
  process.exit(1);
}

console.log(`Found server.js at: ${serverDir}`);

// If server.js is nested, flatten the structure to avoid Windows long path issues
if (serverDir !== standaloneDir) {
  console.log('\nFlattening nested standalone structure...');

  // Create a temp directory for the flattened output
  const tempDir = standaloneDir + '_flat';
  rmDirSync(tempDir);

  // Copy the nested server directory contents to temp (this has server.js, node_modules, .next, package.json)
  copyDirSync(serverDir, tempDir);

  // Remove the original standalone dir
  rmDirSync(standaloneDir);

  // Rename temp to standalone
  fs.renameSync(tempDir, standaloneDir);

  console.log('Flattened successfully! server.js is now at standalone root.');
}

// Now server.js is at standaloneDir root
// Copy static files
const staticDest = path.join(standaloneDir, '.next', 'static');
console.log('\nCopying .next/static/ ...');
copyDirSync(staticSrc, staticDest);

// Copy public folder
const publicDest = path.join(standaloneDir, 'public');
console.log('Copying public/ ...');
copyDirSync(publicSrc, publicDest);

// Copy env files
function copyEnvFile(filename) {
  const src = path.join(projectRoot, filename);
  const dest = path.join(standaloneDir, filename);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied: ${filename}`);
  }
}

copyEnvFile('.env');
copyEnvFile('.env.local');
copyEnvFile('.env.production');
copyEnvFile('.env.production.local');

// Verify final structure
const finalServerPath = path.join(standaloneDir, 'server.js');
if (fs.existsSync(finalServerPath)) {
  console.log('\n✓ Standalone build prepared successfully!');
  console.log(`  server.js: ${finalServerPath}`);
} else {
  console.error('\nERROR: server.js not found at standalone root after preparation!');
  process.exit(1);
}
