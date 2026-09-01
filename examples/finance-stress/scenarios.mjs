/**
 * The same workload against every storage plugin, driven through the real app.
 *
 * This is the pre-publish check. Unit tests verify each plugin against fakes and a contract
 * suite; this verifies the whole stack a consumer actually gets — a real bundler, real workers,
 * real WASM engines, React subscriptions, concurrent writers — and reports what each plugin costs.
 *
 * Nothing about the workload changes between plugins. Same schemas, same tracking modes, same
 * bots, same invariant. So a difference in the numbers is a difference in the plugin.
 *
 * The invariant is the important assertion, not the throughput: every account seeds at $1,000 and
 * every transfer conserves money, so total balance minus accounts × 1000 must be exactly zero.
 * Drift means a lost update — two writers racing one account — and no amount of speed excuses it.
 *
 *   node scenarios.mjs                     all three plugins
 *   node scenarios.mjs --plugin=sqlite     just one
 *   node scenarios.mjs --seconds=20        longer run
 *
 * Needs the repo built (`npm run build`) so the worker-backed plugins have their dist bundles,
 * and `playwright-core` with a Chromium build.
 */
import { spawn } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const argOf = (name, fallback) => {
    const found = process.argv.find(a => a.startsWith(`--${name}=`));

    return found == null ? fallback : found.slice(name.length + 3);
};

const PLUGINS = argOf('plugin', 'memory,sqlite,pglite').split(',');
const SECONDS = Number(argOf('seconds', '12'));
const USERS = Number(argOf('users', '10'));
const PORT = Number(argOf('port', '5199'));

const loadPlaywright = async () => {
    try {
        return await import('playwright-core');
    } catch {
        console.error(
            'scenarios need playwright-core and a Chromium build:\n' +
            '  npm i -D playwright-core && npx playwright install chromium\n'
        );
        process.exit(2);
    }
};

/** Vite's preview server, serving the built app. */
const startPreview = async () => {
    const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
        cwd: here,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    await new Promise((ready, fail) => {
        const timer = setTimeout(() => fail(new Error('vite preview did not start')), 30_000);

        server.stdout.on('data', chunk => {
            if (String(chunk).includes(String(PORT))) {
                clearTimeout(timer);
                ready();
            }
        });
    });

    // Vite binds `localhost`, which can resolve to ::1 while 127.0.0.1 refuses.
    return { server, origin: `http://localhost:${PORT}` };
};

/**
 * Console errors the engines log for things the plugin then handles.
 *
 * Not a way to make the check pass. Both are cases where the ENGINE reports before routier gets
 * to decide, and routier's answer is correct:
 *
 * - Tables are created lazily, so the first statement against a collection always misses. The
 *   plugin catches it, creates the table and retries — but PGlite has already written the failure
 *   to the console. Verified to occur only on a collection's first touch.
 * - The PGlite worker ships without pgvector on purpose (it is a separate optional package), and
 *   the plugin falls back to JSONB with in-memory similarity.
 */
const EXPECTED = [/relation ".*" does not exist/, /extension "vector" is not available/];

const expected = (text) => EXPECTED.some(pattern => pattern.test(text));

const failures = [];

const check = (name, ok, detail) => {
    console.log(`    ${ok ? 'PASS' : 'FAIL'}  ${name}${detail == null ? '' : `  ${detail}`}`);

    if (ok === false) {
        failures.push(name);
    }
};

const runPlugin = async (browser, origin, plugin) => {
    const page = await browser.newPage();
    const errors = [];

    page.on('pageerror', error => errors.push(error.message.split('\n')[0]));
    page.on('console', message => {
        const text = message.text();

        if (message.type() !== 'error' || expected(text)) {
            return;
        }

        errors.push(text.slice(0, 160));
    });

    console.log(`\n  ${plugin}`);

    try {
        await page.goto(`${origin}/?${plugin.includes('=') ? plugin : `plugin=${plugin}`}`, { waitUntil: 'load' });

        // A cold WASM engine boots PostgreSQL or SQLite before the first row exists.
        await page.waitForFunction(
            () => window.__financeStress != null && window.__financeStress.seeded(),
            null,
            { timeout: 120_000 }
        );

        check('reports the plugin under test', (await page.getByTestId('plugin').innerText()).startsWith(plugin.split('&')[0].replace('plugin=', '')));

        const read = () => page.evaluate(() => ({
            ...window.__financeStress.metrics(),
            drift: document.querySelector('[data-testid="drift"]')?.textContent?.trim(),
            ledger: document.querySelector('[data-testid="tx-count"]')?.textContent?.trim(),
        }));

        // Concurrent writers: N stores over one database, all transferring between accounts.
        await page.getByTestId('toggle-sim').click();
        await page.waitForTimeout(SECONDS * 1000);
        await page.getByTestId('toggle-sim').click();
        await page.waitForTimeout(1500);

        const after = await read();

        check('the ledger grew', after.committedTransactions > 0, `${after.committedTransactions} committed`);
        check(
            'no save failed',
            after.failedSaves === 0,
            after.failedSaves === 0 ? undefined : `${after.failedSaves} failed — ${(after.failureReasons ?? []).join(' / ').slice(0, 200)}`
        );
        check('money is conserved', after.drift === '$0.00', `drift ${after.drift}`);

        // Every page renders live subscriptions; a plugin that breaks one breaks here.
        for (const tab of ['Accounts', 'Transactions', 'Market', 'Dashboard']) {
            await page.getByRole('button', { name: tab, exact: true }).first().click();
            await page.waitForTimeout(600);
        }

        check('every page rendered', errors.length === 0, errors.length > 0 ? errors[0] : undefined);

        return { plugin, ...after, errors: errors.length };
    } catch (error) {
        check('completed the run', false, error.message.split('\n')[0]);

        return { plugin, failed: error.message.split('\n')[0], errors: errors.length };
    } finally {
        await page.close();
    }
};

const main = async () => {
    const { chromium } = await loadPlaywright();
    const { server, origin } = await startPreview();
    const browser = await chromium.launch();
    const results = [];

    console.log(`\n${SECONDS}s of ${USERS} concurrent writers per plugin, through the built app\n`);

    try {
        for (const plugin of PLUGINS) {
            results.push(await runPlugin(browser, origin, plugin));
        }
    } finally {
        await browser.close();
        server.kill();
    }

    console.log('\n  plugin      committed    tx/sec   save p50   save p95   prop p95   conflicts');

    for (const r of results) {
        if (r.failed != null) {
            console.log(`  ${r.plugin.padEnd(10)}  ${r.failed.slice(0, 60)}`);
            continue;
        }

        console.log(
            `  ${r.plugin.padEnd(10)}` +
            `${String(r.committedTransactions).padStart(11)}` +
            `${r.txPerSecond.toFixed(1).padStart(10)}` +
            `${(r.saveP50.toFixed(1) + 'ms').padStart(11)}` +
            `${(r.saveP95.toFixed(1) + 'ms').padStart(11)}` +
            `${(r.propagationP95.toFixed(0) + 'ms').padStart(11)}` +
            `${String(r.concurrencyConflicts).padStart(12)}`
        );
    }

    console.log('');

    if (failures.length > 0) {
        console.error(`${failures.length} failed: ${[...new Set(failures)].join(', ')}`);
        process.exit(1);
    }

    console.log('all plugins passed');
};

await main();
