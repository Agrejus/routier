---
title: Syncing
layout: default
parent: Guides
nav_order: 6
---

## Syncing

Approaches for syncing with remote data sources and conflict handling in local-first applications.

## Overview

Syncing in Routier enables you to:

- **Sync with Remote Sources**: Keep local and remote data in sync
- **Handle Conflicts**: Resolve conflicts when data diverges
- **Implement Offline Support**: Work offline and sync when connection is restored
- **Manage Sync Direction**: Control push, pull, and bidirectional sync

## Key Features

- Flexible sync strategies (push, pull, bidirectional)
- Conflict resolution mechanisms
- Efficient change detection and delta sync
- Support for multiple sync targets
- Automatic retry and error handling

## Sync Patterns

### Unidirectional Sync

Sync data in one direction (e.g., pull from server):

```ts
// Pull latest data from server
await ctx.syncFromRemote(url);
```

### Bidirectional Sync

Sync data both ways with conflict handling:

```ts
// Sync both directions
await ctx.syncBothWays(url);
```

## Related Guides

- **[State Management](state-management.md)** - Managing application state
- **[PouchDB Sync](/data-operations/state-management/syncing/pouchdb-sync)** - PouchDB-specific sync
- **[Change Tracking](/concepts/change-tracking/)** - How changes are tracked
