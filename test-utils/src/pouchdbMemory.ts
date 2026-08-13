/**
 * A PouchDB constructor assembled from `pouchdb-core` plus only the plugins the
 * routier PouchDB plugin actually calls, defaulting to the in-memory adapter.
 *
 * The reason this exists: importing the `pouchdb` meta-package loads `level` →
 * `leveldown` at require time, and leveldown has no prebuilt binary for current Node
 * versions. That makes the whole PouchDB test suite unrunnable on a clean checkout,
 * regardless of which adapter a test asks for. Building the constructor from parts
 * keeps the suite native-dependency free.
 *
 * Jest maps the bare `pouchdb` specifier to this module (see jest.config.js), so the
 * plugin source keeps importing `pouchdb` and needs no test-only branching.
 */
import PouchDB from 'pouchdb-core';
import adapterMemory from 'pouchdb-adapter-memory';
import mapreduce from 'pouchdb-mapreduce';
import replication from 'pouchdb-replication';

// mapreduce backs `db.query(designDoc/view)`; replication backs `db.sync(remote)`.
// Both are used by PouchDbPlugin, so a core-only build would fail at call time
// rather than at import time — a strictly worse failure mode.
const MemoryPouchDB = PouchDB.plugin(adapterMemory)
    .plugin(mapreduce)
    .plugin(replication)
    .defaults({ adapter: 'memory' });

export default MemoryPouchDB;
