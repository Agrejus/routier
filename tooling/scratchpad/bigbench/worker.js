// Simulates the SQLite worker side. Source data is columnar JS values, exactly the
// shapes sqlite-wasm returns after stepping: numbers, strings, null. No Date objects,
// no parsed JSON, no blobs — that mapping is plugins/sqlite/src/utils.ts.

const mulberry32 = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const WORDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet'];

const makeSource = (n) => {
    const rand = mulberry32(42);
    const id = new Array(n);
    const amount = new Array(n);
    const isActive = new Array(n);   // 0 | 1 | null
    const name = new Array(n);
    const description = new Array(n);
    const createdAt = new Array(n);  // ISO string
    const updatedAt = new Array(n);  // ISO string | null
    const tags = new Array(n);       // JSON text
    const meta = new Array(n);       // JSON text

    const base = 1700000000000;
    for (let i = 0; i < n; i++) {
        id[i] = i + 1;
        amount[i] = Math.round(rand() * 100000) / 100;
        isActive[i] = rand() < 0.1 ? null : (rand() < 0.5 ? 0 : 1);
        name[i] = WORDS[(rand() * 10) | 0] + '-' + WORDS[(rand() * 10) | 0] + '-' + ((rand() * 100000) | 0);
        description[i] = 'Order for ' + name[i] + ' with priority ' + ((rand() * 5) | 0) +
            ' and routing code ' + ((rand() * 1e9) | 0).toString(36) +
            ' assigned to region ' + WORDS[(rand() * 10) | 0] + ' pending review by ops team';
        createdAt[i] = new Date(base + ((rand() * 1e10) | 0)).toISOString();
        updatedAt[i] = rand() < 0.1 ? null : new Date(base + ((rand() * 1e10) | 0)).toISOString();
        tags[i] = JSON.stringify([WORDS[(rand() * 10) | 0], WORDS[(rand() * 10) | 0], WORDS[(rand() * 10) | 0]]);
        meta[i] = JSON.stringify({
            priority: (rand() * 5) | 0,
            source: WORDS[(rand() * 10) | 0],
            audit: { by: WORDS[(rand() * 10) | 0], at: base + ((rand() * 1e10) | 0), flags: [(rand() * 10) | 0, (rand() * 10) | 0] },
        });
    }
    return { n, id, amount, isActive, name, description, createdAt, updatedAt, tags, meta };
};

const sources = new Map();
const getSource = (n) => {
    if (!sources.has(n)) sources.set(n, makeSource(n));
    return sources.get(n);
};

// --- grow-and-copy typed array fill, simulating unknown row count while stepping ---
const growF64 = (arr, len, cap) => {
    const bigger = new Float64Array(cap);
    bigger.set(arr.subarray(0, len));
    return bigger;
};

const packF64Nullable = (col, n) => {
    let cap = 1024;
    let data = new Float64Array(cap);
    const bitmap = new Uint8Array(Math.ceil(n / 8)); // bit set = null
    let hasNulls = false;
    for (let i = 0; i < n; i++) {
        if (i >= cap) { cap *= 2; data = growF64(data, i, cap); }
        const v = col[i];
        if (v == null) { bitmap[i >> 3] |= (1 << (i & 7)); data[i] = 0; hasNulls = true; }
        else data[i] = v;
    }
    return { data: data.slice(0, n), bitmap, hasNulls };
};

const packDateNullable = (col, n) => {
    let cap = 1024;
    let data = new Float64Array(cap);
    const bitmap = new Uint8Array(Math.ceil(n / 8));
    let hasNulls = false;
    for (let i = 0; i < n; i++) {
        if (i >= cap) { cap *= 2; data = growF64(data, i, cap); }
        const v = col[i];
        if (v == null) { bitmap[i >> 3] |= (1 << (i & 7)); data[i] = 0; hasNulls = true; }
        else data[i] = Date.parse(v);
    }
    return { data: data.slice(0, n), bitmap, hasNulls };
};

