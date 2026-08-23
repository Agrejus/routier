#!/usr/bin/env node
/**
 * Runs the SQLite and PGlite WASM plugins in a real browser and checks that they work and persist.
 *
 * This is the only place the browser build is executed. Jest cannot stand in for it: OPFS
 * exists only in a browser, and `createSyncAccessHandle` — which every OPFS VFS is built on —
 * exists only inside a worker. A jsdom test would prove nothing about either.
 *
 * What it asserts, in order:
 *
 *   1. The bundle builds through the `browser` condition, with no Node built-in reachable.
 *   2. A save and every query shape round-trip through WASM.
 *   3. `destroyAsync()` really removes the OPFS database.
 *   4. Data written by one page load is still there after a full reload — a new page, a new
 *      worker, a new WASM instance. This is the persistence claim, and reload is the only
 *      way to test it.
 *
 * The page is served over plain HTTP with no COOP or COEP headers, deliberately. The driver
 * uses the `opfs-sahpool` VFS precisely so that cross-origin isolation is not required, and
 * serving without those headers is what proves it.
 *
 * Requires Playwright, which this repository does not depend on:
 *
 *   npx playwright install chromium
 *   node e2e/browser/run.mjs
 *
 * Skips with exit code 0 when Playwright is absent, so it can sit in a pipeline that does not
 * install browsers.
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'http://localhost:8791';

let chromium;

try {
    ({ chromium } = await import('playwright'));
} catch {
    console.log('Playwright is not installed — skipping the browser check.');
    console.log('  npm install --no-save playwright && npx playwright install chromium');
    process.exit(0);
}

/** Rebuilds the fixture so the check never runs against a stale bundle. */
const build = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(here, 'build.mjs')], { stdio: 'inherit' });

    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`fixture build failed (${code})`)));
});

const serve = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(here, 'serve.mjs')], { stdio: ['ignore', 'pipe', 'inherit'] });

    child.stdout.on('data', chunk => {
        if (String(chunk).includes('serving')) {
            resolve(child);
        }
    });

    child.on('exit', code => reject(new Error(`server exited early (${code})`)));
});

const failures = [];

const check = (name, condition, detail) => {
    if (condition) {
        console.log(`  ok  ${name}`);
        return;
    }

    failures.push(`${name}: ${detail}`);
    console.error(`  FAIL ${name} — ${detail}`);
};

await build();

const server = await serve();
const browser = await chromium.launch();

try {
    const context = await browser.newContext();
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('pageerror', error => consoleErrors.push(error.message));

    // ---- first load: start from a known-empty database ----
    await page.goto(`${ORIGIN}/`);
    await page.waitForFunction(() => document.getElementById('ready')?.textContent === 'ready');

    await page.evaluate(() => window.routierReset());

    const first = await page.evaluate(() => window.routierCheck());

    check('starts empty after destroy', first.startupRows === 0,
        `expected 0 rows, got ${first.startupRows}`);
    check('saves and reads back', first.afterSave === 2,
        `expected 2 rows after save, got ${first.afterSave}`);
    check('updates in place', first.adaAge === 37,
        `expected age 37, got ${first.adaAge}`);

    // ---- second load: the persistence claim ----
    // A full navigation. New page, new worker, new WASM instance. Anything still readable
    // came off disk.
    await page.goto(`${ORIGIN}/?reload=1`);
    await page.waitForFunction(() => document.getElementById('ready')?.textContent === 'ready');

    const second = await page.evaluate(() => window.routierCheck());

    check('data survives a reload', second.startupRows === 2,
        `expected the 2 rows written by the previous load, got ${second.startupRows}`);

    // ---- cleanup, and prove destroy works from a cold start ----
    await page.goto(`${ORIGIN}/?cleanup=1`);
    await page.waitForFunction(() => document.getElementById('ready')?.textContent === 'ready');
    await page.evaluate(() => window.routierReset());

    const third = await page.evaluate(() => window.routierCheck());

    check('destroy removes the database', third.startupRows === 0,
        `expected 0 rows after destroy, got ${third.startupRows}`);

    check('no uncaught page errors', consoleErrors.length === 0, consoleErrors.join('; '));

    // ---- PGlite: the same claims, against real PostgreSQL in WASM ----
    //
    // A separate page, because it is a separate bundle resolving a separate `browser`
    // condition. The database lives in a leader-elected worker over `opfs-ahp://`, so a
    // main-thread build or a missing worker asset fails here and nowhere else.
    const pgPage = await context.newPage();
    const pgErrors = [];
    pgPage.on('pageerror', error => pgErrors.push(error.message));

    await pgPage.goto(`${ORIGIN}/pglite.html`);
    await pgPage.waitForFunction(() => document.getElementById('ready')?.textContent === 'ready');

    // `destroy()` on a PostgreSQL plugin closes the database and keeps the data, so the
    // fixture clears rows instead. That difference is the contract, not an oversight.
    await pgPage.evaluate(() => window.routierReset());

    const pgFirst = await pgPage.evaluate(() => window.routierCheck());

    check('pglite starts empty after a clear', pgFirst.startupRows === 0,
        `expected 0 rows, got ${pgFirst.startupRows}`);
    check('pglite saves and reads back', pgFirst.afterSave === 2,
        `expected 2 rows after save, got ${pgFirst.afterSave}`);
    check('pglite updates in place', pgFirst.adaAge === 37,
        `expected age 37, got ${pgFirst.adaAge}`);
    check('pglite decodes a JSONB column', pgFirst.nestedNote === 'first',
        `expected the nested note back as a structure, got ${JSON.stringify(pgFirst.nestedNote)}`);

    // A full navigation. New page, new worker, new WASM instance, new PostgreSQL. Anything
    // still readable came out of OPFS.
    await pgPage.goto(`${ORIGIN}/pglite.html?reload=1`);
    await pgPage.waitForFunction(() => document.getElementById('ready')?.textContent === 'ready');

    const pgSecond = await pgPage.evaluate(() => window.routierCheck());

    check('pglite data survives a reload', pgSecond.startupRows === 2,
        `expected the 2 rows written by the previous load, got ${pgSecond.startupRows}`);

    // Leave OPFS clean for the next run.
    await pgPage.evaluate(() => window.routierReset());

    check('no uncaught page errors (pglite)', pgErrors.length === 0, pgErrors.join('; '));
} finally {
    await browser.close();
    server.kill();
}

if (failures.length > 0) {
    console.error(`\n${failures.length} browser check(s) failed.`);
    process.exit(1);
}

console.log('\nBrowser check passed: SQLite and PGlite run in the browser and persist across reloads.');
