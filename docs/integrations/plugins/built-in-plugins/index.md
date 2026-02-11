---
title: Built-in Plugins
layout: default
parent: Integrations
has_children: true
nav_order: 1
permalink: /integrations/plugins/built-in-plugins/
---

## Built-in Plugins

Routier provides several built-in storage plugins to get you started quickly.

## Quick Navigation

- [Overview](#overview)
- [Installation](#installation)
- [Creating Your Own Plugin](#creating-your-own-plugin)

## Overview

Each plugin provides storage capabilities for different environments:

- **Memory**: Fast in-memory storage for testing and prototyping
- **Local Storage**: Persistent browser storage
- **File System**: File-based storage for Node.js environments
- **Dexie**: IndexedDB wrapper with advanced querying
- **SQLite**: SQL database for desktop and server applications
- **PouchDB**: Sync-enabled NoSQL database

## Installation

Install the plugins you need:

```bash
npm install @routier/memory-plugin
npm install @routier/local-storage-plugin
npm install @routier/file-system-plugin
npm install @routier/dexie-plugin
npm install @routier/sqlite-plugin
npm install @routier/pouchdb-plugin
```

## Creating Your Own Plugin

Creating a custom plugin is straightforward—implement the `IDbPlugin` interface from `@routier/core/plugins`. The interface requires three methods: `query`, `bulkPersist`, and `destroy`.

### Implementing the Interface


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/built-in-plugins/index/block-2.ts %}{% endhighlight %}


### Important Considerations

#### ITranslatedValue and Result Wrapping

Query results must be wrapped in an `ITranslatedValue` implementation. This interface provides two key capabilities:

1. **Iteration**: Allows the datastore to iterate over results, which is required for grouped queries where results are key-value pairs rather than simple arrays.

2. **Change Tracking**: The `isTrackable` property indicates whether change tracking should be enabled for the results. This is automatically determined from `event.operation.changeTracking`, which is `true` when the query returns full entities (not aggregated or mapped results).

When using a `DataTranslator` (like `JsonTranslator` or `SqlTranslator`), the `translate()` method automatically wraps results in the appropriate `ITranslatedValue` implementation:

- `TranslatedArrayValue` for standard array results
- `TranslatedGroupValue` for grouped results (key-value pairs)
- `TranslatedSingleValue` for single primitive values

If you're not using a translator, you can manually wrap results using these classes.

#### Query Translation

The `query` method receives `event.operation` which contains a Routier query with filters, sorts, pagination, etc. You need to translate this into your backend's query format:

- **Filters**: `event.operation.options` contains filter expressions that need translation
- **Sorting**: Extract sort operations from `event.operation.options`
- **Pagination**: Handle `skip` and `take` options
- **Field Selection**: Support `map` operations for field selection
- **Aggregations**: Translate `count`, `min`, `max`, `sum`, etc. to your backend

For SQL backends, Routier provides `SqlTranslator` to help translate results back to entities. Consider using helper utilities similar to `buildFromQueryOperation` used in the SQLite plugin.

#### Bulk Persist Iteration

The `bulkPersist` method receives **all collections and views** that have changes:


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/built-in-plugins/index/block-3.ts %}{% endhighlight %}


#### Schema Information

Access schema metadata via `event.schemas.get(schemaId)` to get:

- Collection name: `schema.collectionName`
- Properties: `schema.properties` (keys, identities, indexes, distinct constraints)
- Identity properties: Properties marked with `.key().identity()`
- Indexed properties: Properties marked with `.index()`

#### Indexes and Table Creation

**Plugins are responsible for:**

- Creating tables/collections/storage structures
- Creating indexes for properties marked with `.index()`
- Enforcing uniqueness for `.distinct()` properties
- Handling identity/auto-increment columns
- Managing schemas (collections vs views - your plugin decides)

The SQLite plugin creates tables lazily on first use, but you can create them eagerly in a setup phase.

#### Result Handling

For `query`: Return entities matching the query shape wrapped in an `ITranslatedValue`. The `ITranslatedValue` interface allows the datastore to:

- Iterate over results (required for grouped queries)
- Determine if change tracking should be enabled based on the `isTrackable` property

Use `TranslatedArrayValue` for array results or other implementations for different result shapes. Routier handles change tracking automatically when `isTrackable` is `true`.

For `bulkPersist`: You must populate the result object returned by `event.operation.toResult()`. After persisting, update the result:


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/built-in-plugins/index/block-4.ts %}{% endhighlight %}


#### Single Collection Datastores

If your backend uses a single physical collection for all entities (like PouchDB), you need a way to separate entities by collection. Add a tracked computed property to schemas that stores the collection name:


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/built-in-plugins/index/block-5.ts %}{% endhighlight %}


Then filter by `documentType` when querying to ensure collections don't collide.

### Complete Example

See the [SQLite plugin implementation](https://github.com/agrejus/routier/blob/main/plugins/sqlite/src/SqliteDbPlugin.ts) for a complete reference showing:

- Query translation
- Bulk persist iteration
- Table creation and schema management
- Transaction handling
- Error handling

## Related

- [Create Your Own Plugin](../create-your-own/) - Detailed guide with more examples
