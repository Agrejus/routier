# PouchDB Syncing

PouchDB provides robust synchronization capabilities that work seamlessly with Routier. This guide covers how to set up and configure PouchDB syncing based on the actual implementation.

## Overview

The PouchDB plugin automatically handles synchronization when you configure the `sync` option. The syncing system is built on top of PouchDB's battle-tested replication engine and provides:

- **Automatic sync setup** when the plugin initializes
- **Bidirectional replication** between local and remote databases
- **Conflict detection and resolution**
- **Automatic retry with exponential backoff**
- **Live synchronization** for real-time updates

## Basic Configuration

Enable syncing by adding the `sync` configuration to your PouchDB plugin:

```typescript
import { PouchDbPlugin } from "routier-plugin-pouchdb";

const plugin = new PouchDbPlugin("myapp", {
  sync: {
    remoteDb: "http://localhost:3000/myapp",
    live: true,
    retry: true,
    onChange: (schemas, change) => {
      console.log("Sync event:", change);
    },
  },
});
```

## Sync Options Reference

### `remoteDb` (Required)

The URL to your remote CouchDB-compatible database:

```typescript
// Local development
remoteDb: "http://localhost:3000/myapp";

// Cloudant
remoteDb: "https://username.cloudant.com/myapp";

// CouchDB
remoteDb: "http://couchdb.example.com:5984/myapp";

// PouchDB Server
remoteDb: "http://localhost:3000/myapp";
```

### `live` (Optional)

Controls whether synchronization is continuous or one-time:

```typescript
live: true; // Continuous sync (recommended for most apps)
live: false; // One-time sync only
```

**Default:** `false`

### `retry` (Optional)

Enables automatic retry with exponential backoff:

```typescript
retry: true; // Auto-retry with backoff (recommended)
retry: false; // No automatic retries
```

**Default:** `false`

### `onChange` (Optional)

Callback function that receives sync events and schema information:

```typescript
onChange: (schemas, change) => {
  // Handle sync events
  console.log("Sync direction:", change.direction);
  console.log("Change count:", change.change?.docs?.length || 0);
  console.log("Affected schemas:", Array.from(schemas.keys()));
};
```

## How PouchDB Syncing Works

### 1. **Automatic Initialization**

When you create a PouchDB plugin with sync enabled, the system automatically:

```typescript
// This happens automatically in _tryStartSync()
const localDb = new PouchDB(this._name);
const remoteDb = new PouchDB(this._options.sync.remoteDb);

const sync = localDb.sync(remoteDb, {
  live: this._options.sync.live,
  retry: this._options.sync.retry,
  back_off_function: (delay) => Math.min(delay * 2, 10000),
});
```

### 2. **Retry Logic**

The plugin implements intelligent retry with exponential backoff:

```typescript
back_off_function: (delay) => Math.min(delay * 2, 10000);
```

- **Initial delay:** 1 second
- **Maximum delay:** 10 seconds
- **Backoff formula:** `Math.min(delay * 2, 10000)`

### 3. **Event Handling**

Sync events are automatically routed to your `onChange` callback:

```typescript
sync.on("change", (change) => this._options.sync.onChange(schemas, change));
```

## Complete Example

Here's a full example of setting up PouchDB syncing with Routier:

```typescript
import { DataStore } from "routier";
import { PouchDbPlugin } from "routier-plugin-pouchdb";
import { productSchema } from "./schemas/product";

// Configure PouchDB with syncing
const plugin = new PouchDbPlugin("myapp", {
  // Database configuration
  name: "myapp",

  // Sync configuration
  sync: {
    remoteDb: "http://localhost:3000/myapp",
    live: true,
    retry: true,
    onChange: (schemas, change) => {
      // Handle sync events
      if (change.direction === "push") {
        console.log("Local changes pushed to remote");
      } else if (change.direction === "pull") {
        console.log("Remote changes pulled to local");
      }

      // Log document changes
      if (change.change && change.change.docs) {
        change.change.docs.forEach((doc) => {
          console.log(`Document ${doc.id} synced`);
        });
      }
    },
  },
});

// Create the data store
const dataStore = new DataStore(plugin);

// Add collections
const products = dataStore.collection(productSchema).create();

// All operations now automatically sync
await products.addAsync({
  name: "New Product",
  price: 99.99,
  category: "electronics",
});

// Save changes (triggers sync)
await dataStore.saveChangesAsync();
```

## Conflict Resolution

PouchDB automatically detects conflicts when the same document is modified in multiple places. Handle conflicts in your `onChange` callback:

```typescript
onChange: (schemas, change) => {
  if (change.change && change.change.docs) {
    change.change.docs.forEach((doc) => {
      if (doc._conflicts) {
        console.log("Conflict detected for document:", doc.id);
        console.log("Conflicts:", doc._conflicts);

        // Implement your conflict resolution strategy
        resolveConflict(doc);
      }
    });
  }
};

async function resolveConflict(doc) {
  // Strategy 1: Use the most recent version
  const resolved = await getMostRecentVersion(doc);

  // Strategy 2: Merge changes manually
  const merged = await mergeConflictingChanges(doc);

  // Strategy 3: Prompt user to choose
  const userChoice = await promptUserForResolution(doc);
}
```

