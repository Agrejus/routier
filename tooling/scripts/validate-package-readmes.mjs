import fs from 'node:fs';
import { releasePackages } from './release-packages.mjs';

const logo = 'https://routier.dev/routier.svg';
const failures = [];

for (const pkg of releasePackages) {
  const path = `${pkg.directory}/README.md`;
  if (!fs.existsSync(path)) {
    failures.push(`${pkg.name}: missing ${path}`);
    continue;
  }

  const readme = fs.readFileSync(path, 'utf8');
  if (!readme.includes(`src="${logo}"`)) {
    failures.push(`${pkg.name}: README must use the public Routier logo URL`);
  }

  const references = [
    ...[...readme.matchAll(/src=["']([^"']+)["']/gi)].map(match => match[1]),
    ...[...readme.matchAll(/\]\(([^\s)]+)(?:\s+[^)]*)?\)/g)].map(match => match[1]),
  ];
  const relative = references.filter(reference => !/^(?:https?:\/\/|mailto:|#)/i.test(reference));
  if (relative.length) {
    failures.push(`${pkg.name}: README contains relative links that will break on npm: ${relative.join(', ')}`);
  }
}

if (failures.length) {
  throw new Error(`Package README validation failed:\n- ${failures.join('\n- ')}`);
}

console.log(`Validated ${releasePackages.length} public package READMEs.`);
