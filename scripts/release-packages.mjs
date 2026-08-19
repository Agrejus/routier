import fs from 'node:fs';

// Dependency order matters during a coordinated release. Datastore and replication have runtime
// dependencies on memory; SQL plugins have a peer dependency on sql-core.
export const releasePackageDirectories = [
  'core',
  'plugins/memory',
  'plugins/sql-core',
  'datastore',
  'plugins/replication',
  'plugins/blob',
  'plugins/browser-storage',
  'plugins/dexie',
  'plugins/encryption',
  'plugins/file-system',
  'plugins/mongodb',
  'plugins/mysql',
  'plugins/otel',
  'plugins/postgresql',
  'plugins/pouchdb',
  'plugins/sqlite',
  'react',
];

export const releasePackages = releasePackageDirectories.map(directory => {
  const manifest = JSON.parse(fs.readFileSync(`${directory}/package.json`, 'utf8'));
  return { directory, manifest, name: manifest.name, version: manifest.version };
});

export const parsePackageTag = tag => {
  const match = /^(@routier\/[^@]+)@([^@]+)$/.exec(tag);
  if (match == null) throw new Error(`Release tag '${tag}' must look like @routier/core@0.3.1`);
  return { name: match[1], version: match[2] };
};

export const packageTag = pkg => `${pkg.name}@${pkg.version}`;
