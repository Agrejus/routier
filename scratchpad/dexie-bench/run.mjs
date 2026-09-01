import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const ROUTES = {
    '/': new URL('./bench.html', import.meta.url),
    '/bench.html': new URL('./bench.html', import.meta.url),
    '/main.js': new URL('./main.js', import.meta.url),
        };

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json', '.wasm': 'application/wasm' };

const server = http.createServer(async (req, res) => {
    const path = req.url.split('?')[0];
    const target = ROUTES[path];
    if (target == null) {
        res.writeHead(404); res.end();
        return;
    }
    try {
        const body = await readFile(target);
        const file = target.pathname;
        res.writeHead(200, {
            'content-type': MIME[file.slice(file.lastIndexOf('.'))] ?? 'text/plain',
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        });
        res.end(body);
    } catch {
        res.writeHead(404); res.end();
    }
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

console.error('server on', port);
const browser = await chromium.launch({ headless: true });
console.error('browser launched');
const page = await browser.newPage();
page.on('console', m => console.error('[page]', m.text()));
page.on('pageerror', e => console.error('[pageerror]', e.message));
await page.goto(`http://localhost:${port}/`);
console.error('page loaded');

const suite = process.argv[2] ?? 'runBench';
const results = await page.evaluate((fn) => window[fn](), suite);

console.log(JSON.stringify(results, null, 2));

await browser.close();
server.close();
