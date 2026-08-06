#!/usr/bin/env node
/**
 * Installs the packages the way a user does, and runs them.
 *
 * `pack-check` reads the tarball's file list. It cannot tell whether the code inside works,
 * and every defect in this file's history was invisible to it: packages that emitted ESM
 * while declaring CommonJS, packages whose named exports resolved to `undefined`, a plugin
 * that threw `self is not defined` on import, and a store that hung the process at exit.
 *
 * `npx jest` cannot see any of that either. The suites import from `src/`, and Jest supplies
 * a module loader and a teardown that Node does not. The bundle is only exercised by a real
 * install in a real process, which is what this does:
 *
 *   1. `npm pack` every publishable package.
 *   2. Install the tarballs into a throwaway project.
 *   3. `import` and `require` each one, checking a known export arrives by name.
 *   4. Run a save-and-query cycle, and confirm the process exits without being told to.
 *
 * Requires a build first: it packs whatever `dist/` currently holds.
 *
 * Usage: node scripts/consumer-check.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * One known export per package, checked by name.
 *
 * A default export arriving while the named one is `undefined` is exactly the CommonJS interop
 * failure this exists to catch, so the assertion has to name a symbol.
 */
const EXPECTED_EXPORT = {
    '@routier/core': 'BulkPersistChanges',
    '@routier/datastore': 'DataStore',
    '@routier/memory-plugin': 'MemoryPlugin',
    '@routier/file-system-plugin': 'FileSystemPlugin',
    '@routier/browser-storage-plugin': 'BrowserStoragePlugin',
    '@routier/dexie-plugin': 'DexiePlugin',
    '@routier/postgresql-plugin': 'PostgresDbPlugin',
    '@routier/mysql-plugin': 'MysqlDbPlugin',
    '@routier/pouchdb-plugin': 'PouchDbPlugin',
    '@routier/replication-plugin': 'HttpDbPlugin',
    '@routier/sql-plugin-core': 'getDialect',
    '@routier/sqlite-plugin': 'SqliteDbPlugin',
};

/**
 * Every publishable package, `@routier/sqlite-plugin` included.
 *
 * It used to be excluded: `sqlite3` was a hard dependency and built a native binding on
 * install, which needs a toolchain this check should not require. The default engine is now
 * `node:sqlite`, which ships with Node, and `sqlite3` is an optional peer. Nothing compiles.
 */
const PACKAGE_DIRECTORIES = [
    'core', 'datastore', 'plugins/memory', 'plugins/file-system', 'plugins/browser-storage',
    'plugins/dexie', 'plugins/postgresql', 'plugins/mysql', 'plugins/pouchdb',
    'plugins/replication', 'plugins/sql-core', 'plugins/sqlite',
];

const run = (command, args, cwd) =>
    execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

const project = mkdtempSync(join(tmpdir(), 'routier-consumer-'));
const tarballs = join(project, 'tarballs');

let failures = 0;

try {
    writeFileSync(join(project, 'package.json'), JSON.stringify({
        name: 'routier-consumer-check', private: true, version: '1.0.0', type: 'module',
    }, null, 2));

    run('mkdir', ['-p', tarballs]);

    for (const directory of PACKAGE_DIRECTORIES) {
        run('npm', ['pack', '--pack-destination', tarballs], join(root, directory));
    }

    const files = readdirSync(tarballs).map(f => join(tarballs, f));

    console.log(`Installing ${files.length} package(s) into a clean project...`);
    run('npm', ['install', ...files], project);

    // Written as a script rather than run in-process: the exit check needs its own process,
    // and resolution has to happen from the consumer's node_modules, not this repository's.
    const probe = `
const assertions = ${JSON.stringify(EXPECTED_EXPORT)};
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

let failures = 0;

for (const [name, symbol] of Object.entries(assertions)) {
    for (const [kind, load] of [['import', (n) => import(n)], ['require', async (n) => require(n)]]) {
        try {
            const loaded = await load(name);

            if (loaded[symbol] === undefined) {
                console.error(\`  x \${name}: \${kind} resolved but '\${symbol}' is undefined\`);
                failures++;
                continue;
            }
        } catch (error) {
            console.error(\`  x \${name}: \${kind} threw \${error.message.split('\\n')[0]}\`);
            failures++;
        }
    }
}

const { DataStore } = await import('@routier/datastore');
const { MemoryPlugin } = await import('@routier/memory-plugin');
const { s } = await import('@routier/core/schema');

const schema = s.define('users', {
    id: s.string().key().identity(),
    name: s.string(),
    age: s.number(),
}).compile();

class Ctx extends DataStore {
    users = this.collection(schema).proxy().create();
}

const ctx = new Ctx(new MemoryPlugin('consumer-check'));

await ctx.users.addAsync({ name: 'Ada', age: 36 });
await ctx.users.addAsync({ name: 'Grace', age: 45 });
await ctx.saveChangesAsync();

const older = await ctx.users.where(([u, p]) => u.age > p.min, { min: 40 }).toArrayAsync();

if (older.length !== 1 || older[0].name !== 'Grace') {
    console.error('  x save/query cycle returned ' + JSON.stringify(older.map(u => u.name)));
    failures++;
}

if (failures > 0) {
    process.exit(1);
}

console.log('  ok  every package imports, requires, and round-trips a save');

// No destroyAsync(), deliberately. If a handle is still referenced this process hangs, and
// the timeout below turns that into a failure. See known defect #54.
`;

    writeFileSync(join(project, 'probe.mjs'), probe);

    try {
        const output = execFileSync(process.execPath, ['probe.mjs'], {
            cwd: project,
            encoding: 'utf8',
            timeout: 60_000,
        });

        process.stdout.write(output);
    } catch (error) {
        const { code, signal, stdout, stderr } = error;

        process.stdout.write(stdout ?? '');
        process.stderr.write(stderr ?? '');

        failures++;

        if (signal === 'SIGTERM' || code === 'ETIMEDOUT') {
            console.error('  x the process did not exit on its own — a handle is still referenced');
        }
    }
} finally {
    rmSync(project, { recursive: true, force: true });
}

if (failures > 0) {
    console.error('\nThe published packages do not work as installed.');
    console.error('Build first (`npm run build`); a stale dist/ fails here for the wrong reason.');
    process.exit(1);
}

console.log('\nConsumer check passed.');
