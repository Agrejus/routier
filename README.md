## Routier

Type-safe, plugin-driven ORM router. Define schemas with computed/function properties, query with natural JS expressions, and persist via pluggable backends (memory, IndexedDB/Dexie, PouchDB/CouchDB, SQLite, filesystem, and more).

### Highlights

- Schema-first with rich modifiers: identity, defaults, computed, functions, unmapped, tracked
- Natural queries: `(e) => e.name.startsWith('A') && e.age >= 18`
- Smart execution: database-backed filters run server/adapter-side when possible, computed/unmapped filters run in memory
- Change tracking, history, and performance tooling
- Pluggable storage via first-class plugins

### Install (package names may vary per publish channel)

```bash
npm install routier routier-core routier-plugin-dexie
# or
npm install routier routier-core routier-plugin-pouchdb
```

### Quick start

Define a schema with computed/function properties (in `routier-core`):

```ts
import { s } from "routier-core";

export const userProfileSchema = s
  .define("userProfiles", {
    id: s.string().key().identity(),
    firstName: s.string(),
    lastName: s.string(),
    email: s.string(),
    dateOfBirth: s.date(),
    createdAt: s.date().default(() => new Date()),
  })
  .compile();
```

Create a store with a plugin and query (see `examples/` for full setups):

```ts
import { DataStore } from "routier";
import { PouchDbPlugin } from "routier-plugin-pouchdb";
import { uuidv4 } from "routier-core";
import { userProfileSchema } from "./schemas/userProfile";

const store = new DataStore(new PouchDbPlugin(uuidv4()));
const userProfiles = store.collection(userProfileSchema);

await userProfiles.addAsync({
  firstName: "Alice",
  lastName: "Smith",
  email: "a@x.com",
  dateOfBirth: new Date("2000-01-01"),
});
await store.saveChangesAsync();

const alice = await userProfiles
  .where((u) => u.firstName.startsWith("A"))
  .firstOrUndefinedAsync();
```

### Querying: database vs in-memory

Routier analyzes predicates to decide where they execute. Filters that reference database-mapped properties are pushed down to the adapter; filters on computed or unmapped properties run in memory.

Tip: chain database-backed filters first, then computed/unmapped filters to avoid broad scans.

```ts
// firstName: mapped (DB); age: computed (in-memory)
const found = await userProfiles
  .where((u) => u.firstName.startsWith("A")) // DB-backed
  .where((u) => u.age === 0) // computed → in-memory
  .firstOrUndefinedAsync();
```

See more in Concepts → Queries → “Computed or unmapped properties” (`docs/concepts/queries/index.md`).

### Plugins

- Memory: `plugins/memory/`
- Dexie (IndexedDB): `plugins/dexie/`
- PouchDB (CouchDB sync): `plugins/pouchdb/`
- SQLite: `plugins/sqlite/`
- File System (Node): `plugins/file-system/`
- Browser Storage (local/session): `plugins/browser-storage/`

Each plugin implements a common interface so you can swap backends without changing app code.

### Examples & Docs

- Docs: `docs/` (Concepts, Guides, Tutorials, Reference)
- Examples: `examples/` (vite, rspack, node) – run the package’s README for steps

### Development

Build from repo root:

```bash
npm run build          # builds core and routier
```

Run tests per package (e.g. core):

```bash
cd core && npm test
```

### Contributing

Issues and PRs welcome. Please see `docs/CONTRIBUTING.md` if available, or open an issue to discuss changes.

### License

MIT
