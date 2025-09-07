---
title: Extending Collections
layout: default
parent: Collections
grand_parent: Data Operations
nav_order: 1
---

## Extending Collections

You can extend a generated collection to add domain-specific helpers while preserving typing and change tracking.

### Example

{% capture snippet_4yc1wf %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_4yc1wf | escape;
  }
}
```

### Notes

- The `create((Instance, ...args) => new class extends Instance { ... })` pattern ensures the subclass receives the same constructor args and types as the base collection.
- Prefer adding cohesive, high-level helpers (e.g. `addPerformanceAsync`, `addWithDefaults`, `bulkImportAsync`).
- All base collection methods remain available (`where`, `map`, `toArrayAsync`, `saveChangesAsync`, attachments, etc.).

### When to use

- Encapsulate repeated collection-specific operations.
- Provide intent-revealing APIs for your domain while keeping the underlying query and persistence behavior.
