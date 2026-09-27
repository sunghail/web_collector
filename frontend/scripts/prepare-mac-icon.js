const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const resourcesDir = path.join(projectRoot, 'resources');
const inputPath = path.join(resourcesDir, 'icon.png');
const iconsetPath = path.join(resourcesDir, 'icon.iconset');
const outputPath = path.join(resourcesDir, 'icon.icns');

if (!fs.existsSync(inputPath)) {
  console.error(`Missing source icon: ${inputPath}`);
  process.exit(1);
}

if (process.platform !== 'darwin') {
  if (fs.existsSync(outputPath)) {
    console.log(`Using existing macOS icon: ${outputPath}`);
    process.exit(0);
  }

  console.error('macOS icon generation requires macOS tools: sips and iconutil.');
  console.error('Run this script on macOS, or use the GitHub Actions macOS release workflow.');
  process.exit(1);
}

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit' });
}

fs.rmSync(iconsetPath, { recursive: true, force: true });
fs.mkdirSync(iconsetPath, { recursive: true });

const sizes = [
  { name: 'icon_16x16.png', size: 16 },
  { name: 'icon_16x16@2x.png', size: 32 },
  { name: 'icon_32x32.png', size: 32 },
  { name: 'icon_32x32@2x.png', size: 64 },
  { name: 'icon_128x128.png', size: 128 },
  { name: 'icon_128x128@2x.png', size: 256 },
  { name: 'icon_256x256.png', size: 256 },
  { name: 'icon_256x256@2x.png', size: 512 },
  { name: 'icon_512x512.png', size: 512 },
  { name: 'icon_512x512@2x.png', size: 1024 },
];

for (const icon of sizes) {
  run('sips', ['-z', String(icon.size), String(icon.size), inputPath, '--out', path.join(iconsetPath, icon.name)]);
}

run('iconutil', ['-c', 'icns', iconsetPath, '-o', outputPath]);
fs.rmSync(iconsetPath, { recursive: true, force: true });

console.log(`macOS icon created: ${outputPath}`);
