#!/usr/bin/env node
/**
 * deploy.mjs — publish a GitHub release (and optionally Chrome Web Store)
 *
 * Usage:
 *   node scripts/deploy.mjs github        # GitHub release only
 *   node scripts/deploy.mjs cws           # Chrome Web Store only  (TODO)
 *   node scripts/deploy.mjs all           # both
 *   node scripts/deploy.mjs               # defaults to "github"
 *
 * Required env vars (add to ~/.env or export before running):
 *   XINBENLV_PAT_FOR_PUBLIC_REPO   — GitHub PAT with repo + write:packages scope
 *
 * Future CWS env vars (set when implementing):
 *   CWS_CLIENT_ID
 *   CWS_CLIENT_SECRET
 *   CWS_REFRESH_TOKEN
 *   CWS_EXTENSION_ID
 */

import { execSync, spawnSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── helpers ──────────────────────────────────────────────────────────────────

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, stdio: 'pipe', ...opts }).toString().trim();
}

function log(msg) { console.log(`\x1b[36m▶\x1b[0m ${msg}`); }
function ok(msg)  { console.log(`\x1b[32m✔\x1b[0m ${msg}`); }
function die(msg) { console.error(`\x1b[31m✖\x1b[0m ${msg}`); process.exit(1); }

function requireEnv(name) {
  const val = process.env[name];
  if (!val) die(`Missing env var: ${name}. Set it in ~/.env or export it.`);
  return val;
}

// ── read project metadata ─────────────────────────────────────────────────────

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version;
const TAG = `v${VERSION}`;

function getCommit() {
  try { return run('git rev-parse --short=6 HEAD'); } catch { return '000000'; }
}

// ── targets ───────────────────────────────────────────────────────────────────

async function deployGithub() {
  log(`Deploying GitHub release ${TAG}…`);

  const token = requireEnv('XINBENLV_PAT_FOR_PUBLIC_REPO');

  // 1. Ensure working tree is clean
  const dirty = run('git status --porcelain');
  if (dirty) die('Working tree is dirty. Commit or stash changes before releasing.');

  // 2. Ensure tag doesn't already exist
  const tags = run('git tag').split('\n');
  if (tags.includes(TAG)) die(`Tag ${TAG} already exists. Bump the version first.`);

  // 3. Build + zip
  log('Building extension…');
  run('pnpm build', { stdio: 'inherit' });
  log('Zipping extension…');
  run('pnpm zip', { stdio: 'inherit' });

  // 4. Find the zip
  const zipPath = findZip();
  if (!zipPath) die('Could not find zip output. Run `pnpm zip` manually to debug.');
  ok(`Zip: ${zipPath}`);

  // 5. Create and push git tag
  log(`Creating tag ${TAG}…`);
  run(`git tag -a ${TAG} -m "Release ${TAG}"`);
  run(`git push origin ${TAG}`);
  ok(`Tag ${TAG} pushed`);

  // 6. Create GitHub release via API
  log('Creating GitHub release…');
  const commit = getCommit();
  const releaseBody = [
    `## GitHub RichCard ${TAG}`,
    '',
    `**Commit:** \`${commit}\``,
    '',
    '### Install',
    '1. Download the `.zip` from Assets below',
    '2. Unzip and load the folder as an unpacked extension in `chrome://extensions`',
    '',
    '### Changes',
    '_See commit history for details._',
  ].join('\n');

  const releaseRes = await ghApi(token, 'POST', '/repos/xinbenlv/github-richcard/releases', {
    tag_name: TAG,
    name: `GitHub RichCard ${TAG}`,
    body: releaseBody,
    draft: false,
    prerelease: VERSION.includes('-'),
  });

  if (!releaseRes.id) {
    die(`Failed to create release: ${JSON.stringify(releaseRes)}`);
  }
  ok(`Release created: ${releaseRes.html_url}`);

  // 7. Upload zip asset
  log('Uploading zip asset…');
  const uploadUrl = releaseRes.upload_url.replace('{?name,label}', '');
  const zipName = zipPath.split('/').pop();
  const zipData = readFileSync(zipPath);

  const uploadRes = await fetch(`${uploadUrl}?name=${encodeURIComponent(zipName)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/zip',
      'Content-Length': String(zipData.length),
    },
    body: zipData,
  });
  const uploadJson = await uploadRes.json();
  if (!uploadJson.id) die(`Upload failed: ${JSON.stringify(uploadJson)}`);
  ok(`Asset uploaded: ${uploadJson.browser_download_url}`);

  console.log('');
  console.log(`\x1b[1m\x1b[32m🎉 GitHub release ${TAG} published!\x1b[0m`);
  console.log(`   ${releaseRes.html_url}`);
}

async function deployCws() {
  // TODO: implement Chrome Web Store publishing via the CWS Publish API
  // Requires: CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN, CWS_EXTENSION_ID
  //
  // Steps (to implement):
  //   1. Exchange refresh token for access token (POST https://oauth2.googleapis.com/token)
  //   2. Upload zip  (PUT https://www.googleapis.com/upload/chromewebstore/v1.1/items/{id})
  //   3. Publish     (POST https://www.googleapis.com/chromewebstore/v1.1/items/{id}/publish)
  //
  // Useful packages: chrome-webstore-upload (npm)
  die('Chrome Web Store deployment is not yet implemented. Coming soon!');
}

// ── utils ─────────────────────────────────────────────────────────────────────

function findZip() {
  try {
    const result = run('find .output -name "*.zip" | head -1');
    return result ? join(ROOT, result) : null;
  } catch { return null; }
}

async function ghApi(token, method, path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

// ── main ──────────────────────────────────────────────────────────────────────

const target = process.argv[2] ?? 'github';

if (!['github', 'cws', 'all'].includes(target)) {
  die(`Unknown target "${target}". Use: github | cws | all`);
}

if (target === 'github' || target === 'all') await deployGithub();
if (target === 'cws'    || target === 'all') await deployCws();