const packU8Nullable = (col, n) => {
    const data = new Uint8Array(n);
    const bitmap = new Uint8Array(Math.ceil(n / 8));
    let hasNulls = false;
    for (let i = 0; i < n; i++) {
        const v = col[i];
        if (v == null) { bitmap[i >> 3] |= (1 << (i & 7)); hasNulls = true; }
        else data[i] = v;
    }
    return { data, bitmap, hasNulls };
};

// Exact-size fills: row count known up front (a COUNT(*) first, or a second pass).
const packF64Exact = (col, n) => {
    const data = new Float64Array(n);
    const bitmap = new Uint8Array(Math.ceil(n / 8));
    for (let i = 0; i < n; i++) {
        const v = col[i];
        if (v == null) bitmap[i >> 3] |= (1 << (i & 7));
        else data[i] = v;
    }
    return { data, bitmap };
};

const packDateExact = (col, n) => {
    const data = new Float64Array(n);
    const bitmap = new Uint8Array(Math.ceil(n / 8));
    for (let i = 0; i < n; i++) {
        const v = col[i];
        if (v == null) bitmap[i >> 3] |= (1 << (i & 7));
        else data[i] = Date.parse(v);
    }
    return { data, bitmap };
};

// --- encode variants -------------------------------------------------------

// 1. today (post readRows fix): raw row objects, cloned.
const encodeToday = (s) => {
    const rows = new Array(s.n);
    for (let i = 0; i < s.n; i++) {
        rows[i] = {
            id: s.id[i], amount: s.amount[i], isActive: s.isActive[i],
            name: s.name[i], description: s.description[i],
            createdAt: s.createdAt[i], updatedAt: s.updatedAt[i],
            tags: s.tags[i], meta: s.meta[i],
        };
    }
    return { payload: { rows }, transfer: [] };
};

// 2. hybrid-raw (the plan, round two): numbers/bools typed+transferred, rest cloned strings.
const encodeHybridRaw = (s) => {
    const id = packF64Nullable(s.id, s.n);
    const amount = packF64Nullable(s.amount, s.n);
    const isActive = packU8Nullable(s.isActive, s.n);
    const payload = {
        n: s.n,
        id: id.data, amount: amount.data,
        isActive: isActive.data, isActiveNull: isActive.bitmap,
        name: s.name, description: s.description,
        createdAt: s.createdAt, updatedAt: s.updatedAt,
        tags: s.tags, meta: s.meta,
    };
    return { payload, transfer: [id.data.buffer, amount.data.buffer, isActive.data.buffer, isActive.bitmap.buffer] };
};

// 3. worker-shaped (rejected): final routier shape built in the worker, cloned.
const encodeWorkerShaped = (s) => {
    const rows = new Array(s.n);
    for (let i = 0; i < s.n; i++) {
        const active = s.isActive[i];
        const upd = s.updatedAt[i];
        rows[i] = {
            id: s.id[i], amount: s.amount[i],
            isActive: active == null ? null : active !== 0,
            name: s.name[i], description: s.description[i],
            createdAt: new Date(s.createdAt[i]),
            updatedAt: upd == null ? null : new Date(upd),
            tags: JSON.parse(s.tags[i]),
            meta: JSON.parse(s.meta[i]),
        };
    }
    return { payload: { rows }, transfer: [] };
};

