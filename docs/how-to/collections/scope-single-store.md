---
title: Scope a collection (single physical store)
layout: default
parent: Collections
grand_parent: Data Operations
nav_order: 2
permalink: /how-to/collections/scope-single-store/
---

## Scope a collection (single physical store)

For single-table/collection backends (e.g., PouchDB, Local Storage), scope each collection so queries only return documents for that logical collection.

## Quick Navigation

- [Steps](#steps)
- [Why Use Scoping](#why)
- [Related Topics](#related)

### Steps

1. Add a tracked computed discriminator to your schema that stores the logical collection name (for example, `documentType`).
2. Apply a global scope when creating the collection so all queries are constrained to that discriminator.

{% capture snippet_scope_single_db %}{% include code/how-to/collections/scope-single-db.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_scope_single_db | strip }}{% endhighlight %}

### Why

This prevents cross-type collisions when multiple entity types share a single physical table/collection.

### Related

- Concepts: [Data Collections]({{ site.baseurl }}/concepts/data-collections/)
- Integration: [PouchDB Plugin]({{ site.baseurl }}/integrations/plugins/built-in-plugins/pouchdb/)
