// Deploy a released card build to the home server.
// Usage: node scripts/deploy.mjs <version>   (e.g. v1.2.0)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { connect } from './ha-client.mjs';

const ASSET = 'family-board-card.js';
const RESOURCE_PATH = `/local/family-board/${ASSET}`;
const REQUIRED_ENV = ['FB_SSH_TARGET', 'FB_HA_WWW', 'FB_HA_URL', 'FB_HA_TOKEN'];

/**
 * @param {Record<string, string | undefined>} env
 * @returns {string[]} names of required variables that are unset or empty
 */
export function missingEnv(env) {
  return REQUIRED_ENV.filter((name) => !env[name]);
}

/**
 * Decide how to point the Lovelace resource at the new version.
 * @param {{ id: string, url: string }[]} resources
 * @param {string} version
 * @returns {{ action: 'update', id: string, url: string } | { action: 'create', url: string }}
 */
export function planResourceUpdate(resources, version) {
  const url = `${RESOURCE_PATH}?v=${version}`;
  const existing = resources.find((r) => r.url.startsWith(RESOURCE_PATH));
  return existing ? { action: 'update', id: existing.id, url } : { action: 'create', url };
}

/** @param {string} version */
async function main(version) {
  const missing = missingEnv(process.env);
  if (missing.length > 0) {
    throw new Error(`Missing environment variable(s): ${missing.join(', ')}`);
  }
  const { FB_SSH_TARGET, FB_HA_WWW, FB_HA_URL, FB_HA_TOKEN } = /** @type {Record<string, string>} */ (process.env);

  const dir = mkdtempSync(join(tmpdir(), 'family-board-'));
  try {
    execFileSync('gh', ['release', 'download', version, '-p', ASSET, '--dir', dir, '--clobber'], { stdio: 'inherit' });
    execFileSync('scp', [join(dir, ASSET), `${FB_SSH_TARGET}:${FB_HA_WWW.replace(/\/$/, '')}/${ASSET}`], {
      stdio: 'inherit',
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const ha = await connect(FB_HA_URL, FB_HA_TOKEN);
  try {
    const plan = planResourceUpdate(await ha.call({ type: 'lovelace/resources' }), version);
    if (plan.action === 'update') {
      await ha.call({ type: 'lovelace/resources/update', resource_id: plan.id, res_type: 'module', url: plan.url });
    } else {
      await ha.call({ type: 'lovelace/resources/create', res_type: 'module', url: plan.url });
    }
    console.log(`Deployed ${version}: resource ${plan.action}d -> ${plan.url}`);
  } finally {
    ha.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version = process.argv[2];
  if (!version) {
    console.error('Usage: node scripts/deploy.mjs <version>');
    process.exit(1);
  }
  main(version).catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
