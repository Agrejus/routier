#!/usr/bin/env node
/**
 * Verifies that every publishable workspace packs what it claims to.
 *
 * `npm publish` does not check any of this. A `files` entry naming a file that does not exist
 * is silently dropped, so a package can advertise a README and a LICENSE in its manifest and
 * ship neither — which is exactly what half of these packages did. A package with no `files`
 * field at all is worse: it publishes the whole directory, including `src/`, tests, and
 * configs.
 *
 * Run it in CI before a release. It runs `npm pack --dry-run` per workspace, reads the file
 * list back, and fails on anything missing.
 *
 * Usage: node scripts/pack-check.mjs
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Paths git tracks, exactly as git spells them.
 *
 * macOS resolves `README.md` to a file recorded as `readme.md`, so `npm pack` run there
 * reports a README that a Linux runner will not find. This repository has shipped that bug
 * in three packages — pouchdb, core and datastore — and each time it was invisible until CI.
 * Checking against the index rather than the filesystem catches it everywhere.
 */
const trackedPaths = (() => {
    try {
        return new Set(
            execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
                .split('\n')
                .filter(Boolean)
        );
    } catch {
        // Not a git checkout (an unpacked tarball, say). The pack list is still checked.
        return null;
    }
})();

/** Case-sensitive names a package must have committed, not merely present on disk. */
const CASE_SENSITIVE_FILES = ['README.md', 'LICENSE'];

/** Directories that hold publishable workspaces. A private package is skipped by name. */
const WORKSPACE_ROOTS = ['plugins'];
const STANDALONE = ['core', 'datastore', 'react'];

/** Every publishable package must ship these. */
const REQUIRED = [
    { label: 'a built bundle', matches: (files) => files.some(f => f.startsWith('dist/')) },
    { label: 'README.md', matches: (files) => files.includes('README.md') },
    { label: 'LICENSE', matches: (files) => files.includes('LICENSE') },
];

/**
 * Every path the manifest promises, so each can be checked against what the tarball holds.
 *
 * `main`, `types`, `module` and every string in `exports`. npm does not verify any of them:
 * a package whose `main` points at a file it did not pack installs cleanly and fails on the
 * consumer's first `import`.
 *
 * This is not hypothetical. `@routier/sqlite-plugin`, `@routier/postgresql-plugin` and
 * `@routier/browser-storage-plugin` are all published at 0.2.x with `main: ./dist/index.js`
 * and **no `dist/` in the tarball at all** — they shipped `src/`, `tsconfig.json` and
 * `jest.config.js` instead. All three are unusable as published. The `files` allowlist that
 * would have prevented it was missing, so the pack took whatever happened to be on disk.
 */
const entryPoints = (manifest) => {
    const found = [];

    const push = (field, value) => {
        if (typeof value === 'string' && value.startsWith('.')) {
            found.push({ field, path: value.replace(/^\.\//, '') });
        }
    };

    push('main', manifest.main);
    push('types', manifest.types);
    push('typings', manifest.typings);
    push('module', manifest.module);
    push('browser', typeof manifest.browser === 'string' ? manifest.browser : undefined);

    // `exports` nests arbitrarily: "." -> { import, require, types } and so on.
    const walkExports = (node, trail) => {
        if (typeof node === 'string') {
            push(`exports${trail}`, node);
            return;
        }

        if (node == null || typeof node !== 'object') {
            return;
        }

        for (const [key, child] of Object.entries(node)) {
            walkExports(child, `${trail}[${key}]`);
        }
    };

    walkExports(manifest.exports, '');

    return found;
};

/** These must never be published. */
const FORBIDDEN = [
    { label: 'source files', matches: (files) => files.filter(f => f.startsWith('src/')) },
    { label: 'test files', matches: (files) => files.filter(f => /\.test\.[cm]?[jt]sx?$/.test(f)) },
];

const packageDirectories = () => {
    const found = [];

    for (const parent of WORKSPACE_ROOTS) {
        const parentPath = join(root, parent);

        if (existsSync(parentPath) === false) {
            continue;
        }

        for (const entry of readdirSync(parentPath)) {
            if (existsSync(join(parentPath, entry, 'package.json'))) {
                found.push(join(parent, entry));
            }
        }
    }

    for (const entry of STANDALONE) {
        if (existsSync(join(root, entry, 'package.json'))) {
            found.push(entry);
        }
    }

    return found.sort();
};

const packedFiles = (directory) => {
    // `--json` gives the file list without unpacking anything. `--dry-run` writes no tarball.
    const output = execFileSync('npm', ['pack', '--dry-run', '--json'], {
        cwd: join(root, directory),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    const [result] = JSON.parse(output);

    return (result?.files ?? []).map(f => f.path);
};

let failures = 0;
let checked = 0;

for (const directory of packageDirectories()) {
    const manifest = JSON.parse(readFileSync(join(root, directory, 'package.json'), 'utf8'));

    if (manifest.private === true) {
        console.log(`- ${manifest.name ?? directory}: private, skipped`);
        continue;
    }

    checked++;

    let files;

    try {
        files = packedFiles(directory);
    } catch (error) {
        failures++;
        console.error(`✗ ${manifest.name}: npm pack failed\n  ${error.message.trim()}`);
        continue;
    }

    const problems = [];

    for (const { label, matches } of REQUIRED) {
        if (matches(files) === false) {
            problems.push(`missing ${label}`);
        }
    }

    // The manifest's own promises. A missing bundle is caught by REQUIRED, but a bundle that
    // exists under a name `main` does not point at is not, and reads identically to a working
    // package until someone imports it.
    for (const { field, path } of entryPoints(manifest)) {
        if (files.includes(path)) {
            continue;
        }

        problems.push(`${field} points at '${path}', which is not in the tarball`);
    }

    for (const { label, matches } of FORBIDDEN) {
        const offenders = matches(files);

        if (offenders.length > 0) {
            problems.push(`publishes ${label} (${offenders.length}, e.g. ${offenders[0]})`);
        }
    }

    // Checked against git rather than the filesystem, so a case-insensitive machine reports
    // the same result a Linux runner will.
    if (trackedPaths != null) {
        for (const name of CASE_SENSITIVE_FILES) {
            const expected = `${directory}/${name}`;

            if (trackedPaths.has(expected)) {
                continue;
            }

            const wrongCase = [...trackedPaths].find(
                p => p.toLowerCase() === expected.toLowerCase()
            );

            problems.push(wrongCase == null
                ? `${name} is not committed`
                : `${name} is committed as '${wrongCase.split('/').pop()}' — the wrong case is dropped from the pack on a case-sensitive filesystem`);
        }
    }

    if (problems.length === 0) {
        console.log(`✓ ${manifest.name} (${files.length} files)`);
        continue;
    }

    failures++;
    console.error(`✗ ${manifest.name}`);

    for (const problem of problems) {
        console.error(`    ${problem}`);
    }
}

if (failures > 0) {
    console.error(`\n${failures} of ${checked} package(s) would publish incorrectly.`);
    console.error('A `files` entry naming a file that does not exist is dropped silently — build first, then re-run.');
    process.exit(1);
}

console.log(`\n${checked} package(s) pack correctly.`);
