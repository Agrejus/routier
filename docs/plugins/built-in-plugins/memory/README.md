# Memory Plugin

The Memory Plugin provides fast, in-memory data storage for your Routier application.

## Overview

The Memory Plugin is the fastest storage option in Routier, storing all data in RAM for instant access. It's perfect for development, testing, and high-performance applications.

## Installation

```bash
npm install routier-plugin-memory
```

## Basic Usage

```typescript
import { DataStore } from "routier";
import { MemoryPlugin } from "routier-plugin-memory";

class AppContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("my-app"));
  }

  users = this.collection(userSchema).create();
}
```

## Configuration

### Constructor Parameters

```typescript
const memoryPlugin = new MemoryPlugin(
  "my-app" // Database name (required)
);
```

### Database Name

The database name is used to namespace your data and should be unique within your application:

```typescript
// Different contexts can use different names
const userContext = new DataStore(new MemoryPlugin("users"));
const orderContext = new DataStore(new MemoryPlugin("orders"));
```

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

```typescript
// Perfect for unit tests
class TestContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("test"));
  }
}
```

### High-Performance Applications

```typescript
// For applications requiring maximum speed
class PerformanceContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("performance"));
  }
}
```

### Offline-First with Sync

```typescript
import { DbPluginReplicator } from "routier-core/plugins";

const memoryPlugin = new MemoryPlugin("offline");
const pouchDbPlugin = new PouchDbPlugin("remote");

const replicationPlugin = DbPluginReplicator.create({
  replicas: [memoryPlugin],
  source: pouchDbPlugin,
  read: memoryPlugin,
});
```

## API Reference

### Constructor

```typescript
new MemoryPlugin(databaseName: string)
```

### Properties

- `databaseName` - The name of the database

### Methods

The Memory Plugin implements all standard plugin methods:

- `add()` - Add entities to collections
- `update()` - Update existing entities
- `remove()` - Remove entities
- `query()` - Query collections
- `destroy()` - Clean up resources

## Next Steps

- [Local Storage Plugin](../local-storage/README.md) - Browser storage plugin
- [File System Plugin](../file-system/README.md) - Node.js file storage
- [Plugin Architecture](../../create-your-own/plugin-architecture.md) - Creating custom plugins