// 4. hybrid-final: typed numbers/bools/dates transferred, JSON stays text (main parses).
// opts: { parseJsonInWorker, exactSize, jsonConcat, nullFlags }
const encodeHybridFinal = (s, opts = {}) => {
    const f64 = opts.exactSize ? packF64Exact : packF64Nullable;
    const date = opts.exactSize ? packDateExact : packDateNullable;

    const id = f64(s.id, s.n);
    const amount = f64(s.amount, s.n);
    const isActive = packU8Nullable(s.isActive, s.n);
    const createdAt = date(s.createdAt, s.n);
    const updatedAt = date(s.updatedAt, s.n);

    let tags = s.tags, meta = s.meta;
    let tagsConcat = null, metaConcat = null;
    if (opts.parseJsonInWorker) {
        tags = new Array(s.n); meta = new Array(s.n);
        for (let i = 0; i < s.n; i++) { tags[i] = JSON.parse(s.tags[i]); meta[i] = JSON.parse(s.meta[i]); }
    } else if (opts.jsonConcat) {
        // one JSON document per column: '[' + rows joined by ',' + ']', one parse on main
        tagsConcat = '[' + s.tags.join(',') + ']';
        metaConcat = '[' + s.meta.join(',') + ']';
        tags = null; meta = null;
    }

    const payload = {
        n: s.n,
        id: id.data, amount: amount.data,
        isActive: isActive.data, isActiveNull: isActive.bitmap,
        createdAt: createdAt.data, createdAtNull: createdAt.bitmap,
        updatedAt: updatedAt.data, updatedAtNull: updatedAt.bitmap,
        name: s.name, description: s.description,
        tags, meta, tagsConcat, metaConcat,
    };
    if (opts.nullFlags) {
        // plan-level knowledge: which columns actually contain nulls in this result
        payload.nulls = { id: false, amount: false, isActive: true, createdAt: false, updatedAt: true };
    }
    return {
        payload,
        transfer: [id.data.buffer, amount.data.buffer, isActive.data.buffer, isActive.bitmap.buffer,
            createdAt.data.buffer, createdAt.bitmap.buffer, updatedAt.data.buffer, updatedAt.bitmap.buffer],
    };
};

// 5. chunked hybrid-final: encode + post CHUNK rows at a time so the main thread
// decodes chunk k while the worker encodes chunk k+1.
const encodeChunk = (s, start, end, jsonConcat) => {
    const n = end - start;
    const id = new Float64Array(n), amount = new Float64Array(n);
    const createdAt = new Float64Array(n), updatedAt = new Float64Array(n);
    const isActive = new Uint8Array(n);
    const bm = (x) => new Uint8Array(Math.ceil(x / 8));
    const isActiveNull = bm(n), createdAtNull = bm(n), updatedAtNull = bm(n);
    const name = new Array(n), description = new Array(n), tags = new Array(n), meta = new Array(n);

    for (let i = 0; i < n; i++) {
        const j = start + i;
        id[i] = s.id[j]; amount[i] = s.amount[j];
        const act = s.isActive[j];
        if (act == null) isActiveNull[i >> 3] |= (1 << (i & 7)); else isActive[i] = act;
        createdAt[i] = Date.parse(s.createdAt[j]);
        const upd = s.updatedAt[j];
        if (upd == null) updatedAtNull[i >> 3] |= (1 << (i & 7)); else updatedAt[i] = Date.parse(upd);
        name[i] = s.name[j]; description[i] = s.description[j];
        if (!jsonConcat) { tags[i] = s.tags[j]; meta[i] = s.meta[j]; }
    }
    let tagsConcat = null, metaConcat = null;
    if (jsonConcat) {
        tagsConcat = '[' + s.tags.slice(start, end).join(',') + ']';
        metaConcat = '[' + s.meta.slice(start, end).join(',') + ']';
    }
    return {
        payload: { n, id, amount, isActive, isActiveNull, createdAt, createdAtNull, updatedAt, updatedAtNull, name, description, tags: jsonConcat ? null : tags, meta: jsonConcat ? null : meta, tagsConcat, metaConcat },
        transfer: [id.buffer, amount.buffer, isActive.buffer, isActiveNull.buffer,
            createdAt.buffer, createdAtNull.buffer, updatedAt.buffer, updatedAtNull.buffer],
    };
};

// --- blobs / files ---------------------------------------------------------
const makeBytes = (count, size) => {
    const out = [];
    for (let i = 0; i < count; i++) {
        const b = new Uint8Array(size);
        for (let j = 0; j < size; j += 4096) b[j] = (i + j) & 0xff;
        out.push(b);
    }
    return out;
};

// Pre-built Blob objects, constructed once at setup so the timer sees only the post.
const blobCache = new Map();

