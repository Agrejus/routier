import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const playground = join(repo, 'examples/playground');

const loadPlaywright = async () => {
    try {
        return await import('playwright-core');
    } catch {
        console.error('the playground check needs playwright-core and a Chromium build:\n  npx playwright-core install chromium\nSkipping.');
        process.exit(2);
    }
};

const failures = [];
const check = (name, ok, detail) => {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail == null ? '' : `  ${detail}`}`);
    if (!ok) failures.push(name);
};

const EXPECTED_CONSOLE = /favicon|extension "vector" is not available|relation "books" does not exist/i;

const { build, preview } = await import('vite');
const outDir = await mkdtemp(join(tmpdir(), 'routier-playground-'));
await build({ root: playground, base: '/playground/', logLevel: 'warn', build: { outDir, emptyOutDir: true } });
const server = await preview({ root: playground, base: '/playground/', build: { outDir }, preview: { port: 0, host: '127.0.0.1' }, logLevel: 'warn' });
const base = server.resolvedUrls.local[0];

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 200)); });

const open = async id => {
    await page.goto(`${base}#${id}`);
    await page.waitForSelector('.monaco-editor', { timeout: 60_000 });
    await page.waitForSelector('.run-button:not([disabled])', { timeout: 60_000 });
};

const runAndRead = async (timeout = 60_000) => {
    await page.click('.run-button');
    await page.waitForFunction(() => !document.querySelector('.run-button')?.textContent?.includes('Running'), null, { timeout });
    return page.$$eval('.log-entry', entries => entries.map(entry => entry.innerText.replace(/\s+/g, ' ')));
};

const attempt = async (name, work) => {
    try {
        await work();
    } catch (error) {
        check(name, false, error.message.split('\n')[0]);
    }
};

const SCRIPTS = [
    ['sandbox', 'Open tasks', 60_000],
    ['crud', 'Products remaining', 60_000],
    ['live-queries', 'Live result', 60_000],
    ['local-storage', 'You have run this', 60_000],
    ['sqlite', 'Sum of every order', 120_000],
    ['pglite', 'Published in the 1970s', 240_000],
];

for (const [id, expected, timeout] of SCRIPTS) {
    await attempt(`runs ${id}`, async () => {
        await open(id);
        const output = await runAndRead(timeout);
        const ok = output.some(line => line.includes(expected)) && !output.some(line => line.startsWith('Error'));
        check(`runs ${id}`, ok, ok ? undefined : JSON.stringify(output).slice(0, 300));
    });
}

for (const [id, selector] of [['react', '.preview input'], ['grid', '.preview table'], ['persistence', '.preview textarea, .preview input']]) {
    await attempt(`renders ${id}`, async () => {
        await open(id);
        await page.waitForSelector(selector, { timeout: 60_000 });
        check(`renders ${id}`, true);
    });
}

await attempt('edit, share and reset', async () => {
    await open('sandbox');
    await page.click('.monaco-editor .view-lines');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.insertText('export async function run(log: (m: string, v?: unknown) => void) {\n  log("edited by a visitor", 6 * 7);\n}\n');

    const edited = await runAndRead();
    check('runs edited code', edited.some(line => line.includes('edited by a visitor') && line.includes('42')), JSON.stringify(edited));

    await page.click('.tool-button:has-text("Share")');
    await page.waitForFunction(() => location.hash.includes('&code='), null, { timeout: 10_000 });
    const shared = page.url();
    check('puts shared code in the link', shared.includes('&code='));

    await page.click('.tool-button:has-text("Reset")');
    const reset = await runAndRead();
    check('resets to the original', reset.some(line => line.includes('Open tasks')), JSON.stringify(reset).slice(0, 200));

    const visitor = await context.newPage();
    await visitor.goto(shared);
    await visitor.waitForSelector('.run-button:not([disabled])', { timeout: 60_000 });
    await visitor.click('.run-button');
    await visitor.waitForSelector('.log-entry', { timeout: 30_000 });
    const opened = await visitor.$$eval('.log-entry', entries => entries.map(entry => entry.innerText));
    check('opens and runs a shared link', opened.some(line => line.includes('edited by a visitor')), JSON.stringify(opened).slice(0, 200));
    await visitor.close();
});

await attempt('autocomplete', async () => {
    await page.evaluate(() => localStorage.clear());
    await open('sandbox');
    await page.click('.monaco-editor .view-lines');
    await page.keyboard.press('Control+End');
    await page.keyboard.type('\nconst probe = new TaskStore();\nprobe.tasks.wh', { delay: 40 });
    await page.waitForSelector('.suggest-widget.visible .monaco-list-row[aria-label*="where"]', { timeout: 60_000 });
    check('offers Routier methods while typing', true);

    await page.keyboard.press('Escape');
    await page.keyboard.type('ereNot();', { delay: 20 });
    await page.waitForSelector('.monaco-editor .squiggly-error', { timeout: 30_000 });
    check('underlines a type error', true);
});

const unexpected = errors.filter(error => !EXPECTED_CONSOLE.test(error));
check('logs no unexpected errors', unexpected.length === 0, unexpected.slice(0, 3).join(' || ') || undefined);

await browser.close();
await new Promise(done => server.httpServer.close(done));
await rm(outDir, { recursive: true, force: true });

if (failures.length > 0) {
    console.error(`\n${failures.length} playground check(s) failed: ${failures.join(', ')}`);
    process.exit(1);
}

console.log('\nThe playground works end to end.');
