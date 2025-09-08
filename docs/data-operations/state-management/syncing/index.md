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

Data syncing allows you to synchronize data between your local data store and remote servers, enabling offline-first applications with automatic synchronization when connectivity is restored.

## Overview

Routier provides exposed methods and interfaces that sync engines can use to integrate with the data store. The actual syncing implementation is handled by the specific database plugin (e.g., PouchDB, SQLite, etc.), not by Routier itself. Each plugin can implement syncing however it wants - there's no prescribed way to do it.

Routier exposes:

- **Collection change events** that sync engines can listen to
- **Schema information** for proper data handling
- **Data persistence hooks** for sync integration points
- **Query interfaces** for sync-related operations

The specific sync engine (like PouchDB) handles:

- **Bidirectional synchronization** between local and remote data stores
- **Conflict resolution** when the same data is modified in multiple places
- **Automatic retry** with exponential backoff for failed sync attempts
- **Real-time updates** with live synchronization
- **Offline support** with queued changes that sync when online

## Configuration

Syncing is configured however the user wants within the specific database plugin. Routier itself doesn't handle syncing - it provides the interfaces that plugins use. Here's one example of how it might be configured with a PouchDB plugin:



{% capture snippet_835yxq %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{{ snippet_835yxq  | strip }}
```


## Sync Options

The specific options available depend entirely on the plugin you're using. Different plugins may have completely different configuration approaches. Here are some common concepts that many sync implementations might support:

### **Connection Configuration**

Most sync implementations need some way to connect to a remote data source:



{% capture snippet_gxg67t %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{{ snippet_gxg67t  | strip }}
```


### **Sync Behavior**

Common sync behaviors that plugins might implement:



{% capture snippet_8rwuvm %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{{ snippet_8rwuvm  | strip }}
```


### **Event Handling**

Many sync implementations provide callbacks for sync events:



{% capture snippet_nrw1v6 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{{ snippet_nrw1v6  | strip }}
```


**Note:** The exact property names, values, and behavior depend on your specific plugin implementation.

## How It Works

### 1. **Plugin Integration**

When you enable syncing through a plugin, the plugin typically:

- Creates a connection to your remote data source
- Sets up the synchronization mechanism
- Configures any retry or error handling logic
- Establishes the sync behavior you've configured

Routier provides the hooks and events that the plugin listens to for data changes.

### 2. **Change Detection**

The system monitors:

- **Local changes** - When you add, update, or delete data
- **Remote changes** - When data is modified on the server
- **Conflicts** - When the same data is modified in multiple places

### 3. **Synchronization**

- **Push**: Local changes are sent to the remote server
- **Pull**: Remote changes are retrieved and applied locally
- **Merge**: Conflicts are resolved according to your strategy

### 4. **Retry Logic**

Many sync implementations include retry logic for failed attempts:

- **Simple retry**: Fixed delay between attempts
- **Exponential backoff**: Increasing delays between retries
- **Maximum retries**: Limit on total retry attempts
- **Custom strategies**: Plugin-specific retry behavior

The exact retry behavior depends on your plugin implementation.

## Example Implementation

Here's one example of how you might set up a synced data store with PouchDB. Other plugins may have different configuration approaches:



{% capture snippet_c0vihy %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{{ snippet_c0vihy  | strip }}
```


## Conflict Resolution

When conflicts occur (the same data is modified in multiple places), your plugin may provide ways to handle them:



{% capture snippet_zq3fq2 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{{ snippet_zq3fq2  | strip }}
```


**Note:** The exact conflict handling depends on your plugin implementation.

## Best Practices

### 1. **Network Handling**



{% capture snippet_5mub03 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{{ snippet_5mub03  | strip }}
```


### 2. **Error Handling**



{% capture snippet_cu2b4f %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{{ snippet_cu2b4f  | strip }}
```


### 3. **Performance Optimization**



{% capture snippet_eg7aet %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{{ snippet_eg7aet  | strip }}
```


## Monitoring and Debugging

### Sync Status

You can monitor sync status through your plugin's event callbacks:



{% capture snippet_0nto2h %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{{ snippet_0nto2h  | strip }}
```


### Debug Mode

Enable detailed logging for troubleshooting (if your plugin supports it):



{% capture snippet_98y1i5 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{{ snippet_98y1i5  | strip }}
```


## Supported Backends

Routier is designed to work with **any backend** - it's not limited to specific database types. The framework provides interfaces that any database plugin can use for syncing, regardless of the underlying technology.

**Examples of what's possible:**

- **PouchDB** - Full sync support with CouchDB compatibility (handles its own syncing)
- **SQLite** - Can implement sync with remote SQL databases
- **IndexedDB** - Can implement browser-based sync
- **PostgreSQL** - Can implement sync with remote PostgreSQL instances
- **MongoDB** - Can implement sync with MongoDB Atlas or other MongoDB services
- **Firebase** - Can implement real-time sync with Firebase
- **Custom APIs** - Can implement sync with any REST, GraphQL, or custom API
- **Custom plugins** - Can implement their own syncing strategies for any backend

**The key point:** Routier doesn't care what backend you use. It provides the data management framework, and you can implement syncing however you want for your specific backend technology. The syncing implementation is entirely up to the individual plugin, not Routier itself.

## Next Steps

- Learn about [Live Queries](../live-queries/) for real-time data updates
- Explore [Change Tracking](../../modification/change-tracking/) for local modifications
- See [Advanced Syncing](../advanced-syncing/) for complex scenarios
- Check out [PouchDB Syncing](./pouchdb-sync.md) for PouchDB-specific implementation details
