---
title: PouchDB Syncing
layout: default
parent: Syncing
grand_parent: State Management
nav_order: 1
---

# PouchDB Syncing Reference

This page provides a complete reference for PouchDB synchronization options and advanced configuration. For a practical walkthrough with examples, see the [Syncing Overview](index.md).

## Overview

The PouchDB plugin integrates with PouchDB's replication engine, which provides battle-tested sync capabilities for CouchDB-compatible databases. When you configure the `sync` option, the plugin automatically sets up bidirectional replication between your local and remote databases.

## Sync Configuration Options

### `remoteDb` (Required)

The URL to your remote CouchDB-compatible database. Must be a valid HTTP/HTTPS URL.

```ts
import { PouchDbPlugin } from "@routier/pouchdb-plugin";

const plugin = new PouchDbPlugin("myapp", {
  sync: {
    remoteDb: "http://127.0.0.1:5984/myapp",
  },
});
```

### `live` (Optional)

Enable continuous synchronization. When `true`, the sync will continue running and pick up changes in real-time. When `false`, sync happens once on startup.

**Default:** `false`

```ts
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  live: true // Continuous sync
}
```

### `retry` (Optional)

Enable automatic retry with exponential backoff. When enabled, failed sync operations automatically retry with increasing delays (1s, 2s, 4s, up to 10s max).

**Default:** `false`

```ts
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  retry: true // Auto-retry failed syncs
}
```

### `pull` (Optional)

Configure options for pulling changes from remote. This is an object that can include:

- `live`: Continuous pull (default: false)
- `retry`: Auto-retry failed pulls (default: false)
- `filter`: Function to filter documents during pull
- Any other PouchDB replication options

```ts
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  pull: {
    live: true,
    retry: true,
    filter: (doc) => doc.collectionName === "public_data"
  }
}
```

### `push` (Optional)

Configure options for pushing changes to remote. Can be set to `false` to disable pushing, or an object with push-specific options.

- Set to `false`: Disable pushing (pull-only sync)
- Object: Configuration for pushing (similar structure to `pull`)

```ts
// Pull-only sync
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  pull: { live: true },
  push: false
}

// Configure push options
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  push: {
    live: true,
    retry: true
  }
}
```

### `filter` (Optional)

Function to filter documents during sync. The filter function receives a document and returns `true` to include it or `false` to exclude it.

```ts
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  filter: (doc) => {
    // Only sync documents from specific collections
    return doc.collectionName === "item" || doc.collectionName === "category";
  }
}
```

**Note:** Filters apply to both pull and push unless specified separately in `pull` or `push` options.

### `onChange` (Optional)

Callback function that receives sync events. Use this to process synced documents manually, track progress, or handle conflicts.

```ts
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  onChange: (schemas, change) => {
    if (change.direction === "pull" && change.change?.docs) {
      // Process pulled documents
      console.log(`Pulled ${change.change.docs.length} documents`);
    }
  }
}
```

**Parameters:**

- `schemas`: `SchemaCollection` - Collection of all schemas in the datastore
- `change`: `PouchDB.Replication.SyncResult<{}>` - The sync event from PouchDB

**See:** [Processing Sync Events](#processing-sync-events) for detailed examples.

### `onError` (Optional)

Callback function called when a sync error occurs.

```ts
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  onError: (schemas, error) => {
    console.error("Sync error:", error);
    // Handle error, notify user, etc.
  }
}
```

### `onComplete` (Optional)

Callback function called when a sync operation completes (only for non-live syncs).

```ts
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  onComplete: (schemas, event) => {
    console.log("Sync completed:", event);
  }
}
```

### `onPaused` (Optional)

Callback function called when sync is paused (typically due to network issues).

```ts
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  onPaused: (schemas, event) => {
    console.log("Sync paused - network may be unavailable");
  }
}
```

### `onActive` (Optional)

Callback function called when sync becomes active after being paused.

```ts
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  onActive: (schemas) => {
    console.log("Sync resumed");
  }
}
```

### `onDenied` (Optional)

Callback function called when sync is denied (typically due to authentication/permission issues).

```ts
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  onDenied: (schemas, event) => {
    console.error("Sync denied:", event);
  }
}
```

### `auth` (Optional)

Authentication credentials for the remote database.

```ts
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  auth: {
    username: "myuser",
    password: "mypassword"
  }
}
```

### `headers` (Optional)

Custom HTTP headers to send with sync requests.

```ts
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  headers: {
    "X-Custom-Header": "value"
  }
}
```

## Processing Sync Events

The `onChange` callback receives sync events that contain information about what documents were changed. Use this to:

- Group documents by collection
- Route documents to the appropriate schema
- Apply custom transformations
- Track sync progress

### Basic Usage

```ts
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  onChange: (schemas, change) => {
    if (change.direction === "pull" && change.change?.docs) {
      console.log(`Pulled ${change.change.docs.length} documents`);
    } else if (change.direction === "push" && change.change?.docs) {
      console.log(`Pushed ${change.change.docs.length} documents`);
    }
  }
}
```

### Routing Documents by Collection

Process documents by grouping them by collection name:

{% capture snippet_pouch_sync_route %}{% include code/from-docs/data-operations/state-management/syncing/pouchdb-sync/block-9.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_pouch_sync_route | strip }}{% endhighlight %}

