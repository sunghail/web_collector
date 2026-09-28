// Writes dist-electron/app-config.json: the web address the desktop app opens.
// Release builds read it from WEB_COLLECTOR_APP_URL (a GitHub Actions variable, not a secret).
// Nothing secret goes into the installer; the database keys stay on Vercel.
const fs = require('fs');
const path = require('path');

const raw = (process.env.WEB_COLLECTOR_APP_URL || '').trim();

if (!raw) {
  console.error('WEB_COLLECTOR_APP_URL is not set. Example: WEB_COLLECTOR_APP_URL=https://web-collector.vercel.app');
  process.exit(1);
}

let url;
try {
  url = new URL(raw);
} catch {
  console.error(`WEB_COLLECTOR_APP_URL is not a valid address: ${raw}`);
  process.exit(1);
}

const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
if (url.protocol !== 'https:' && !isLocal) {
  console.error('WEB_COLLECTOR_APP_URL must start with https:// (only localhost may use http).');
  process.exit(1);
}

const outDir = path.join(__dirname, '..', 'dist-electron');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'app-config.json'), JSON.stringify({ appUrl: url.origin }, null, 2));
console.log(`Desktop app will open ${url.origin}`);
