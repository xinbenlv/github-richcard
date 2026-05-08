#!/usr/bin/env node
/**
 * deploy.mjs — publish a release across stores.
 *
 * Usage:
 *   node scripts/deploy.mjs github         # GitHub release (Chrome + Firefox + sources zips attached)
 *   node scripts/deploy.mjs firefox        # AMO submission
 *   node scripts/deploy.mjs cws            # Chrome Web Store submission
 *   node scripts/deploy.mjs edge           # Microsoft Edge Add-ons submission
 *   node scripts/deploy.mjs all            # github + firefox + cws + edge
 *   node scripts/deploy.mjs                # defaults to "github"
 *
 * Required env vars (github target):
 *   GITHUB_PAT_XINBENLV_PUBLIC_REPO_ALL_READWRITE  — GitHub PAT (or legacy XINBENLV_PAT_FOR_PUBLIC_REPO)
 *
 * Required env vars (firefox target):
 *   AMO_JWT_ISSUER                                 — addons.mozilla.org JWT issuer
 *   AMO_JWT_SECRET                                 — addons.mozilla.org JWT secret
 *
 * Required env vars (cws target):
 *   CWS_KEY_FILE                                   — absolute path to GCP service-account JSON
 *                                                    (the SA must be a publisher on the CWS listing)
 *
 * Required env vars (edge target):
 *   EDGE_CLIENT_ID                                 — Partner Center API client id
 *   EDGE_API_KEY                                   — Partner Center API key (v1.1 auth)
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir, tmpdir } from 'os';

// ── .env loader (no external dependency) ─────────────────────────────────────
// Loads ~/.env first, then ./.env in the repo. Later sources override earlier.
// Existing process.env values always win (don't clobber explicit exports).
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const content = readFileSync(path, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

loadEnvFile(join(homedir(), '.env'));
loadEnvFile(join(ROOT, '.env'));

function run(cmd, opts = {}) {
  const result = execSync(cmd, { cwd: ROOT, stdio: 'pipe', ...opts });
  return result ? result.toString().trim() : '';
}

function log(msg) { console.log(`\x1b[36m▶\x1b[0m ${msg}`); }
function ok(msg)  { console.log(`\x1b[32m✔\x1b[0m ${msg}`); }
function warn(msg){ console.log(`\x1b[33m⚠\x1b[0m ${msg}`); }
function die(msg) { console.error(`\x1b[31m✖\x1b[0m ${msg}`); process.exit(1); }

function requireEnv(name) {
  const val = process.env[name];
  if (!val) die(`Missing env var: ${name}. Set it in ~/.env or export it.`);
  return val;
}

const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version;
const TAG = `v${VERSION}`;

function getCommit() {
  try { return run('git rev-parse --short=6 HEAD'); } catch { return '000000'; }
}

const FIREFOX_EXTENSION_ID = 'github-richcard@xinbenlv';
const CWS_EXTENSION_ID = 'ehpaamakfflbhfeklicfimdoplkhnfhm';
const CWS_API = 'https://www.googleapis.com/upload/chromewebstore/v1.1/items';
const CWS_PUBLISH_API = 'https://www.googleapis.com/chromewebstore/v1.1/items';
const EDGE_PRODUCT_ID = 'a5fbc640-5e35-46d8-a4c8-d1da89e7dafa';
const EDGE_STORE_ID = '0RDCKCGBM60Z';

// ── build ─────────────────────────────────────────────────────────────────────

function buildAll() {
  log('Building Chrome zip…');
  run('pnpm zip', { stdio: 'inherit' });
  log('Building Firefox zip…');
  run('pnpm zip -b firefox', { stdio: 'inherit' });

  const chromeZip = findZip(`${VERSION}-chrome.zip`);
  const firefoxZip = findZip(`${VERSION}-firefox.zip`);
  const sourcesZip = findZip(`${VERSION}-sources.zip`);
  if (!chromeZip)  die('Could not find chrome zip in .output/');
  if (!firefoxZip) die('Could not find firefox zip in .output/');
  if (!sourcesZip) warn('No sources zip found — AMO may reject the submission.');

  ok(`Chrome:  ${chromeZip}`);
  ok(`Firefox: ${firefoxZip}`);
  if (sourcesZip) ok(`Sources: ${sourcesZip}`);

  verifyManifestIcons(chromeZip);
  verifyManifestIcons(firefoxZip);

  return { chromeZip, firefoxZip, sourcesZip };
}

// Reads PNG IHDR chunk to recover (width, height) without spawning sharp/imagemagick.
// PNG layout: 8-byte signature, then IHDR chunk (4-byte length, "IHDR", 4-byte width,
// 4-byte height, …). Width/height are big-endian uint32.
function readPngDimensions(buf) {
  if (buf.length < 24) throw new Error('file too small to be a PNG');
  const sig = buf.subarray(0, 8).toString('hex');
  if (sig !== '89504e470d0a1a0a') throw new Error('not a PNG (bad signature)');
  if (buf.subarray(12, 16).toString('ascii') !== 'IHDR') throw new Error('PNG missing IHDR');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// Guards against the v0.2.0 regression: wxt's default scaffold ships a single
// 16×16 placeholder cloned to every icon slot. CWS happily accepts the upload,
// but Chromium's SandboxedUnpacker rejects it at install time with
// "Could not decode image: 'icon-128.png'". We catch it here instead.
function verifyManifestIcons(zipPath) {
  log(`Verifying icons in ${zipPath.split('/').pop()}…`);
  const tmp = join(tmpdir(), `richcard-verify-${process.pid}-${Date.now()}`);
  run(`mkdir -p ${tmp}`);
  try {
    run(`unzip -qo "${zipPath}" -d "${tmp}"`);
    const manifest = JSON.parse(readFileSync(join(tmp, 'manifest.json'), 'utf8'));
    const icons = manifest.icons ?? {};
    const actionIcons = manifest.action?.default_icon ?? {};
    const allDeclared = { ...icons, ...(typeof actionIcons === 'object' ? actionIcons : {}) };
    const errors = [];
    for (const [sizeKey, relPath] of Object.entries(allDeclared)) {
      const expected = Number(sizeKey);
      if (!Number.isFinite(expected)) continue;
      const iconPath = join(tmp, relPath);
      if (!existsSync(iconPath)) {
        errors.push(`${relPath} declared for size ${expected} is missing`);
        continue;
      }
      const buf = readFileSync(iconPath);
      let dims;
      try { dims = readPngDimensions(buf); }
      catch (e) { errors.push(`${relPath}: ${e.message}`); continue; }
      if (dims.width !== expected || dims.height !== expected) {
        errors.push(
          `${relPath} declared as ${expected}×${expected} but file is ${dims.width}×${dims.height} ` +
          `— Chromium's installer will reject this with "Could not decode image"`,
        );
      }
    }
    if (errors.length) {
      die('Icon validation failed:\n  • ' + errors.join('\n  • '));
    }
    ok('Icons OK');
  } finally {
    run(`rm -rf "${tmp}"`);
  }
}

// ── targets ───────────────────────────────────────────────────────────────────

async function deployGithub({ chromeZip, firefoxZip, sourcesZip }) {
  log(`Deploying GitHub release ${TAG}…`);

  const PAT_ENV = process.env.GITHUB_PAT_XINBENLV_PUBLIC_REPO_ALL_READWRITE
    ? 'GITHUB_PAT_XINBENLV_PUBLIC_REPO_ALL_READWRITE'
    : 'XINBENLV_PAT_FOR_PUBLIC_REPO';
  const token = requireEnv(PAT_ENV);
  const CRED_FLAGS = `-c credential.helper= -c 'credential.helper=!f() { echo username=xinbenlv; echo "password=\$${PAT_ENV}"; }; f'`;

  const dirty = run('git status --porcelain');
  if (dirty) die('Working tree is dirty. Commit or stash changes before releasing.');

  const tags = run('git tag').split('\n');
  if (!tags.includes(TAG)) {
    log(`Creating tag ${TAG}…`);
    run(`git tag -a ${TAG} -m "Release ${TAG}"`);
    run(`git ${CRED_FLAGS} push origin ${TAG}`);
    ok(`Tag ${TAG} pushed`);
  } else {
    warn(`Tag ${TAG} already exists locally — assuming pushed.`);
  }

  log('Creating GitHub release…');
  const commit = getCommit();
  const changelogSection = extractChangelogSection(VERSION);
  const releaseBody = [
    `## GitHub RichCard ${TAG}`,
    '',
    `**Commit:** \`${commit}\``,
    '',
    '### Install (Chrome / Brave / Arc / Vivaldi / Edge — one-liner)',
    '```sh',
    'bash <(curl -fsSL https://raw.githubusercontent.com/xinbenlv/github-richcard/main/scripts/install.sh)',
    '```',
    'Or manually: download `…-chrome.zip` from Assets, unzip, and load unpacked in `chrome://extensions`.',
    '',
    '### Firefox',
    'Download `…-firefox.zip` from Assets, or install from [addons.mozilla.org](https://addons.mozilla.org/) once the listing is approved.',
    '',
    '### Changes',
    changelogSection ?? '_See commit history for details._',
  ].join('\n');

  const releaseRes = await ghApi(token, 'POST', '/repos/xinbenlv/github-richcard/releases', {
    tag_name: TAG,
    name: `GitHub RichCard ${TAG}`,
    body: releaseBody,
    draft: false,
    prerelease: VERSION.includes('-'),
  });
  if (!releaseRes.id) die(`Failed to create release: ${JSON.stringify(releaseRes)}`);
  ok(`Release created: ${releaseRes.html_url}`);

  const uploadUrl = releaseRes.upload_url.replace('{?name,label}', '');
  for (const zip of [chromeZip, firefoxZip, sourcesZip].filter(Boolean)) {
    await uploadAsset(uploadUrl, zip, token);
  }

  console.log('');
  console.log(`\x1b[1m\x1b[32m🎉 GitHub release ${TAG} published!\x1b[0m`);
  console.log(`   ${releaseRes.html_url}`);
}

async function deployFirefox({ firefoxZip, sourcesZip }) {
  log(`Submitting ${TAG} to addons.mozilla.org…`);
  const issuer = requireEnv('AMO_JWT_ISSUER');
  const secret = requireEnv('AMO_JWT_SECRET');

  // Critical: pass secrets via env vars, NEVER as CLI args — argv is visible
  // in `ps aux` and gets echoed in error stack traces. publish-browser-extension
  // accepts UPPER_SNAKE_CASE env equivalents of every flag.
  const childEnv = {
    ...process.env,
    FIREFOX_ZIP: firefoxZip,
    FIREFOX_EXTENSION_ID,
    FIREFOX_JWT_ISSUER: issuer,
    FIREFOX_JWT_SECRET: secret,
    FIREFOX_CHANNEL: 'listed',
    ...(sourcesZip ? { FIREFOX_SOURCES_ZIP: sourcesZip } : {}),
  };

  run('pnpm exec wxt submit', { stdio: 'inherit', env: childEnv });
  ok('Firefox submission complete (review pending on AMO).');
}

async function deployEdge({ chromeZip }) {
  log(`Submitting ${TAG} to Microsoft Edge Add-ons…`);
  const clientId = requireEnv('EDGE_CLIENT_ID');
  const apiKey = requireEnv('EDGE_API_KEY');

  // Same lesson as deployFirefox — secrets only via env, never argv.
  const childEnv = {
    ...process.env,
    EDGE_ZIP: chromeZip,
    EDGE_PRODUCT_ID,
    EDGE_CLIENT_ID: clientId,
    EDGE_API_KEY: apiKey,
  };

  run('pnpm exec wxt submit', { stdio: 'inherit', env: childEnv });
  ok('Edge submission complete (certification pending).');
}

async function deployCws({ chromeZip }) {
  log(`Uploading ${TAG} to Chrome Web Store…`);
  const keyFile = requireEnv('CWS_KEY_FILE');
  if (!existsSync(keyFile)) die(`CWS_KEY_FILE does not exist: ${keyFile}`);

  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/chromewebstore'],
  });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) die('Failed to obtain CWS access token.');
  ok('Service-account access token obtained');

  log('Uploading zip…');
  const zipData = readFileSync(chromeZip);
  const uploadRes = await fetch(`${CWS_API}/${CWS_EXTENSION_ID}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'x-goog-api-version': '2' },
    body: zipData,
  });
  const uploadResult = await uploadRes.json();
  if (uploadResult.uploadState === 'FAILURE') {
    die(`CWS upload failed:\n${JSON.stringify(uploadResult, null, 2)}`);
  }
  ok(`Upload state: ${uploadResult.uploadState}`);
  if (uploadResult.itemError?.length) {
    uploadResult.itemError.forEach((e) => warn(e.error_detail));
  }

  log('Publishing…');
  const publishRes = await fetch(`${CWS_PUBLISH_API}/${CWS_EXTENSION_ID}/publish`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-goog-api-version': '2',
      'Content-Length': '0',
    },
  });
  const publishResult = await publishRes.json();
  const status = publishResult.status ?? [];
  if (status.includes('OK') || status.includes('PUBLISHED_WITH_FRICTION_WARNING')) {
    ok(`Published! Status: ${status.join(', ')}`);
    console.log(`   https://chromewebstore.google.com/detail/${CWS_EXTENSION_ID}`);
  } else {
    die(`Publish failed:\n${JSON.stringify(publishResult, null, 2)}`);
  }
}

// ── utils ─────────────────────────────────────────────────────────────────────

function findZip(suffix) {
  const out = run(`find .output -maxdepth 1 -name "*${suffix}"`);
  const first = out.split('\n').filter(Boolean)[0];
  return first ? join(ROOT, first) : null;
}

function extractChangelogSection(version) {
  const path = join(ROOT, 'CHANGELOG.md');
  if (!existsSync(path)) return null;
  const lines = readFileSync(path, 'utf8').split('\n');
  const escaped = version.replace(/\./g, '\\.');
  const startIdx = lines.findIndex((l) => new RegExp(`^##\\s*\\[?${escaped}\\]?`).test(l));
  if (startIdx === -1) return null;
  const rest = lines.slice(startIdx + 1);
  const endOffset = rest.findIndex((l) => /^##\s/.test(l));
  const body = (endOffset === -1 ? rest : rest.slice(0, endOffset)).join('\n').trim();
  return body || null;
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

async function uploadAsset(uploadUrl, zipPath, token) {
  const zipName = zipPath.split('/').pop();
  const zipData = readFileSync(zipPath);
  log(`Uploading ${zipName}…`);
  const res = await fetch(`${uploadUrl}?name=${encodeURIComponent(zipName)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/zip',
      'Content-Length': String(zipData.length),
    },
    body: zipData,
  });
  const json = await res.json();
  if (!json.id) die(`Upload of ${zipName} failed: ${JSON.stringify(json)}`);
  ok(`Asset uploaded: ${json.browser_download_url}`);
}

// ── main ──────────────────────────────────────────────────────────────────────

const target = process.argv[2] ?? 'github';
if (!['github', 'firefox', 'cws', 'edge', 'all'].includes(target)) {
  die(`Unknown target "${target}". Use: github | firefox | cws | edge | all`);
}

const zips = buildAll();

if (target === 'github'  || target === 'all') await deployGithub(zips);
if (target === 'firefox' || target === 'all') await deployFirefox(zips);
if (target === 'cws'     || target === 'all') await deployCws(zips);
if (target === 'edge'    || target === 'all') await deployEdge(zips);
