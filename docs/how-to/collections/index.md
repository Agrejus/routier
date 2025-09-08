---
title: Collections
layout: default
parent: Data Operations
has_children: true
nav_order: 3
---

## Collections

Task-focused guides for working with collections.

### Global scope (collection discriminator)

When multiple entity types share a single physical table/collection (e.g., PouchDB), define a tracked computed discriminator (like `collectionName`) on your schema and apply a global scope at collection creation. This ensures all queries are constrained to the correct logical collection and avoids collisions on shared field names.

{% capture snippet_scope_single_db %}{% include code/how-to/collections/scope-single-db.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_scope_single_db | strip }}{% endhighlight %}
