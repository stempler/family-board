// Download the pinned TaskMate release into the dev Home Assistant config (skipped if already there).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const version = readFileSync(join(root, 'taskmate.version'), 'utf8').trim();
const target = join(root, 'dev/ha/config/custom_components/taskmate');
const manifestPath = join(target, 'manifest.json');

const bare = (v) => String(v).replace(/^v/, '');

if (existsSync(manifestPath) && bare(JSON.parse(readFileSync(manifestPath, 'utf8')).version) === bare(version)) {
  console.log(`TaskMate ${version} already installed, skipping download.`);
  process.exit(0);
}

const url = `https://github.com/tempus2016/taskmate/releases/download/${version}/taskmate.zip`;
console.log(`Downloading ${url}`);
const res = await fetch(url);
if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
const files = unzipSync(new Uint8Array(await res.arrayBuffer()));

rmSync(target, { recursive: true, force: true });
for (const [name, data] of Object.entries(files)) {
  if (name.endsWith('/')) continue;
  const rel = normalize(name);
  if (rel.startsWith('..') || resolve(target, rel) !== join(target, rel)) throw new Error(`Unsafe path in zip: ${name}`);
  const out = join(target, rel);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, data);
}
console.log(`Installed TaskMate ${version} into ${target} (${Object.keys(files).length} entries).`);
