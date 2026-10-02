import { execFileSync } from 'node:child_process';
import { packageTag, parsePackageTag, releasePackages } from './release-packages.mjs';

const event = process.env.EVENT_NAME;
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const ref = process.env.GITHUB_REF;

const tagCommit = tag => {
  try {
    return execFileSync('git', ['rev-list', '-n', '1', tag], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

const versionExists = pkg => {
  try {
    execFileSync('npm', ['view', `${pkg.name}@${pkg.version}`, 'version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

if (event === 'workflow_dispatch') {
  const version = process.env.RELEASE_VERSION;
  if (ref !== 'refs/heads/main') throw new Error(`Coordinated releases must run from main, not ${ref ?? 'an unknown ref'}`);
  if (!version) throw new Error('A coordinated release needs a version');

  const mismatches = releasePackages.filter(pkg => pkg.version !== version);
  if (mismatches.length) {
    throw new Error(`These public packages do not have version ${version}: ${mismatches.map(pkg => `${pkg.name}=${pkg.version}`).join(', ')}`);
  }

  // A package tag is a source assertion. Never publish current code under a tag that points to
  // an older commit, even when the corresponding npm version has not been published yet.
  const stale = releasePackages
    .map(pkg => ({ pkg, tag: packageTag(pkg), commit: tagCommit(packageTag(pkg)) }))
    // A partial coordinated release can require a workflow-only correction on main. Tags for
    // versions already published must remain on their provenance commit; only an UNPUBLISHED
    // preparation tag is stale and safe to replace.
    .filter(item => item.commit != null && item.commit !== sha && !versionExists(item.pkg));
  if (stale.length) {
    throw new Error(`Release tags already point to a different commit. Delete these unpublished stale tags before retrying: ${stale.map(x => x.tag).join(', ')}`);
  }

  console.log(`Validated coordinated ${version} release for ${releasePackages.length} public packages.`);
} else {
  const requested = parsePackageTag(process.env.RELEASE_TAG ?? '');
  const pkg = releasePackages.find(candidate => candidate.name === requested.name);
  if (!pkg) throw new Error(`${requested.name} is not a public release workspace`);
  if (pkg.version !== requested.version) {
    throw new Error(`${requested.name} is ${pkg.version} in package.json, but the tag requests ${requested.version}`);
  }
  if (tagCommit(process.env.RELEASE_TAG) !== sha) throw new Error('The release tag does not resolve to the checked-out commit');
  console.log(`Validated ${process.env.RELEASE_TAG}.`);
}
