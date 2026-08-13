/**
 * One process, one port: bundles the page with esbuild and serves it alongside the API the
 * page replicates to. Same origin, so there is no CORS and no proxy in the way of what the
 * example is actually demonstrating.
 *
 *   node examples/sync-engine-dexie/browser/serve.mjs
 *
 * The API implements Routier's replication wire contract and can be switched "down" from the
 * page, which is how the offline behaviour is shown in a browser that cannot stop its own
 * server.
 */

import * as http from 'node:http';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import * as esbuild from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const PORT = Number(process.env.PORT ?? 5180);

/**
 * Per collection, keyed by collection name. It was a single flat Map until the multi-collection
 * page went in, at which point two collections shared one store and overwrote each other.
 * @type {Map<string, Map<string, Record<string, unknown>>>}
 */
const collections = new Map();
const storeFor = (collectionName) => {
    const existing = collections.get(collectionName);
    if (existing != null) return existing;
    const created = new Map();
    collections.set(collectionName, created);
    return created;
};
/** @type {string[]} */
const requestLog = [];
let serverDown = false;
/** Reject writes with 422: permanent, so the client dead-letters instead of retrying. */
let rejectWrites = false;

/**
 * Workspace packages point `main` at ./dist, which needs a build, so every @routier import is
 * resolved to source instead — the same trick jest's moduleNameMapper and tsconfig.test.json's
 * `paths` use. esbuild's `alias` option cannot do this on its own: it matches whole specifiers,
 * so `@routier/core/schema` would become `.../core/src/index.ts/schema`.
 */
const packageRoots = {
    '@routier/core': 'core/src',
    '@routier/datastore': 'datastore/src',
    '@routier/memory-plugin': 'plugins/memory/src',
    '@routier/dexie-plugin': 'plugins/dexie/src',
    '@routier/replication-plugin': 'plugins/replication/src',
};

const { existsSync, statSync } = await import('node:fs');

/** A source path may be a file, a file needing .ts, or a directory with an index.ts. */
const resolveSource = (candidate) => {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    if (existsSync(`${candidate}.ts`)) return `${candidate}.ts`;
    if (existsSync(path.join(candidate, 'index.ts'))) return path.join(candidate, 'index.ts');
    return null;
};

const routierSourcePlugin = {
    name: 'routier-source',
    setup(build) {
        build.onResolve({ filter: /^@routier\// }, (args) => {
            for (const [name, root] of Object.entries(packageRoots)) {
                const subPath = args.path === name ? '' : args.path.startsWith(`${name}/`) ? args.path.slice(name.length + 1) : null;
                if (subPath == null) continue;

                const resolved = resolveSource(path.join(repoRoot, root, subPath));
                if (resolved != null) return { path: resolved };

                return { errors: [{ text: `cannot resolve ${args.path} under ${root}` }] };
            }
            return null;
        });
    },
};

// Keep an incremental build context rather than freezing the source at process startup. The
// example is often left running while the plugins are edited; rebuilding when a browser asks for
// a bundle means a normal page refresh cannot silently serve yesterday's implementation.
const buildContext = await esbuild.context({
    entryPoints: [path.join(here, 'app.ts'), path.join(here, 'complex.ts')],
    bundle: true,
    write: false,
    // Required with multiple entry points even though nothing is written to disk; it only
    // determines the output paths the bundles are keyed by below
    outdir: path.join(here, 'dist'),
    format: 'esm',
    target: 'es2022',
    sourcemap: 'inline',
    plugins: [routierSourcePlugin],
    logLevel: 'warning',
});

let bundles = {};
const rebuildBundles = async () => {
    const result = await buildContext.rebuild();
    bundles = Object.fromEntries(result.outputFiles.map((file) => [
        path.basename(file.path).replace(/\.js$/, '.ts'),
        file.text,
    ]));
};

await rebuildBundles();
for (const [name, text] of Object.entries(bundles)) {
    console.log(`bundled ${name} (${(text.length / 1024).toFixed(0)} kB)`);
}

