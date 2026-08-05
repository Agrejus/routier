# @routier/pouchdb-plugin

Routier storage backed by PouchDB, with optional replication to CouchDB.

```ts
import { DataStore } from "@routier/datastore";
import { PouchDbPlugin } from "@routier/pouchdb-plugin";

const plugin = new PouchDbPlugin("my-database", {
  sync: {
    remoteDb: "http://127.0.0.1:5984/my-database",
    live: true,
    retry: true,
  },
});

class AppStore extends DataStore {
  constructor() {
    super(plugin);
  }
}

const store = new AppStore();

// Replication does not start on its own.
plugin.sync(store.schemas);
```

## Contracts

### Durability

PouchDB's adapter decides. IndexedDB in a browser, LevelDB in Node, memory in tests. A
committed write is durable to whatever the adapter promises.

### One database per plugin

Each plugin instance owns one database name and holds one connection to it. Every operation
and the replication share that handle.

This matters for replication: two PouchDB objects over one name behave as a single database
only when the adapter broadcasts changes between them. IndexedDB does. The memory adapter does
not. One handle removes the question.

### Document shape

PouchDB stores documents, not tables, so one database holds every collection. Declare
`_id` and `_rev` on the schema and scope each collection to itself:

```ts
const schema = s.define("products", {
  _id: s.string().key().identity(),
  _rev: s.string().identity(),
  name: s.string(),
}).modify(x => ({
  documentType: x.computed((_, collectionName) => collectionName).tracked()
})).compile();

class AppStore extends DataStore {
  products = this.collection(schema)
    .scope(([x, p]) => x.documentType === p.collectionName, { ...schema })
    .proxy()
    .create();
}
```

Without the scope, every collection reads every other collection's documents.

### Replication

Call `plugin.sync(store.schemas)` to start it. It returns PouchDB's `Sync` handle.

Supply `onChange`, `onError`, `onDenied`, `onPaused`, `onActive`, and `onComplete` in the
`sync` options to observe it. Each receives the schemas you passed to `sync()`.

The plugin starts replication **once** per instance. A second `sync()` call returns the
existing handle rather than opening a second replication.

`destroy()` cancels the replication before it deletes the database. A live sync that is never
cancelled keeps polling the remote and holds both databases open.

Authentication goes in the remote URL (`http://user:password@host:5984/db`) or in the `auth`
and `headers` sync options.

### Concurrency

Work is serialized through one queue per plugin instance, so operations on one database run in
order. Two plugin instances over two databases do not block each other.

Conflicts across replicas are PouchDB's to resolve. It keeps both revisions and picks a
deterministic winner; the plugin does not merge them for you.

**Optimistic concurrency through `ConcurrencyDbPlugin` is not supported.** PouchDB's `_rev`
already rejects a stale write at the document level.

### Schema migration

None at the storage level. Documents are stored whole. A renamed or removed property does not
rewrite what is stored, and old documents keep their old shape.

### Disposal

Call `store.destroyAsync()`. It cancels replication, clears the index cache, deletes the
database, and closes the handle.

### Failure semantics

- A failed bulk write reports the first document error and fails the save.
- A replication error reaches `onError`. With `retry: true`, PouchDB keeps retrying.
- Rejected credentials surface through `onError` or `onDenied`. Nothing reaches the remote.

## Supported versions

Node 18 or later, and any browser. PouchDB 9. CouchDB 3 for replication.

## See also

- [PouchDB plugin guide](../../docs/integrations/plugins/built-in-plugins/pouchdb/README.md)
- `e2e/src/couchdbReplication.test.ts` — replication against a real CouchDB
