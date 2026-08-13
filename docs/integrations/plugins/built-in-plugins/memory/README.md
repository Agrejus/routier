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

The database name is used to namespace your data and should be unique within your application:

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
- **No sharing** - Data is isolated to the current process

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

The plugin keeps one database per NAME, shared by every `MemoryPlugin` instance in the
process. Two `new MemoryPlugin("app")` instances read and write the same records, which is
what lets a multi-store test behave like several connections to one database.

This has one consequence to plan for: `destroy()` clears the named database for **every** user
of that name, not only for the instance you call it on. A test that destroys its store empties
the database out from under any other store that named it.

Give each test its own database name when the tests run in one process:

```ts
const store = new AppStore(new MemoryPlugin(`test-${crypto.randomUUID()}`));
```

## Next Steps

- [Local Storage Plugin](/integrations/plugins/built-in-plugins/local-storage/README) - Browser storage plugin
- [File System Plugin](/integrations/plugins/built-in-plugins/file-system/README) - Node.js file storage
- [Plugin Architecture](/integrations/plugins/create-your-own/) - Creating custom plugins
