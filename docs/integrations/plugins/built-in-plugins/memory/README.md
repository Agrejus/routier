---
title: Memory Plugin
---

# Memory Plugin

The Memory Plugin provides fast, in-memory data storage for your Routier application.

## Quick Navigation

- [Overview](#overview)
- [Installation](#installation)
- [Basic Usage](#basic-usage)
- [Configuration](#configuration)
- [Performance Characteristics](#performance-characteristics)
- [Use Cases](#use-cases)
- [API Reference](#api-reference)
- [Next Steps](#next-steps)

## Overview

The Memory Plugin is the fastest storage option in Routier, storing all data in RAM for instant access. It's perfect for development, testing, and high-performance applications.

## Installation

```bash
npm install @routier/memory-plugin
```

## Basic Usage

<<< @/_snippets/code/from-docs/integrations/plugins/built-in-plugins/memory/README/block-1.ts

## Configuration

### Constructor Parameters

<<< @/_snippets/code/from-docs/integrations/plugins/built-in-plugins/memory/README/block-3.ts

### Database Name

The database name identifies the database, the same way a file path identifies a SQLite database. Use a distinct name for separate data, and reuse a name deliberately when stores should share data. If you omit the name, the plugin uses a fixed default name, so every unnamed instance shares one database. See [Shared Named Databases](#shared-named-databases).

<<< @/_snippets/code/from-docs/integrations/plugins/built-in-plugins/memory/README/block-4.ts

## Performance Characteristics

### Advantages

- **Instant access** - No I/O delays
- **High throughput** - Can handle thousands of operations per second
- **Low latency** - Sub-millisecond response times
- **No serialization overhead** - Data stays in memory

### Limitations

- **Memory usage** - All data must fit in RAM
- **No persistence** - Data is lost when application restarts
- **No cross-process sharing** - Separate processes, workers, and browser tabs each hold their own databases, even with the same name. Within one process, instances with the same name share data (see [Shared Named Databases](#shared-named-databases))

## Use Cases

### Development and Testing

<<< @/_snippets/code/from-docs/integrations/plugins/built-in-plugins/memory/README/block-5.ts

### High-Performance Applications

<<< @/_snippets/code/from-docs/integrations/plugins/built-in-plugins/memory/README/block-6.ts

### Offline-First with Sync

<<< @/_snippets/code/from-docs/integrations/plugins/built-in-plugins/memory/README/block-7.ts

## API Reference

### Constructor

<<< @/_snippets/code/from-docs/integrations/plugins/built-in-plugins/memory/README/block-8.ts

### Properties

- `databaseName` - The name of the database

### Methods

The Memory Plugin implements all standard plugin methods:

- `add()` - Add entities to collections
- `update()` - Update existing entities
- `remove()` - Remove entities
- `query()` - Query collections
- `destroy()` - Clear the named database

## Shared Named Databases

The name addresses a database; it is not a label for the plugin instance. The plugin keeps one
database per NAME, shared by every `MemoryPlugin` instance in the same JavaScript process. This
is intended, and it mirrors how other databases work: two plugins pointing at the same SQLite
file or PostgreSQL database are two connections to the same data.

- **Same name, same data** - Two `new MemoryPlugin("app")` instances read and write the same
  records. A different name is a different, empty database.
- **Unnamed instances share too** - `new MemoryPlugin()` uses a fixed default name, so every
  unnamed instance connects to the same default database.
- **Reads are copies** - Each store gets its own copies of records, never shared object
  references. Only saved changes cross stores: an unsaved edit in one store is invisible to
  another, and mutating a returned object without saving does not change stored data.
- **Live queries follow the database** - A subscription in one store updates when another store
  saves to the same-named database.
- **`destroy()` affects every instance** - It clears the named database for every user of that
  name, not only for the instance you call it on.
- **One process only** - Separate processes, workers, and browser tabs hold separate databases.

Sharing a name is how you model several stores on one database, such as the tabs of a
multi-tab app in a single test. When tests should not see each other's data, give each test its
own database name:

```ts
const store = new AppStore(new MemoryPlugin(`test-${crypto.randomUUID()}`));
```

## Next Steps

- [Local Storage Plugin](/integrations/plugins/built-in-plugins/local-storage/README) - Browser storage plugin
- [File System Plugin](/integrations/plugins/built-in-plugins/file-system/README) - Node.js file storage
- [Plugin Architecture](/integrations/plugins/create-your-own/) - Creating custom plugins
