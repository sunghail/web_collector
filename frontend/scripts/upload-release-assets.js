const fs = require('fs');
const https = require('https');
const path = require('path');
const pkg = require('../package.json');

const GH_TOKEN = process.env.GH_TOKEN;
const OWNER = 'huckwnmo99';
const REPO = 'Collector_program_update';
const VERSION = `v${pkg.version}`;
const mode = process.argv[2] || 'all';
const distDir = path.join(__dirname, '..', 'dist-installer');

if (!GH_TOKEN) {
  console.error('GH_TOKEN not set');
  process.exit(1);
}

function request(method, hostname, requestPath, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname,
        path: requestPath,
        method,
        headers: {
          Authorization: `token ${GH_TOKEN}`,
          'User-Agent': 'WebCollector-AssetUploader',
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          const data = text ? safeJson(text) : null;
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
            return;
          }

          reject(new Error(`${method} ${requestPath} failed: ${res.statusCode} ${text}`));
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function api(method, requestPath, body) {
  const payload = body ? Buffer.from(JSON.stringify(body)) : null;
  return request(method, 'api.github.com', requestPath, payload, {
    Accept: 'application/vnd.github+json',
    ...(payload
      ? {
          'Content-Type': 'application/json',
          'Content-Length': String(payload.length),
        }
      : {}),
  });
}

function uploadAsset(releaseId, filePath) {
  const name = path.basename(filePath);
  const body = fs.readFileSync(filePath);
  const requestPath = `/repos/${OWNER}/${REPO}/releases/${releaseId}/assets?name=${encodeURIComponent(name)}`;
  return request('POST', 'uploads.github.com', requestPath, body, {
    'Content-Type': 'application/octet-stream',
    'Content-Length': String(body.length),
  });
}

async function getOrCreateRelease() {
  try {
    return await api('GET', `/repos/${OWNER}/${REPO}/releases/tags/${VERSION}`);
  } catch (error) {
    if (!String(error.message).includes('404')) {
      throw error;
    }
  }

  return api('POST', `/repos/${OWNER}/${REPO}/releases`, {
    tag_name: VERSION,
    name: pkg.version,
    draft: false,
    prerelease: false,
  });
}

function shouldUpload(name) {
  const isWindows =
    name === 'latest.yml' || /^Web-Collector-Setup-.+\.exe(\.blockmap)?$/.test(name);
  const isMac =
    name === 'latest-mac.yml' || /^Web-Collector-.+-mac-.+\.(dmg|zip)(\.blockmap)?$/.test(name);

  if (mode === 'windows') return isWindows;
  if (mode === 'mac') return isMac;
  return isWindows || isMac;
}

async function main() {
  if (!fs.existsSync(distDir)) {
    throw new Error(`dist-installer not found: ${distDir}`);
  }

  const files = fs
    .readdirSync(distDir)
    .filter(shouldUpload)
    .map((name) => path.join(distDir, name))
    .filter((filePath) => fs.statSync(filePath).isFile());

  if (files.length === 0) {
    throw new Error(`No ${mode} release assets found in ${distDir}`);
  }

  const release = await getOrCreateRelease();
  const assets = await api('GET', `/repos/${OWNER}/${REPO}/releases/${release.id}/assets`);

  for (const filePath of files) {
    const name = path.basename(filePath);
    const existing = assets.find((asset) => asset.name === name);
    if (existing) {
      console.log(`Deleting existing asset: ${name}`);
      await api('DELETE', `/repos/${OWNER}/${REPO}/releases/assets/${existing.id}`);
    }

    console.log(`Uploading asset: ${name}`);
    await uploadAsset(release.id, filePath);
  }

  console.log(`Uploaded ${files.length} asset(s) to ${VERSION}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
