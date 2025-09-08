---
title: Create Your Own Plugin
layout: default
parent: Plugins
grand_parent: Integrations
nav_order: 3
---

## Overview

Creating your own plugin in very easy, simply implement the `IDbPlugin` found in `@routier/core` and profit. There

## Requirements

A plugin must implement a small interface that Routier uses during reads/writes:

- initialize/destroy lifecycle
- add/update/remove batched entity operations
- query execution with parameterized filters, ordering, skip/take
- change tracking integration (apply computed/tracked fields after save)
- identity/index awareness (keys, distinct, composite indexes)

## Minimal skeleton

{% capture snippet_plugin_min %}{% include code/integrations/plugins/create-your-own/minimal-plugin.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_plugin_min | strip }}{% endhighlight %}

## Key behaviors

- Respect schema metadata passed by collections (keys, indexes, nullable/optional/defaults).
- Compute fields marked as `computed()` after persistence; persist when `tracked()`.
- For `identity()` columns, return generated values so entities can be updated in memory before `saveChangesAsync()` resolves.
- For `distinct()`/`index()` ensure unique or indexed storage if supported by the backend.

### Separation for single-collection datastores

If your datastore persists all entities into one physical table/collection (e.g. PouchDB), add a tracked computed property to each schema that records its collection name. This guarantees clear separation between entity types and prevents cross‑collection collisions when fields share names (like `name`). See the tracked + computed example in the schema modifiers reference: [Tracked computed]({{ site.baseurl }}/concepts/schema/modifiers/collection-modifiers/#tracked-computed). With SQL/SQLite backends, this is not an issue since data is already isolated per table.

## Testing your plugin

- Start with the Memory plugin behavior as a reference.
- Use the CRUD how‑to pages to validate operations and saved changes.
- Wire into an example app and run live queries to ensure incremental updates behave as expected.

## Examples to study

- Built‑in implementations:
  - [Memory]({{ site.baseurl }}/integrations/plugins/built-in-plugins/memory/)
  - [Dexie]({{ site.baseurl }}/integrations/plugins/built-in-plugins/dexie/)
  - [PouchDB]({{ site.baseurl }}/integrations/plugins/built-in-plugins/pouchdb/)
  - [File System]({{ site.baseurl }}/integrations/plugins/built-in-plugins/file-system/)
  - [SQLite]({{ site.baseurl }}/integrations/plugins/built-in-plugins/sqlite/)

## Next steps

- Expose configuration via your plugin constructor (database name, connection string, options).
- Document installation and usage under Integrations → Plugins.
