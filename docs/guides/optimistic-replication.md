---
title: Optimistic Replication
layout: default
parent: Guides
nav_order: 8
---

## Optimistic Replication

Achieve near-instant reads by replicating data to a fast memory store, with writes going to persistent storage asynchronously. This pattern is sometimes called "Optimistic Updates" in other contexts, but the core concept is the same: provide immediate responsiveness by using fast, in-memory storage for operations that affect user experience.

## Quick Navigation

- [What is Optimistic Replication?](#what-is-optimistic-replication)
- [Why is it Fast?](#why-is-it-fast)
- [When to Use It](#when-to-use-it)
- [How It Works](#how-it-works)
- [Basic Setup](#basic-setup)
- [Complete Example](#complete-example)
- [Performance Considerations](#performance-considerations)
- [Related Guides](#related-guides)

## What is Optimistic Replication?

Optimistic replication is a performance pattern that uses a multi-tier storage architecture to provide near-instant read operations. The name "optimistic" comes from the assumption that operations will succeed, allowing the system to immediately return results from fast memory while persistence happens asynchronously in the background.

The pattern orchestrates three storage tiers:

1. **Memory Store (read source)**: All reads come from fast in-memory storage
2. **Source Plugin**: All writes go to a persistent storage plugin (e.g., IndexedDB via Dexie)
3. **Asynchronous Replication**: The source plugin automatically replicates data back to the memory store

This architecture provides the best of both worlds: lightning-fast reads from memory and persistent storage for durability. You get immediate UI responsiveness without sacrificing data persistence.

## Why is it Fast?

### Immediate Read Performance

All reads happen in memory, avoiding the latency of disk-based storage like IndexedDB. This means your queries execute immediately without waiting for database I/O operations.

### Non-Blocking Writes

Writes go to the persistent source plugin, but since reads come from memory, write latency doesn't affect your UI:


{% highlight ts linenos %}{% include code/from-docs/guides/optimistic-replication/block-1.ts %}{% endhighlight %}


## When to Use It

Use optimistic replication when you need:

- **Extremely responsive UIs**: Applications that require instant feedback
- **Heavy read workloads**: Applications that read data frequently
- **Complex queries**: Filtering, sorting, and aggregation on large datasets
- **Offline-first apps**: Apps that work offline but need persistence

**Note**: This pattern requires more memory since you're maintaining data in both memory and persistent storage.

## How It Works

The optimistic replication plugin coordinates three components:

1. **Read Plugin** (MemoryPlugin): Fast in-memory storage for reads
2. **Source Plugin** (e.g., DexiePlugin): Persistent storage for writes
3. **Automatic Hydration**: Source data is loaded into memory on initialization

```
┌─────────────────────────────────────────┐
│         Your Application                 │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│   OptimisticReplicationDbPlugin         │
│                                         │
│  ┌──────────────┐    ┌──────────────┐ │
│  │ MemoryPlugin │◄───│  DexiePlugin │ │
│  │  (reads)     │    │   (writes)   │ usa
│  └──────────────┘    └──────────────┘ │
│       Fast                  Persistent  │
└─────────────────────────────────────────┘
```

## Basic Setup


{% highlight ts linenos %}{% include code/from-docs/guides/optimistic-replication/block-2.ts %}{% endhighlight %}


## Complete Example

Here's a complete example using multiple collections:


{% highlight ts linenos %}{% include code/from-docs/guides/optimistic-replication/block-3.ts %}{% endhighlight %}


## Performance Considerations

### Memory Usage

Since data is stored in both memory and persistent storage, memory usage increases. Monitor your application's memory footprint, especially with large datasets.

### Initial Hydration

On first load, the memory store is hydrated from the source plugin. This is a one-time cost:


{% highlight ts linenos %}{% include code/from-docs/guides/optimistic-replication/block-4.ts %}{% endhighlight %}


### Write Latency

Writes still go to the persistent source plugin, so they have the same latency as direct use:

- **Read**: Instant (from memory)
- **Write**: Same as source plugin (Dexie ~10-100ms)

### Best Practices

1. **Use for read-heavy workloads**: The biggest benefit comes when you read frequently
2. **Monitor memory**: Keep an eye on memory usage with large datasets
3. **Consider data size**: Works best with datasets that fit comfortably in memory
4. **Combine with live queries**: Pair with live queries for the most responsive UIs

## Related Guides

- **[Plugin Compositions](plugin-compositions.md)** — Map of all plugin combinations and when to use each
- **[HttpSwrDbPlugin with Optimistic Replication](http-swr-with-optimistic.md)** — Combine with HTTP sync for maximum speed
- **[Live Queries](live-queries.md)** - Reactive data that updates automatically
- **[State Management](state-management.md)** - Managing application state
- **[Dexie Plugin](/integrations/plugins/built-in-plugins/dexie/)** - IndexedDB integration
