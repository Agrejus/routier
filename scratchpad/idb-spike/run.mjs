import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const MIME = { '.html': 'text/html', '.js': 'text/javascript' };

const server = http.createServer(async (req, res) => {
    const path = req.url === '/' ? '/bench.html' : req.url;
    try {
        const body = await readFile(new URL('.' + path, import.meta.url));
        res.writeHead(200, { 'content-type': MIME[path.slice(path.lastIndexOf('.'))] ?? 'text/plain' });
        res.end(body);
    } catch {
        res.writeHead(404); res.end();
    }
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', m => console.error('[page]', m.text()));
page.on('pageerror', e => console.error('[pageerror]', e.message));
await page.goto(`http://localhost:${port}/`);

const suite = process.argv[2] ?? 'runBench';
const results = await page.evaluate((fn) => window[fn](), suite);

console.log(JSON.stringify(results, null, 2));

await browser.close();
server.close();
