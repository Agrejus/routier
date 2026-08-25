/**
 * Drives the harness in headless Chromium and reports what it found.
 *
 * HEADLESS on purpose. A headed browser throttles timers in an occluded or backgrounded window,
 * which makes every measurement here wrong in a way that looks plausible.
 *
 * Needs `playwright-core` and a Chromium build. If it is not installed this says so and exits
 * rather than failing obscurely — it is an opt-in check, not part of `npm test`.
 *
 *   node browser/transfer/run.mjs           correctness only
 *   node browser/transfer/run.mjs --bench   correctness, then the measurement
 *
 * Or `npm run test:transfer -w @routier/e2e`.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { buildHarness } from './build.mjs';

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.wasm': 'application/wasm',
    '.map': 'application/json',
};

const serve = (root) => new Promise((ready) => {
    const server = createServer(async (request, response) => {
        const path = request.url === '/' ? '/index.html' : request.url.split('?')[0];

        try {
            const body = await readFile(join(root, path));

            response.writeHead(200, {
                'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream',
                // The SAH pool VFS needs neither COOP nor COEP; serving without them is part of
                // what this proves.
                'Cache-Control': 'no-store',
            });
            response.end(body);
        } catch {
            if (process.env.HARNESS_TRACE) {
                console.error(`  404 ${path}`);
            }

            response.writeHead(404);
            response.end('not found');
        }
    });

    server.listen(0, '127.0.0.1', () => ready({ server, port: server.address().port }));
});

const loadPlaywright = async () => {
    try {
        return await import('playwright-core');
    } catch {
        console.error(
            'the transfer browser tests need playwright-core and a Chromium build:\n' +
            '  npm i -D playwright-core && npx playwright install chromium\n' +
            'Skipping.'
        );
        process.exit(2);
    }
};

const failures = [];
const check = (name, ok, detail) => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail == null ? '' : `  ${detail}`}`);

    if (ok === false) {
        failures.push(name);
    }
};

const main = async () => {
    const bench = process.argv.includes('--bench');
    const blocking = process.argv.includes('--blocking');
    const phases = process.argv.includes('--phases');
    const dissect = process.argv.includes('--dissect');
    const small = process.argv.includes('--small');
    const pglite = process.argv.includes('--pglite');
    const root = await buildHarness();
    const { server, port } = await serve(root);
    const { chromium } = await loadPlaywright();
    const browser = await chromium.launch();

    try {
        const page = await browser.newPage();

        page.on('pageerror', error => console.error('  page error:', error.message));
        page.on('console', message => {
            if (message.type() === 'error') {
                console.error('  console error:', message.text());
            }
        });

        await page.goto(`http://127.0.0.1:${port}/index.html`);
        await page.waitForFunction(() => window.__harness != null, null, { timeout: 30_000 });

        console.log('\nreal worker, real postMessage, real SQLite WASM\n');

        check('generated functions available', await page.evaluate(() => window.__harness.codecSupported()));

        // Chunk boundaries against a real stepping statement, not a fake one.
        for (const count of [0, 1, 100, 4095, 4096, 4097]) {
            const result = await page.evaluate(
                ([rows]) => window.__harness.compareRead('./worker.js', rows, 1),
                [count]
            );

            check(
                `${count} rows: coded entities identical to cloned`,
                result.identical && result.rows === count,
                `rows=${result.rows}`
            );

            if (result.identical === false) {
                console.log(`      coded : ${result.codedFingerprint.slice(0, 160)}`);
                console.log(`      cloned: ${result.clonedFingerprint.slice(0, 160)}`);
            }
        }

        const shapes = await page.evaluate(() => window.__harness.compareShapes('./worker.js', 250));

        for (const [name, result] of Object.entries(shapes)) {
            // A shape that throws on BOTH paths is a pre-existing limitation, not a codec defect.
            check(
                `query shape '${name}' behaves identically`,
                result.identical,
                result.threw ? `both threw: ${result.coded.slice(7, 90)}` : undefined
            );

            if (result.identical === false) {
                console.log(`      coded : ${result.coded.slice(0, 160)}`);
                console.log(`      cloned: ${result.cloned.slice(0, 160)}`);
            }
        }

        const write = await page.evaluate(() => window.__harness.compareWrite('./worker.js'));
        check('RETURNING row matches what a read gives back', write.identical);

        // Without this the benchmark below could be comparing the clone path to itself.
        const proof = await page.evaluate(() => window.__harness.proveCodecRan('./worker.js'));

        check('coded path really ran: date decoded to a Date', proof.codedDateIsDate);
        check('coded path really ran: nested value decoded to an object', proof.codedMetaIsObject);
        check('coded path really ran: boolean decoded to a boolean', proof.codedBooleanIsBoolean);
        check('clone path really ran: date still ISO text', proof.clonedDateIsText);
        check('clone path really ran: nested value still JSON text', proof.clonedMetaIsText);
        check('clone path really ran: boolean still 0/1', proof.clonedBooleanIsNumber);

        // A policy with no `unsafe-eval`. The codec is probed ALONE, on a page importing nothing
        // but `@routier/core/transfer`, because the full harness cannot get far enough to answer:
        // see the note this prints below.
        const probe = await browser.newPage();
        const probeErrors = [];

        probe.on('pageerror', error => probeErrors.push(error.message.split('\n')[0]));
        await probe.goto(`http://127.0.0.1:${port}/cspProbe.html`);
        await probe.waitForFunction(() => window.__csp != null, null, { timeout: 30_000 });

        // Plain values, computed in PAGE code at import time. Computing them inside an evaluate
        // callback would measure CDP's privileges instead: it bypasses the eval restriction.
        const cspProbe = await probe.evaluate(() => window.__csp);

        check('CSP without unsafe-eval: codec reports itself unsupported', cspProbe.codecSupported === false,
            `reported ${JSON.stringify(cspProbe.codecSupported)}`);
        check('CSP without unsafe-eval: encoder still works, it needs no codegen', cspProbe.encoderWorks === true);
        check('CSP without unsafe-eval: decode fails rather than misreporting', cspProbe.decodeSucceeded === false,
            cspProbe.decodeError == null ? undefined : cspProbe.decodeError.slice(0, 80));

        // The whole library under the same policy. This is expected to fail, and WHERE it fails is
        // the finding: schema compilation generates functions, so it needs `unsafe-eval` long
        // before a query is built. The codec's own fallback is correct but unreachable here.
        const cspPage = await browser.newPage();
        const cspErrors = [];

        cspPage.on('pageerror', error => cspErrors.push(error.message.split('\n')[0]));
        await cspPage.goto(`http://127.0.0.1:${port}/csp.html`);
        await cspPage.waitForTimeout(2000);

        const cspLoaded = await cspPage.evaluate(() => window.__harness != null);

        console.log(
            `  NOTE  full library under CSP: ${cspLoaded ? 'loaded' : 'did NOT load'}` +
            (cspErrors.length > 0 ? `\n        ${cspErrors[0].slice(0, 150)}` : '')
        );
        console.log('        Schema compile() generates functions, so routier needs unsafe-eval');
        console.log('        regardless of this codec. Pre-existing; see core/src/codegen.');

        if (bench) {
            console.log('\nreal read path, median of 5, entity level\n');
            console.log('  rows      coded     cloned   speedup');

            for (const count of [1, 100, 1000, 4000, 20000, 100000]) {
                const result = await page.evaluate(
                    ([rows]) => window.__harness.compareRead('./worker.js', rows, 5),
                    [count]
                );

                console.log(
                    `  ${String(count).padStart(6)}  ` +
                    `${result.codedMs.toFixed(2).padStart(8)}ms ` +
                    `${result.clonedMs.toFixed(2).padStart(8)}ms   ` +
                    `${result.speedup.toFixed(2)}x` +
                    (result.identical ? '' : '   ROWS DIFFER')
                );

                if (result.identical === false) {
                    failures.push(`bench ${count} rows produced different entities`);
                }
            }
        }
        if (blocking) {
            console.log('\nmain-thread availability during one read\n');
            console.log('  rows    path     total   longest block   >16ms   blocks>16  blocks>50');

            for (const count of [4000, 20000, 100000]) {
                const result = await page.evaluate(
                    ([rows]) => window.__harness.profileBlocking('./worker.js', rows),
                    [count]
                );

                for (const [name, profile] of [['coded', result.coded], ['cloned', result.cloned]]) {
                    console.log(
                        `  ${String(count).padStart(6)}  ${name.padEnd(7)}` +
                        `${profile.totalMs.toFixed(1).padStart(7)}ms` +
                        `${profile.longestBlockMs.toFixed(1).padStart(14)}ms` +
                        `${profile.blockedOver16Ms.toFixed(1).padStart(8)}ms` +
                        `${String(profile.stretchesOver16).padStart(11)}` +
                        `${String(profile.stretchesOver50).padStart(11)}`
                    );
                }
            }
        }
        if (phases) {
            console.log('\nwhere the time goes, median of 5\n');
            console.log('  rows     sqlite   rows+boundary        full read      codec share');
            console.log('                    coded  cloned    coded   cloned   of whole read');

            for (const count of [4000, 20000, 100000]) {
                const p = await page.evaluate(
                    ([rows]) => window.__harness.profilePhases('./worker.js', rows),
                    [count]
                );

                console.log(
                    `  ${String(count).padStart(6)}` +
                    `${p.execMs.toFixed(1).padStart(9)}ms` +
                    `${p.reachableCodedMs.toFixed(1).padStart(8)}${p.reachableClonedMs.toFixed(1).padStart(8)}` +
                    `${p.entityCodedMs.toFixed(1).padStart(9)}${p.entityClonedMs.toFixed(1).padStart(9)}` +
                    `${(p.savedShare * 100).toFixed(1).padStart(14)}%`
                );
            }
        }

        if (dissect) {
            console.log('\ninside the worker, stage by stage, median of 5');
            console.log('each stage includes the one above it, so differences are per-stage cost\n');
            console.log('  rows     get([])  buildRows   rawBuild  rawTyped  jsonParsed');

            for (const count of [4000, 20000, 100000]) {
                const d = await page.evaluate(([rows]) => window.__harness.dissect(rows), [count]);

                console.log(
                    `  ${String(count).padStart(6)}` +
                    `${d.getArray.toFixed(1).padStart(12)}` +
                    `${d.buildRows.toFixed(1).padStart(11)}` +
                    `${d.rawBuild.toFixed(1).padStart(11)}` +
                    `${d.rawTyped.toFixed(1).padStart(10)}` +
                    `${d.jsonParsed.toFixed(1).padStart(12)}`
                );
            }
        }

        if (small) {
            console.log('\ncost of one read, averaged over many\n');
            console.log('     rows       coded      cloned    codec costs   iterations');

            for (const [count, iterations] of [[1, 400], [10, 400], [100, 300], [500, 200], [1000, 150], [2000, 100], [4000, 80]]) {
                const r = await page.evaluate(
                    ([rows, runs]) => window.__harness.compareSmall('./worker.js', rows, runs),
                    [count, iterations]
                );

                const delta = r.deltaMs;

                console.log(
                    `  ${String(count).padStart(7)}` +
                    `${r.codedMs.toFixed(4).padStart(12)}ms` +
                    `${r.clonedMs.toFixed(4).padStart(10)}ms` +
                    `${(delta >= 0 ? '+' : '') + delta.toFixed(4)}ms`.padStart(15) +
                    `${String(r.iterations).padStart(13)}`
                );
            }
        }

        if (pglite) {
            console.log('\nPGlite: how much of a read is the worker boundary?\n');

            const pg = await browser.newPage();

            pg.on('pageerror', error => console.error('  page error:', error.message.split('\n')[0]));
            await pg.goto(`http://127.0.0.1:${port}/pglite.html`);
            await pg.waitForFunction(() => window.__pglite != null, null, { timeout: 60_000 });

            const shapes = await pg.evaluate(() => window.__pglite.valueShapes());

            console.log(`  values PGlite returns: ${JSON.stringify(shapes)}`);
            console.log('');
            console.log('    rows    in page   via worker    boundary   share of read');

            for (const count of [1000, 10000, 50000]) {
                const r = await pg.evaluate(
                    ([rows, runs]) => window.__pglite.compare(rows, runs),
                    [count, 5]
                );

                console.log(
                    `  ${String(count).padStart(6)}` +
                    `${r.inPageMs.toFixed(1).padStart(10)}ms` +
                    `${r.viaWorkerMs.toFixed(1).padStart(11)}ms` +
                    `${r.boundaryMs.toFixed(1).padStart(11)}ms` +
                    `${(r.boundaryShare * 100).toFixed(1).padStart(14)}%` +
                    (r.rowsMatch ? '' : '   ROW COUNT MISMATCH')
                );
            }

            console.log('\n  routier-owned channel with the codec vs PGlite\'s own proxy\n');
            console.log('    rows      proxy      coded    speedup   entities identical');

            for (const count of [1000, 10000, 50000]) {
                const r = await pg.evaluate(([rows, runs]) => window.__pglite.compareCodec(rows, runs), [count, 5]);

                console.log(
                    `  ${String(count).padStart(6)}` +
                    `${r.proxyMs.toFixed(1).padStart(10)}ms` +
                    `${r.codedMs.toFixed(1).padStart(9)}ms` +
                    `${r.speedup.toFixed(2).padStart(10)}x` +
                    `${(r.identical ? 'yes' : 'NO').padStart(15)}`
                );

                if (r.identical === false) {
                    console.log(`      proxy: ${r.proxySample.slice(0, 150)}`);
                    console.log(`      coded: ${r.codedSample.slice(0, 150)}`);
                }
            }

            console.log('\n  the SHIPPED plugin, through its real worker\n');

            const e2e = await browser.newPage();
            const e2eErrors = [];

            e2e.on('pageerror', error => e2eErrors.push(error.message.split('\n')[0]));
            await e2e.goto(`http://127.0.0.1:${port}/pgliteEndToEnd.html`);
            await e2e.waitForFunction(() => window.__pgEndToEnd != null, null, { timeout: 60_000 });

            console.log('    rows      coded     cloned   speedup   entities identical');

            for (const count of [1000, 10000]) {
                const r = await e2e.evaluate(([rows, runs]) => window.__pgEndToEnd.compare(rows, runs), [count, 3]);

                console.log(
                    `  ${String(count).padStart(6)}` +
                    `${r.codedMs.toFixed(1).padStart(10)}ms` +
                    `${r.clonedMs.toFixed(1).padStart(9)}ms` +
                    `${r.speedup.toFixed(2).padStart(10)}x` +
                    `${(r.identical ? 'yes' : 'NO').padStart(15)}`
                );

                if (r.identical === false) {
                    console.log(`      coded : ${r.codedSample}`);
                    console.log(`      cloned: ${r.clonedSample}`);
                    failures.push(`pglite entities differ at ${count} rows`);
                }
            }

            if (e2eErrors.length > 0) {
                console.log(`      page errors: ${e2eErrors[0].slice(0, 160)}`);
            }

            console.log('\n  in-page only: object rows vs array rows (no boundary)\n');
            console.log('    rows     object      array       saved');

            for (const count of [1000, 10000, 50000]) {
                const r = await pg.evaluate(([rows, runs]) => window.__pglite.compareRowMode(rows, runs), [count, 5]);

                console.log(
                    `  ${String(count).padStart(6)}` +
                    `${r.objectMs.toFixed(1).padStart(10)}ms` +
                    `${r.arrayMs.toFixed(1).padStart(10)}ms` +
                    `${r.savedMs.toFixed(1).padStart(10)}ms`
                );
            }
        }

    } finally {
        await browser.close();
        server.close();
    }

    console.log('');

    if (failures.length > 0) {
        console.error(`${failures.length} failed: ${failures.join(', ')}`);
        process.exit(1);
    }

    console.log('all checks passed');
};

await main();