## Conflict Resolution

PouchDB automatically detects conflicts when the same document is modified in both local and remote databases. Conflicts are indicated by the `_conflicts` property on documents.

### Detecting Conflicts

Check for conflicts in your `onChange` callback:

```ts
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  onChange: (schemas, change) => {
    if (change.change?.docs) {
      change.change.docs.forEach((doc) => {
        if (doc._conflicts && doc._conflicts.length > 0) {
          console.warn(`Conflict detected in document ${doc._id}`);
          // Handle conflict: merge, use local, use remote, etc.
        }
      });
    }
  }
}
```

### Resolving Conflicts

You can resolve conflicts by:

1. **Using the local version**: Delete the remote conflict revisions
2. **Using the remote version**: Delete the local version
3. **Merging**: Combine changes from both versions
4. **Using business logic**: Apply domain-specific rules to determine the winner

## Advanced PouchDB Options

The PouchDB plugin accepts all standard PouchDB replication options. These are passed through to PouchDB's `sync()` method. Refer to [PouchDB's replication documentation](https://pouchdb.com/api.html#replication) for the complete list.

Common advanced options include:

- `doc_ids`: Array of document IDs to sync
- `query_params`: Additional query parameters for filtered replication
- `view`: Use a CouchDB view for filtering
- `since`: Sync only changes since a specific sequence number
- `heartbeat`: Interval for heartbeat requests in milliseconds
- `timeout`: Timeout for requests in milliseconds
- `batch_size`: Number of documents to process per batch
- `batches_limit`: Maximum number of batches to process per replication cycle

## Sync Patterns

### Pull-Only Sync

Use pull-only sync when you want to receive updates from a server but don't want local changes to sync back:

```ts
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  pull: {
    live: true,
    retry: true
  },
  push: false
}
```

### Push-Only Sync

Use push-only sync to send local changes to a server without receiving updates:

```ts
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  pull: false,
  push: {
    live: true,
    retry: true
  }
}
```

### Bidirectional Sync

Default behavior when both directions are enabled:

```ts
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  live: true,
  retry: true
}
```

### One-Time Sync

Perform a single sync operation without live updates:

```ts
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  live: false
}
```

## Starting Sync

After creating the plugin, you need to start the sync process. The plugin provides a `sync()` method that you should call:

```ts
import { DataStore } from "@routier/datastore";
import { PouchDbPlugin } from "@routier/pouchdb-plugin";

const plugin = new PouchDbPlugin("myapp", {
  sync: {
    remoteDb: "http://127.0.0.1:5984/myapp",
    live: true,
    retry: true,
  },
});

class AppDataStore extends DataStore {
  constructor() {
    super(plugin);
  }
}

const store = new AppDataStore();

// Start sync
plugin.sync(store.schemas);
```

## Troubleshooting

### Sync Not Starting

- Verify `remoteDb` URL is correct and accessible
- Check that sync options are provided in the plugin constructor
- Ensure `plugin.sync(store.schemas)` is called after datastore creation

### Authentication Errors

- Verify credentials in `auth` option
- Check that the user has read/write permissions on the remote database
- Test the remote database URL in a browser or with curl

### Network Issues

- Verify network connectivity
- Check CORS settings on the remote server
- Review firewall/proxy settings
- Use `onPaused` and `onActive` callbacks to monitor connection state

### Conflicts

- Implement conflict resolution in your `onChange` callback
- Use document versioning strategies
- Consider business logic for merging conflicting changes

### Performance Issues

- Use `filter` to reduce the number of documents synced
- Adjust `batch_size` if syncing large datasets
- Monitor sync progress with `onChange` callbacks
- Consider using views for more efficient filtering

## Next Steps

- **[Syncing Overview](index.md)** - Practical example and walkthrough
- **[Syncing Guide](/guides/syncing.md)** - Conceptual overview of syncing in Routier
- **[PouchDB Plugin](/integrations/plugins/built-in-plugins/pouchdb/)** - PouchDB plugin documentation
- **[Live Queries](/guides/live-queries.md)** - Real-time data queries
- **[Change Tracking](/concepts/change-tracking/)** - Understanding how Routier tracks changes
