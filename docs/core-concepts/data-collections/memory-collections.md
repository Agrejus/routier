# Memory Collections

Memory collections provide fast, in-memory data storage for your Routier application.

## Overview

Memory collections are the fastest storage option in Routier, storing all data in RAM for instant access. They're perfect for:

- Development and testing
- Temporary data storage
- High-performance applications
- Offline-first applications with sync capabilities

## Creating Memory Collections

```typescript
import { DataStore } from "routier";
import { MemoryPlugin } from "routier-plugin-memory";
import { s } from "routier-core/schema";

const userSchema = s
  .define("user", {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
    name: s.string(),
    email: s.string(),
  })
  .compile();

class AppContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("my-app"));
  }

  users = this.collection(userSchema).create();
}
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

  users = this.collection(userSchema).create();
}
```

### High-Performance Applications

```typescript
// For applications requiring maximum speed
class PerformanceContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("performance"));
  }

  cache = this.collection(cacheSchema).create();
}
```

### Offline-First with Sync

```typescript
// Combine with replication for offline capabilities
const memoryPlugin = new MemoryPlugin("offline");
const pouchDbPlugin = new PouchDbPlugin("remote");

const replicationPlugin = DbPluginReplicator.create({
  replicas: [memoryPlugin],
  source: pouchDbPlugin,
  read: memoryPlugin,
});
```

## Next Steps

- [Change Tracking](change-tracking.md) - Understanding how changes are tracked
- [Entity Management](entity-management.md) - Managing entities in collections
- [Memory Plugin](../plugins/built-in-plugins/memory/README.md) - Detailed plugin documentation
