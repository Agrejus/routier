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

/** Directories that hold publishable workspaces. A private package is skipped by name. */
const WORKSPACE_ROOTS = ['plugins'];
const STANDALONE = ['core', 'datastore', 'react'];

/** Every publishable package must ship these. */
const REQUIRED = [
    { label: 'a built bundle', matches: (files) => files.some(f => f.startsWith('dist/')) },
    { label: 'README.md', matches: (files) => files.includes('README.md') },
    { label: 'LICENSE', matches: (files) => files.includes('LICENSE') },
];

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

    for (const { label, matches } of FORBIDDEN) {
        const offenders = matches(files);

        if (offenders.length > 0) {
            problems.push(`publishes ${label} (${offenders.length}, e.g. ${offenders[0]})`);
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
