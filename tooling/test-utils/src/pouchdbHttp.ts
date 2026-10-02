/**
 * `pouchdbMemory` plus the HTTP adapter, for suites that replicate to a real CouchDB.
 *
 * The memory shim exists because the `pouchdb` meta-package loads `level` → `leveldown` at
 * require time and leveldown has no prebuilt binary for current Node — see that file. This
 * one adds the piece replication needs: the LOCAL database is in memory, but the REMOTE is
 * an `http://` URL and addressing it needs `pouchdb-adapter-http`.
 *
 * The adapter is chosen PER NAME rather than with `defaults({ adapter: 'memory' })`.
 * `defaults` applies to every construction, URLs included, so `new PouchDB('http://…')`
 * quietly became a *local* memory database named after the URL. Replication then reported a
 * successful push — `docs_written: 1` — while the real server stayed empty, which is about
 * the most misleading failure a replication test could have.
 */
import PouchDB from 'pouchdb-core';
import adapterMemory from 'pouchdb-adapter-memory';
import adapterHttp from 'pouchdb-adapter-http';
import mapreduce from 'pouchdb-mapreduce';
import replication from 'pouchdb-replication';

const Base = PouchDB
    .plugin(adapterMemory)
    .plugin(adapterHttp)
    .plugin(mapreduce)
    .plugin(replication);

const isRemoteName = (name: unknown): boolean =>
    typeof name === 'string' && /^https?:\/\//i.test(name);

/**
 * A name the http adapter should handle keeps `adapter: 'http'`; everything else is a local
 * in-memory database. An explicit `adapter` in the caller's options still wins.
 */
class HttpCapablePouchDB extends (Base as any) {
    constructor(name?: unknown, options?: Record<string, unknown>) {
        super(name, {
            adapter: isRemoteName(name) ? 'http' : 'memory',
            ...options,
        });
    }
}

export default HttpCapablePouchDB as unknown as typeof Base;
