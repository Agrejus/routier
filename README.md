# Routier Monorepo

> **⚠️ Alpha Release** - This project is currently in alpha. APIs may change between versions. Use with caution in production.

Routier is a reactive data toolkit for building fast, local-first apps. Define schemas, create collections, use live queries, and make optimistic mutations with a plugin model for any storage.

**[📖 View Full Documentation](https://agrejus.github.io/routier/)** - Complete guides, API reference, and tutorials

## Repository Structure

This is a monorepo using [Lerna](https://lerna.js.org/) and npm workspaces. The following packages are included:

### Core Packages

- **`@routier/core`** - Core functionality including schemas, expressions, plugins, and utilities
- **`@routier/datastore`** - DataStore implementation with collections, queries, change tracking, and views
- **`@routier/react`** - React integration with hooks and components

### Storage Plugins

- **`@routier/memory-plugin`** - In-memory storage (no persistence)
- **`@routier/browser-storage-plugin`** - Browser local storage
- **`@routier/file-system-plugin`** - File system storage for Node.js
- **`@routier/dexie-plugin`** - IndexedDB via Dexie
- **`@routier/sqlite-plugin`** - SQLite storage
- **`@routier/pouchdb-plugin`** - PouchDB storage (with sync support)

### Utilities

- **`@routier/test-utils`** - Testing utilities for Routier

### Other Directories

- **`docs/`** - Documentation website (Jekyll/Just the Docs)
- **`examples/`** - Example code extracted from documentation
- **`scripts/`** - Build and maintenance scripts

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

## Development

### Prerequisites

- Node.js (v16 or higher)
- npm

### Setup

```bash
# Install dependencies for all packages
npm install

# Build all packages
npm run build
```

### Scripts

- **`npm run build`** - Build all packages
- **`npm run sync:examples`** - Sync example code to documentation includes
- **`npm run extract:doc-code`** - Extract code blocks from documentation
- **`npm run docs:prepare`** - Prepare documentation (extract + sync examples)
- **`npm run version:patch`** - Bump patch version across all packages
- **`npm run version:minor`** - Bump minor version across all packages
- **`npm run version:major`** - Bump major version across all packages
- **`npm run publish`** - Publish all packages (via Lerna)
- **`npm run publish:canary`** - Publish canary versions

### Working with Packages

Each package is in its own directory with its own `package.json`. To work on a specific package:

```bash
cd core
npm install
npm run build
npm test
```

## Why Routier?

Choosing storage for local-first apps is hard—and the landscape moves fast. Routier separates your domain model from persistence through a small plugin interface: implement `query()`, `bulkPersist()`, and `destroy()`, and get live queries, optimistic mutations, change tracking, and more for free.

## Documentation

- **[Getting Started](https://agrejus.github.io/routier/getting-started/)** - Installation and setup guides
- **[Concepts](https://agrejus.github.io/routier/concepts/)** - Schema, queries, and architecture
- **[Guides](https://agrejus.github.io/routier/guides/)** - Live queries, syncing, history tracking
- **[How-To](https://agrejus.github.io/routier/how-to/)** - CRUD operations, collections, views
- **[Integrations](https://agrejus.github.io/routier/integrations/)** - React hooks, plugins

## Contributing

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines on contributing to Routier.

## License

See [LICENSE.txt](LICENSE.txt) for license information.