self.onmessage = async (e) => {
    const m = e.data;

    if (m.kind === 'rows') {
        const s = getSource(m.n);
        const t0 = performance.now();
        let r;
        if (m.variant === 'today') r = encodeToday(s);
        else if (m.variant === 'hybrid-raw') r = encodeHybridRaw(s);
        else if (m.variant === 'worker-shaped') r = encodeWorkerShaped(s);
        else if (m.variant === 'hybrid-final') r = encodeHybridFinal(s);
        else if (m.variant === 'hybrid-final-wparse') r = encodeHybridFinal(s, { parseJsonInWorker: true });
        else if (m.variant === 'hybrid-final-exact') r = encodeHybridFinal(s, { exactSize: true });
        else if (m.variant === 'hybrid-final-jsonconcat') r = encodeHybridFinal(s, { jsonConcat: true });
        else if (m.variant === 'hybrid-final-nullflags') r = encodeHybridFinal(s, { nullFlags: true });
        else throw new Error('unknown variant ' + m.variant);
        const encodeMs = performance.now() - t0;
        self.postMessage({ kind: 'rows', variant: m.variant, encodeMs, payload: r.payload }, r.transfer);
        return;
    }

    if (m.kind === 'rows-chunked') {
        const s = getSource(m.n);
        const chunk = m.chunk;
        const t0 = performance.now();
        for (let start = 0; start < s.n; start += chunk) {
            const r = encodeChunk(s, start, Math.min(start + chunk, s.n), m.jsonConcat === true);
            self.postMessage({ kind: 'chunk', payload: r.payload }, r.transfer);
        }
        self.postMessage({ kind: 'chunks-done', encodeMs: performance.now() - t0 });
        return;
    }

    if (m.kind === 'blob-setup') {
        const key = m.count + 'x' + m.size;
        if (!blobCache.has(key)) {
            blobCache.set(key, makeBytes(m.count, m.size).map(b => new Blob([b])));
        }
        self.postMessage({ kind: 'blob-setup' });
        return;
    }

    if (m.kind === 'blobs') {
        if (m.mode === 'blob-objects') {
            const blobs = blobCache.get(m.count + 'x' + m.size);
            const t0 = performance.now();
            self.postMessage({ kind: 'blobs', mode: m.mode, encodeMs: performance.now() - t0, buffers: blobs });
            return;
        }
        // bytes are re-made per run because transfer detaches them
        const bytes = makeBytes(m.count, m.size);
        const t0 = performance.now();
        if (m.mode === 'clone-buffers') {
            self.postMessage({ kind: 'blobs', mode: m.mode, encodeMs: performance.now() - t0, buffers: bytes });
        } else {
            self.postMessage({ kind: 'blobs', mode: m.mode, encodeMs: performance.now() - t0, buffers: bytes },
                bytes.map(b => b.buffer));
        }
        return;
    }

    if (m.kind === 'opfs-setup') {
        const root = await navigator.storage.getDirectory();
        const handle = await root.getFileHandle('bench.bin', { create: true });
        const access = await handle.createSyncAccessHandle();
        const bytes = makeBytes(1, m.size)[0];
        access.truncate(0);
        access.write(bytes, { at: 0 });
        access.flush();
        access.close();
        self.postMessage({ kind: 'opfs-setup' });
        return;
    }

    if (m.kind === 'opfs-read') {
        const root = await navigator.storage.getDirectory();
        const handle = await root.getFileHandle('bench.bin');
        const t0 = performance.now();
        if (m.mode === 'sync-read-transfer') {
            const access = await handle.createSyncAccessHandle();
            const size = access.getSize();
            const bytes = new Uint8Array(size);
            access.read(bytes, { at: 0 });
            access.close();
            self.postMessage({ kind: 'opfs-read', mode: m.mode, encodeMs: performance.now() - t0, data: bytes }, [bytes.buffer]);
        } else {
            // post-file: hand the File object over; bytes stay lazy until the main thread reads
            const file = await handle.getFile();
            self.postMessage({ kind: 'opfs-read', mode: m.mode, encodeMs: performance.now() - t0, data: file });
        }
        return;
    }

    if (m.kind === 'count') {
        // an aggregate result: one row, one number
        if (m.mode === 'clone') {
            self.postMessage({ kind: 'count', rows: [{ count: m.value }] });
        } else {
            const data = new Float64Array([m.value]);
            self.postMessage({ kind: 'count', data }, [data.buffer]);
        }
        return;
    }

    if (m.kind === 'warm') {
        getSource(m.n);
        self.postMessage({ kind: 'warm' });
    }
};