const send = (res, status, body, contentType) => {
    res.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
    res.end(body);
};
const sendJson = (res, status, body) => send(res, status, JSON.stringify(body), 'application/json');
const snapshot = (collectionName) => [...storeFor(collectionName).values()]
    .sort((a, b) => String(a._id).localeCompare(String(b._id)));

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);

    if (url.pathname === '/') {
        return send(res, 200, await readFile(path.join(here, 'index.html'), 'utf8'), 'text/html');
    }
    if (url.pathname === '/app.js') {
        await rebuildBundles();
        return send(res, 200, bundles['app.ts'], 'text/javascript');
    }
    if (url.pathname === '/complex') {
        return send(res, 200, await readFile(path.join(here, 'complex.html'), 'utf8'), 'text/html');
    }
    if (url.pathname === '/complex.js') {
        await rebuildBundles();
        return send(res, 200, bundles['complex.ts'], 'text/javascript');
    }

    // Control plane for the page — not part of the replication contract
    if (url.pathname === '/_state') {
        const wanted = url.searchParams.get('collection') ?? 'products';
        return sendJson(res, 200, {
            rows: snapshot(wanted),
            counts: Object.fromEntries([...collections].map(([name, store]) => [name, store.size])),
            requestLog,
            serverDown,
            rejectWrites,
        });
    }
    if (url.pathname === '/_reject') {
        rejectWrites = !rejectWrites;
        requestLog.push(`— writes now ${rejectWrites ? 'REJECTED (422)' : 'accepted'} —`);
        return sendJson(res, 200, { rejectWrites });
    }
    if (url.pathname === '/_toggle') {
        serverDown = !serverDown;
        requestLog.push(`— API switched ${serverDown ? 'DOWN' : 'UP'} —`);
        return sendJson(res, 200, { serverDown });
    }
    if (url.pathname === '/_reset') {
        collections.clear();
        requestLog.length = 0;
        serverDown = false;
        return sendJson(res, 200, { ok: true });
    }

    if (!url.pathname.startsWith('/api/')) {
        return send(res, 404, 'not found', 'text/plain');
    }

    const collectionName = url.pathname.slice('/api/'.length);

    if (serverDown) {
        requestLog.push(`${req.method} ${collectionName} → 503 (API is down)`);
        return sendJson(res, 503, { error: 'service unavailable' });
    }

    if (req.method === 'GET') {
        const store = storeFor(collectionName);
        requestLog.push(`GET  ${collectionName} → ${store.size} row(s)`);
        return sendJson(res, 200, snapshot(collectionName));
    }

    if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'method not allowed' });
    }

    // 422 is permanent by the client's classification: retrying cannot fix it, so the change
    // dead-letters instead of cycling forever
    if (rejectWrites) {
        requestLog.push(`POST ${collectionName} → 422 (rejected)`);
        // This switch rejects the request as a whole, not one poison entity. The structured
        // marker lets HttpSwrDbPlugin dead-letter the batch directly instead of probing every
        // item with N follow-up requests.
        return sendJson(res, 422, { error: 'unprocessable', rejectionScope: 'batch' });
    }

    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
        const body = JSON.parse(raw);
        const adds = body.adds ?? [];
        const updates = body.updates ?? [];
        const removes = body.removes ?? [];

        const store = storeFor(collectionName);
        for (const entity of adds) store.set(entity._id, entity);
        // An update is PARTIAL: keys plus the fields that changed. Merging is required — replacing
        // the row would blank every column the client did not send, which is exactly what this
        // demo showed the first time (`name: undefined`) before this line merged.
        for (const patch of updates) store.set(patch._id, { ...store.get(patch._id), ...patch });
        for (const entity of removes) store.delete(entity._id);

        const parts = [
            adds.length ? `${adds.length} add` : null,
            updates.length ? `${updates.length} update` : null,
            removes.length ? `${removes.length} remove` : null,
        ].filter(Boolean).join(', ');
        const shape = updates.length ? `  updates sent: ${updates.map((u) => JSON.stringify(Object.keys(u))).join(' ')}` : '';
        requestLog.push(`POST ${collectionName} → ${parts || 'nothing'}${shape}`);

        sendJson(res, 200, { saved: [...adds, ...updates] });
    });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`ready on http://127.0.0.1:${PORT}`);
});
