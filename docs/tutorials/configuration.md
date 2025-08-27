# Configuration

This guide covers the various configuration options available in Routier.

## Plugin Configuration

### Memory Plugin

```typescript
import { MemoryPlugin } from "routier-plugin-memory";

const memoryPlugin = new MemoryPlugin("my-app");
```

### Local Storage Plugin

```typescript
import { LocalStoragePlugin } from "routier-plugin-local-storage";

const localStoragePlugin = new LocalStoragePlugin(
  "my-app",
  window.localStorage
);
const sessionStoragePlugin = new LocalStoragePlugin(
  "my-app",
  window.sessionStorage
);
```

### File System Plugin

```typescript
import { FileSystemPlugin } from "routier-plugin-file-system";

const fileSystemPlugin = new FileSystemPlugin(__dirname, "my-app");
```

### PouchDB Plugin

```typescript
import { PouchDbPlugin } from "routier-plugin-pouchdb";

const pouchDbPlugin = new PouchDbPlugin("my-database");
```

### Dexie Plugin

```typescript
import { DexiePlugin } from "routier-plugin-dexie";

const dexiePlugin = new DexiePlugin("my-database");
```

## Advanced Configuration

### Plugin Composition

```typescript
import { DbPluginLogging, DbPluginReplicator } from "routier-core/plugins";

// Add logging to any plugin
const memoryPluginWithLogging = DbPluginLogging.create(memoryPlugin);

// Create replication between plugins
const replicationPlugin = DbPluginReplicator.create({
  replicas: [memoryPluginWithLogging],
  source: pouchDbPluginWithLogging,
  read: memoryPluginWithLogging,
});
```

### Custom Context Configuration

```typescript
class AppContext extends DataStore {
  constructor() {
    // Pass primary plugin to super constructor
    super(new MemoryPlugin("my-app"));

    // Additional configuration can go here
  }
}
```

## Environment-Specific Configuration

### Development

```typescript
const isDevelopment = process.env.NODE_ENV === "development";

class DevContext extends DataStore {
  constructor() {
    if (isDevelopment) {
      super(new MemoryPlugin("dev-app"));
    } else {
      super(new PouchDbPlugin("prod-database"));
    }
  }
}
```

### Testing

```typescript
import { TestingPlugin } from "routier-plugin-testing";

class TestContext extends DataStore {
  constructor() {
    super(new TestingPlugin("test-app"));
  }
}
```

## Next Steps

- [Getting Started](getting-started.md) - Basic setup
- [Basic Example](basic-example.md) - Complete working example
- [Plugin Architecture](../plugins/create-your-own/plugin-architecture.md) - Creating custom plugins
