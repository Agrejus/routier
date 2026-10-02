import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { buildSmokeTest } from './build.mjs';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

const serve = (root) => new Promise((ready) => {
    const server = createServer(async (request, response) => {
        const path = request.url === '/' ? '/index.html' : request.url.split('?')[0];
        try {
            const body = await readFile(join(root, path));
            response.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' });
            response.end(body);
        } catch {
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
        console.error('the devtools smoke test needs playwright-core and a Chromium build:\n' +
            '  npm i -D playwright-core && npx playwright install chromium\nSkipping.');
        process.exit(2);
    }
};

const failures = [];
const check = (name, ok, detail) => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail == null ? '' : `  ${detail}`}`);
    if (!ok) failures.push(name);
};

const root = await buildSmokeTest();
const { server, port } = await serve(root);
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();

try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(() => document.body.dataset.ready === 'true');

    const toggle = page.getByRole('button', { name: 'Open Routier devtools' });
    await toggle.click();
    check('the toggle opens the drawer', await page.getByRole('complementary', { name: 'Routier devtools' }).isVisible());

    const toggleColor = await page.getByRole('button', { name: 'Close Routier devtools' })
        .evaluate(element => getComputedStyle(element).color);
    check('the app\'s styles do not reach the drawer', toggleColor !== 'rgb(255, 0, 0)', toggleColor);

    await page.getByRole('button', { name: /^products/ }).click();
    const rows = page.getByRole('grid', { name: 'Rows' }).getByRole('row');
    await rows.filter({ hasText: 'second' }).waitFor();
    check('the table shows the saved rows', await rows.count() === 3, `rows=${await rows.count()}`);

    await page.evaluate(() => window.addProduct('added in the browser'));
    await rows.filter({ hasText: 'added in the browser' }).waitFor({ timeout: 5_000 });
    check('a saved row appears in the open table', await rows.count() === 4, `rows=${await rows.count()}`);

    await rows.filter({ hasText: 'added in the browser' }).click();
    const detail = page.getByRole('region', { name: 'Row detail' });
    check('the row detail shows the full value', (await detail.textContent()).includes('name: "added in the browser"'));

    check('no page errors', errors.length === 0, errors.join('; '));
} finally {
    await browser.close();
    server.close();
}

if (failures.length > 0) {
    console.error(`\n${failures.length} devtools browser check(s) failed.`);
    process.exit(1);
}

console.log('\nDevtools smoke test passed.');