## Advanced Configuration

### Custom Sync Options

You can pass additional PouchDB sync options:

```typescript
const plugin = new PouchDbPlugin("myapp", {
  sync: {
    remoteDb: "http://localhost:3000/myapp",
    live: true,
    retry: true,
    // Additional PouchDB sync options
    filter: (doc) => doc.type === "product",
    query_params: { user_id: "current_user" },
    since: "now",
    limit: 1000,
    include_docs: true,
    attachments: false,
    conflicts: true,
  },
});
```

### Multiple Remote Databases

Sync with multiple remote databases:

```typescript
const plugin = new PouchDbPlugin("myapp", {
  sync: {
    remoteDb: "http://localhost:3000/myapp",
    live: true,
    retry: true,
    onChange: (schemas, change) => {
      console.log("Primary sync:", change);
    },
  },
});

// Add additional sync connections
const additionalSync = localDb.sync("http://backup-server:3000/myapp", {
  live: true,
  retry: true,
});
```

## Monitoring and Debugging

### Sync Status Monitoring

Track sync progress and status:

```typescript
onChange: (schemas, change) => {
  // Monitor sync activity
  const syncInfo = {
    direction: change.direction,
    changeCount: change.change?.docs?.length || 0,
    timestamp: new Date().toISOString(),
    schemas: Array.from(schemas.keys()),
  };

  console.log("Sync status:", syncInfo);

  // Update UI with sync status
  updateSyncStatus(syncInfo);
};
```

### Error Handling

Handle sync errors gracefully:

```typescript
onChange: (schemas, change) => {
  if (change.error) {
    console.error("Sync error:", change.error);

    // Handle specific error types
    switch (change.error.name) {
      case "unauthorized":
        handleAuthenticationError();
        break;
      case "conflict":
        handleConflictError(change.error);
        break;
      case "network_error":
        handleNetworkError(change.error);
        break;
      default:
        handleGenericError(change.error);
    }
  }
};
```

### Debug Mode

Enable detailed logging for troubleshooting:

```typescript
const plugin = new PouchDbPlugin("myapp", {
  sync: {
    remoteDb: "http://localhost:3000/myapp",
    live: true,
    retry: true,
    onChange: (schemas, change) => {
      // Detailed debug logging
      console.group("PouchDB Sync Event");
      console.log("Direction:", change.direction);
      console.log("Change:", change.change);
      console.log("Schemas:", schemas);
      console.log("Timestamp:", new Date().toISOString());
      console.groupEnd();
    },
  },
});
```

## Performance Optimization

### Filtered Sync

Only sync necessary documents:

```typescript
sync: {
  remoteDb: 'http://localhost:3000/myapp',
  live: true,
  retry: true,
  filter: (doc) => {
    // Only sync user's own data
    return doc.userId === currentUserId;
  }
}
```

### Batch Operations

Optimize sync performance with batch operations:

```typescript
// Batch multiple changes for efficient syncing
await dataStore.products.addAsync(product1, product2, product3);
await dataStore.products.updateAsync(update1, update2);
await dataStore.saveChangesAsync(); // Single sync operation
```

## Best Practices

### 1. **Network Handling**

```typescript
// Check connectivity before enabling live sync
if (navigator.onLine) {
  console.log("Online - enabling live sync");
} else {
  console.log("Offline - sync will resume when online");
}

// Listen for connectivity changes
window.addEventListener("online", () => {
  console.log("Connection restored - resuming sync");
});

window.addEventListener("offline", () => {
  console.log("Connection lost - sync paused");
});
```

### 2. **Error Recovery**

```typescript
onChange: (schemas, change) => {
  if (change.error) {
    // Log error for debugging
    console.error("Sync error:", change.error);

    // Implement retry logic
    if (change.error.name === "network_error") {
      setTimeout(() => {
        console.log("Retrying sync...");
        // Sync will automatically retry
      }, 5000);
    }
  }
};
```

### 3. **Data Validation**

```typescript
onChange: (schemas, change) => {
  if (change.change && change.change.docs) {
    change.change.docs.forEach((doc) => {
      // Validate synced documents
      if (!isValidDocument(doc)) {
        console.warn("Invalid document synced:", doc);
        // Handle invalid data
      }
    });
  }
};
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**

   - Check credentials and permissions
   - Verify remote database access

2. **Network Issues**

   - Check connectivity
   - Verify remote database URL
   - Check firewall settings

3. **Conflict Resolution**
   - Implement proper conflict handling
   - Use document versioning
   - Consider business logic for merging

### Debug Commands

```typescript
// Check sync status
console.log("Plugin options:", plugin._options);

// Check database connection
const db = new PouchDB("myapp");
db.info().then((info) => console.log("DB info:", info));

// Check remote connection
const remoteDb = new PouchDB("http://localhost:3000/myapp");
remoteDb.info().then((info) => console.log("Remote DB info:", info));
```

## Next Steps

- Learn about [Live Queries](../live-queries/) for real-time updates
- Explore [Change Tracking](../../modification/change-tracking/) for local modifications
- See [Advanced Syncing](../advanced-syncing/) for complex scenarios
- Check out [PouchDB Plugin](../../../plugins/built-in-plugins/pouchdb/) for more details
