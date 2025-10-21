# Routier

<p align="center">
  <img src="docs/assets/routier.svg" alt="Routier" width="140" height="140" />
</p>

> **⚠️ Alpha Release** - This project is currently in alpha. APIs may change between versions. Use with caution in production.

A reactive data toolkit for building fast, local-first apps. Define schemas, create collections, use live queries, and make optimistic mutations with a plugin model for any storage.

**[📖 View Full Documentation](https://agrejus.github.io/routier/)** - Complete guides, API reference, and tutorials

## Features

- **Schema-first**: Type-safe entity definitions with indexes and modifiers
- **Live queries**: Reactive queries across one or more collections
- **Optimistic mutations**: Instant UI updates with automatic rollback
- **Pluggable storage**: Memory, Local Storage, Dexie, SQLite, PouchDB, File System, and more
- **Change tracking**: Automatic tracking of entity modifications
- **Performance**: Database-backed filters when possible, in-memory for computed properties

## Quick Start

```bash
npm install @routier/core @routier/datastore @routier/memory-plugin
```

```ts
import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Define a schema
const userSchema = s
  .define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
  })
  .compile();

// Create a datastore with a plugin
class AppContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("routier-app"));
  }
  users = this.collection(userSchema).create();
}

const ctx = new AppContext();

// Add data
await ctx.users.addAsync({ name: "Ada", email: "ada@example.com" });
await ctx.saveChangesAsync();

// Query with live updates
ctx.users
  .subscribe()
  .where((u) => u.name.startsWith("A"))
  .toArray((result) => {
    console.log("Live query result:", result);
  });
```

## Why Routier?

Choosing storage for local-first apps is hard—and the landscape moves fast. Routier separates your domain model from persistence through a small plugin interface:

- **Swap storage backends** without changing schemas, queries, or UI
- **Use any framework/ORM/data store** you want via plugins
- **Experiment safely**: try a new store by writing a plugin
- **Fill ORM gaps**: feature-rich and easily extended

## Built-in Plugins

- **Memory**: In-memory storage for development and testing
- **Local Storage**: Browser localStorage/sessionStorage
- **Dexie**: IndexedDB with Dexie.js
- **PouchDB**: CouchDB sync and replication
- **SQLite**: Node.js SQLite integration
- **File System**: Node.js file-based storage

## Contributing

Issues and PRs welcome! Please see our [Contributing Guide](docs/CONTRIBUTING.md) or open an issue to discuss changes.

## License

MIT
