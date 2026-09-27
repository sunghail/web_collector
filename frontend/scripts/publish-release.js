/**
 * After electron-builder publishes a draft release,
 * this script finds the draft and publishes it (sets draft=false).
 */
const https = require('https');
const pkg = require('../package.json');

const GH_TOKEN = process.env.GH_TOKEN;
const OWNER = 'huckwnmo99';
const REPO = 'Collector_program_update';
const VERSION = `v${pkg.version}`;

if (!GH_TOKEN) {
  console.error('GH_TOKEN not set');
  process.exit(1);
}

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': `token ${GH_TOKEN}`,
        'User-Agent': 'WebCollector-Publisher',
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let buf = '';
      res.on('data', (chunk) => buf += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); } catch { resolve(buf); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log(`Looking for draft release ${VERSION}...`);

  const releases = await request('GET', `/repos/${OWNER}/${REPO}/releases`);
  const draft = releases.find(r => r.tag_name === VERSION && r.draft === true);

  if (!draft) {
    // Maybe already published
    const published = releases.find(r => r.tag_name === VERSION && r.draft === false);
    if (published) {
      console.log(`Release ${VERSION} is already published.`);
      return;
    }
    console.error(`No release found for ${VERSION}`);
    process.exit(1);
  }

  console.log(`Found draft release id=${draft.id}, publishing...`);
  const result = await request('PATCH', `/repos/${OWNER}/${REPO}/releases/${draft.id}`, {
    draft: false,
    tag_name: VERSION,
  });

  if (result.published_at) {
    console.log(`Published ${VERSION} at ${result.published_at}`);
    console.log(`URL: ${result.html_url}`);
  } else {
    console.error('Failed to publish:', JSON.stringify(result, null, 2));
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
