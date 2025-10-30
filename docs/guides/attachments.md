---
title: Attachments and Dirty Tracking
layout: default
parent: Guides
nav_order: 9
permalink: /guides/attachments/
---

## Attachments and Dirty Tracking

Goal: Understand how to inspect and control the internal change tracking set for a collection, force-mark items dirty, and transfer tracking metadata across `DataStore` instances.

### When to use

- You need to persist an entity even if no properties changed (force dirty)
- You want to include/exclude specific entities from the next save
- You run multiple `DataStore` instances and need to transfer the tracked set between them

### Key ideas

- **Attachments collection**: Each collection exposes an attachments helper for interacting with the change-tracked set
- **Dirty state**: Use `getChangeType(entity)` to inspect state and `markDirty(entity)` to force persistence
- **Add/Remove**: Use `set(...entities)` and `remove(entity)` to manage which entities are tracked
- **Transfer**: Move attachments between `DataStore` instances to keep tracking metadata in sync

### Example

{% capture snippet_attach %}{% include code/from-docs/guides/attachments/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_attach | strip }}{% endhighlight %}

### Notes

- `markDirty` is useful when a plugin requires an update write even if values are identical
- Transferring attachments works best when both contexts reference the same physical database/plugin config

## Related

- **[Change Tracking]({{ site.baseurl }}/concepts/change-tracking/)** — how change tracking works
- **[State Management]({{ site.baseurl }}/guides/state-management)** — patterns for working with collections and saves
