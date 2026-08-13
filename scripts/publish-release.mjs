import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { packageTag, parsePackageTag, releasePackages } from './release-packages.mjs';

const event = process.env.EVENT_NAME;
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const packages = event === 'workflow_dispatch'
  ? releasePackages
  : [releasePackages.find(pkg => pkg.name === parsePackageTag(process.env.RELEASE_TAG ?? '').name)];

if (packages.some(pkg => pkg == null)) throw new Error('Could not resolve the requested release package');

const command = (program, args, options = {}) => {
  const result = spawnSync(program, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) throw new Error(`${program} ${args.join(' ')} failed with exit code ${result.status}`);
};

const versionExists = pkg => {
  const result = spawnSync('npm', ['view', `${pkg.name}@${pkg.version}`, 'version'], { stdio: 'ignore' });
  return result.status === 0;
};

// npm acknowledges a publish before every read replica necessarily serves it. Poll instead of
// treating ordinary registry propagation as a failed release; a retry remains bounded and the
// workflow's package-level existence check still makes the whole operation idempotent.
const waitForVersion = async (pkg, attempts = 12) => {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (versionExists(pkg)) return true;
    if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 5_000));
  }
  return false;
};

const tagExists = tag => spawnSync('git', ['rev-parse', '--verify', `refs/tags/${tag}`], { stdio: 'ignore' }).status === 0;
const releaseExists = tag => spawnSync('gh', ['release', 'view', tag], { stdio: 'ignore' }).status === 0;

const npmEnvironment = { ...process.env };
if (process.env.BOOTSTRAP_NPM_TOKEN) npmEnvironment.NODE_AUTH_TOKEN = process.env.BOOTSTRAP_NPM_TOKEN;
else delete npmEnvironment.NODE_AUTH_TOKEN; // Let npm use GitHub OIDC trusted publishing.

for (const pkg of packages) {
  const tag = packageTag(pkg);
  const dist = `${pkg.directory}/dist`;
  if (!fs.existsSync(dist)) throw new Error(`${dist} is missing; refusing to publish an unbuilt workspace`);

  if (versionExists(pkg)) {
    console.log(`${tag} already exists on npm; publication is idempotently skipped.`);
  } else {
    console.log(`Publishing ${tag}...`);
    command('npm', ['publish', '--workspace', pkg.name, '--access', 'public', '--provenance'], { env: npmEnvironment });
    if (!await waitForVersion(pkg)) throw new Error(`${tag} was not visible from npm after one minute`);
  }

  if (releaseExists(tag)) {
    console.log(`GitHub release ${tag} already exists; creation is skipped.`);
    continue;
  }

  const args = ['release', 'create', tag, '--title', tag, '--notes', `Published ${tag} to npm.`];
  if (tagExists(tag)) args.push('--verify-tag');
  else args.push('--target', head);
  command('gh', args);
}
