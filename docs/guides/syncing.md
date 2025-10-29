---
title: Syncing
layout: default
parent: Guides
nav_order: 6
---

## Syncing

Approaches for syncing with remote data sources and conflict handling in local-first applications.

## Overview

Syncing enables your Routier application to keep local and remote data stores synchronized, supporting offline-first architectures where users can work without connectivity and automatically sync when online.

Routier's syncing architecture is **plugin-based**: Routier itself doesn't implement syncing logic but provides interfaces and hooks that database plugins use to implement their own sync strategies. This design allows each plugin to handle syncing in the way that makes the most sense for its underlying database technology.

## Key Concepts

### Plugin-Based Architecture

Routier exposes:

- **Collection change events** - Plugins can listen to when entities are added, updated, or deleted
- **Schema information** - Sync engines receive schema metadata for proper data validation and transformation
- **Data persistence hooks** - Integration points where plugins can intercept save operations
- **Query interfaces** - Standard query APIs that sync engines can use to read and write data

The actual syncing implementation is entirely up to the plugin. Different plugins may implement syncing differently:

- **PouchDB plugin** - Uses CouchDB replication protocol for bidirectional sync
- **SQLite plugin** - May sync with remote SQL databases using SQL replication
- **Custom plugins** - Can implement REST API sync, GraphQL subscriptions, WebSocket sync, or any other strategy

### How Syncing Works

Most sync implementations follow a common pattern:

1. **Change Detection**

   - Monitors local changes when you add, update, or delete entities
   - Detects remote changes from the server
   - Identifies conflicts when the same entity is modified in multiple places

2. **Synchronization Direction**

   - **Push**: Local changes sent to remote server
   - **Pull**: Remote changes retrieved and applied locally
   - **Bidirectional**: Both push and pull happen automatically

3. **Conflict Resolution**

   - Automatic resolution based on timestamps, versions, or other strategies
   - Custom conflict handlers you can configure
   - Manual resolution for complex conflicts

4. **Offline Support**
   - Changes are queued when offline
   - Automatic retry when connectivity is restored
   - Exponential backoff for failed sync attempts

### Sync Patterns

#### Unidirectional Sync

Sync data in one direction only - typically pulling from a server:

- Useful for read-only data from an authoritative source
- Simpler to implement and reason about
- No local changes are sent to server

#### Bidirectional Sync

Sync data both ways automatically:

- Local changes are pushed to server
- Remote changes are pulled locally
- Most common pattern for collaborative applications
- Requires conflict resolution strategy

#### On-Demand Sync

Manual triggering of sync operations:

- User-initiated sync via button or command
- Scheduled sync at regular intervals
- Event-driven sync (e.g., on app focus)

### Conflict Resolution Strategies

When the same entity is modified in multiple places, conflicts occur. Common resolution strategies:

- **Last Write Wins**: Most recent change overwrites older changes
- **Merge**: Combine changes from both sides intelligently
- **Custom Logic**: Business-specific rules for resolving conflicts
- **Manual Review**: Present conflicts to user for manual resolution

### Retry and Error Handling

Robust sync implementations include:

- **Automatic retry** with exponential backoff
- **Network state detection** to pause sync when offline
- **Error logging** and reporting
- **Partial sync support** when some operations fail

## Benefits

- **Offline-first**: Work without connectivity, sync when online
- **Collaboration**: Multiple users can work on shared data
- **Data redundancy**: Local copy provides backup and fast access
- **Real-time updates**: Live sync keeps data current across devices

## Limitations and Considerations

- **Conflict complexity**: Resolving conflicts can be challenging
- **Storage growth**: Syncing requires additional storage for conflict history
- **Network usage**: Continuous sync consumes bandwidth
- **Plugin dependency**: Sync capabilities depend on your chosen plugin

## Related Guides

- **[PouchDB Syncing](/data-operations/state-management/syncing/pouchdb-sync.md)** - Practical example with PouchDB
- **[Change Tracking](/concepts/change-tracking/)** - Understanding how Routier tracks changes
- **[State Management](state-management.md)** - Managing application state
- **[Live Queries](live-queries.md)** - Real-time data updates
