---
title: Change Tracking
---

## Change Tracking

Change tracking records in-memory modifications to entities returned from collections so you can persist them explicitly with `saveChanges()`/`saveChangesAsync()`.

### When to use

- You need predictable, explicit persistence rather than implicit auto-saves
- You want to inspect what will be saved (adds/updates/removes) before committing
- You coordinate multiple changes across collections and save them together

### Key ideas

- **Tracked entities**: Entities returned from collections are proxied; property writes are tracked automatically
- **Explicit persistence**: Nothing is saved until you call `saveChanges()`/`saveChangesAsync()`
- **Aggregated result**: Saves return counts for `adds`, `updates`, `removes` so you can reason about work performed
- **Attachments**: A helper that lets you inspect/adjust the tracked set (force-mark dirty, add/remove, transfer between `DataStore`s)

### Basics


<<< @/_snippets/code/from-docs/concepts/change-tracking/block-1.ts


### Attachments overview

Use attachments to control what will be saved:

- Inspect: `getChangeType(entity)` returns state such as `notModified`, `propertiesChanged`, `markedDirty`
- Force persist: `markDirty(entity)` saves the entity even if no fields changed
- Include/Exclude: `set(...entities)` and `remove(entity)`
- Transfer: move attachments between contexts when using multiple `DataStore` instances

For a step-by-step guide and runnable example, see **[Attachments & Dirty Tracking](/guides/attachments)**.

## Related

- **[State Management](/guides/state-management)** — patterns for working with collections and saves
- **[Live Queries](/guides/live-queries)** — reactive reads
- **[Collections](/how-to/collections/)** — working with collections and views
