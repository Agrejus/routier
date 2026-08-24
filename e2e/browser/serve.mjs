/**
 * Static server for the browser check.
 *
 * Plain HTTP with no COOP/COEP headers, deliberately. The opfs-sahpool VFS is chosen because
 * it does NOT need cross-origin isolation, and serving the page without those headers is what
 * proves it.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const types = {
    '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.wasm': 'application/wasm', '.data': 'application/octet-stream',
};

createServer(async (request, response) => {
    // Strip the query first: '/?v=2' is still a request for the index.
    const requested = request.url.split('?')[0];
    const path = requested === '/' ? '/index.html' : requested;

    try {
        const body = await readFile(join(here, path));
        response.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' });
        response.end(body);
    } catch {
        response.writeHead(404); response.end('not found');
    }
}).listen(8791, () => console.log('serving on http://localhost:8791'));
