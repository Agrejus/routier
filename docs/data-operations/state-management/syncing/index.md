---
title: Syncing
layout: default
parent: State Management
grand_parent: Data Operations
has_children: true
nav_order: 2
permalink: /data-operations/state-management/syncing/
---

# Data Syncing

Set up bidirectional synchronization between your local Routier data store and remote servers. This guide walks through a complete example using the PouchDB plugin, which provides robust sync capabilities out of the box.

## Overview

The PouchDB plugin for Routier includes built-in synchronization that works with CouchDB and other CouchDB-compatible backends. When configured, it automatically:

- **Syncs changes bidirectionally** between local and remote databases
- **Handles conflicts** when data is modified in multiple places
- **Retries failed sync operations** with exponential backoff
- **Provides real-time updates** through live synchronization

## Quick Start

Enable syncing by configuring the `sync` option when creating your PouchDB plugin:

{% capture snippet_pouch_sync_basic %}{% include code/from-docs/data-operations/state-management/syncing/pouchdb-sync/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_pouch_sync_basic | strip }}{% endhighlight %}

## Complete Example

Here's a full example showing pull-only sync with filtering and custom document processing:

{% capture snippet_pouch_sync_complete %}{% include code/from-docs/data-operations/state-management/syncing/pouchdb-sync/block-9.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_pouch_sync_complete | strip }}{% endhighlight %}

This example demonstrates:

1. **Pull-only sync**: `push: false` means changes only flow from remote to local
2. **Document filtering**: Only syncs documents from specific collections (item and category)
3. **Custom processing**: The `onChange` callback groups documents by collection and processes them through schema subscriptions
4. **Live synchronization**: `live: true` keeps data up-to-date in real-time

### Setting Up a CouchDB Server

To test this example, you'll need a CouchDB-compatible server. You can use express-pouchdb to run a local server:

```ts
import PouchDB from "pouchdb";
import express from "express";
import expressPouchDB from "express-pouchdb";
import cors from "cors";

const app = express();

// Enable CORS for browser connections
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// Mount PouchDB at root
app.use(expressPouchDB(PouchDB));

app.listen(5984, () => {
  console.log("CouchDB server running on http://127.0.0.1:5984");
});
```

## How It Works

When you enable syncing:

1. **Initial Sync**: On startup, the plugin connects to the remote database and performs an initial sync
2. **Live Updates**: With `live: true`, the plugin continuously monitors for changes on both local and remote sides
3. **Change Propagation**: When you add, update, or delete entities locally, changes are queued and pushed to remote
4. **Remote Updates**: When remote data changes, updates are automatically pulled and applied locally
5. **Conflict Handling**: If the same entity is modified in both places, conflicts are detected and handled according to your configuration

## Sync Options

The PouchDB plugin supports several sync configuration options:

### `remoteDb` (Required)

The URL to your remote CouchDB-compatible database:

```ts
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp";
}
```

### Pull and Push Configuration

You can configure sync direction separately using `pull` and `push` options:

```ts
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  pull: {
    live: true,     // Continuous sync
    retry: true,    // Auto-retry
    filter: (doc) => {
      // Only sync specific documents
      return doc.collectionName === "season";
    }
  },
  push: false       // Disable pushing (pull-only)
}
```

- **`pull`**: Configuration for pulling changes from remote
- **`push`**: Set to `false` for pull-only sync, or configure push options

### Filtering Documents

Use the `filter` function to control which documents are synced:

```ts
pull: {
  filter: (doc) => {
    // Only sync documents from specific collections
    return doc.collectionName === "item" || doc.collectionName === "category";
  };
}
```

### `live` (Optional)

Enable continuous synchronization:

```ts
pull: {
  live: true; // Continuous sync (default: false)
}
```

With `live: false`, sync happens once on startup. With `live: true`, changes are synchronized in real-time.

### `retry` (Optional)

Enable automatic retry with exponential backoff:

```ts
pull: {
  retry: true; // Auto-retry failed syncs (default: false)
}
```

When enabled, failed sync operations automatically retry with increasing delays (1s, 2s, 4s, up to 10s max).

### `onChange` (Optional)

Callback function that receives sync events. Use this to process synced documents manually:

```ts
sync: {
  onChange: (schemas: SchemaCollection, change) => {
    if (change.direction === "pull" && change.change.docs) {
      // Group documents by collection
      const docsByCollection = change.change.docs.reduce(/* ... */);

      // Process each collection
      for (const collectionName in docsByCollection) {
        const schema = schemas.getByName(collectionName);
        const subscription = schema.createSubscription();

        subscription.send({
          adds: [],
          removals: [],
          updates: [],
          unknown: docsByCollection[collectionName],
        });

        subscription[Symbol.dispose]();
      }
    }
  };
}
```

Use this callback to:

- Manually process and route synced documents
- Group documents by collection for batch processing
- Apply custom transformations before updating local data
- Track sync progress and log events

## Conflict Resolution

PouchDB automatically detects conflicts when the same document is modified in multiple places. Handle conflicts by checking the change information in your `onChange` callback:

```ts
sync: {
  remoteDb: "http://localhost:5984/myapp",
  onChange: (schemas, change) => {
    if (change.change && change.change.docs) {
      change.change.docs.forEach((doc) => {
        if (doc._conflicts) {
          // Document has conflicts - handle them
          console.warn(`Conflict detected in document ${doc._id}`);
          // Implement your conflict resolution logic
        }
      });
    }
  }
}
```

## Network Handling

The PouchDB plugin automatically handles network connectivity:

- **Offline queuing**: Changes made offline are queued and synced when connectivity returns
- **Connection detection**: Sync pauses when network is unavailable
- **Automatic resume**: Sync resumes when network is restored

You can monitor sync status through the `onChange` callback to inform users about sync state.

## Sync Patterns

### Pull-Only Sync

For read-only data or when you want to prevent local changes from syncing back:

```ts
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  pull: { live: true, retry: true },
  push: false
}
```

### Bidirectional Sync

Default behavior when push is not disabled:

```ts
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  live: true,
  retry: true
}
```

### Filtered Sync

Only sync specific collections or document types:

```ts
sync: {
  remoteDb: "http://127.0.0.1:5984/myapp",
  pull: {
    live: true,
    filter: (doc) => doc.collectionName === "public_data"
  }
}
```

## Best Practices

1. **Use pull-only sync for read-only data**: Set `push: false` when local changes shouldn't sync back to server
2. **Filter documents when possible**: Reduce bandwidth by only syncing needed collections
3. **Use live sync for real-time apps**: Enable `live: true` when you need immediate synchronization
4. **Enable retry for reliability**: Use `retry: true` for production applications
5. **Process documents in onChange**: Group and route documents by collection for better performance
6. **Monitor sync events**: Implement `onChange` callbacks to track sync progress and errors
7. **Test offline scenarios**: Verify your app works correctly when sync is paused

## Next Steps

- **[PouchDB Syncing Details](pouchdb-sync.md)** - Complete reference for PouchDB sync options and advanced configuration
- **[Syncing Guide]({{ site.baseurl }}/guides/syncing)** - Conceptual overview of how syncing works in Routier
- **[Change Tracking](/concepts/change-tracking/)** - Understanding how Routier tracks local changes
- **[Live Queries]({{ site.baseurl }}/guides/live-queries)** - Real-time data queries
