---
title: Delete Operations
layout: default
parent: CRUD
grand_parent: Data Operations
nav_order: 5
---

# Delete Operations

Delete operations in Routier allow you to remove entities from your collections. The framework provides both individual and batch deletion methods, with support for query-based removal and proper cleanup.

## Quick Navigation

- [Overview](#overview)
- [Basic Delete Operations](#basic-delete-operations)
- [Query-Based Deletion](#query-based-deletion)
- [Batch Deletion Patterns](#batch-deletion-patterns)
- [Advanced Deletion Patterns](#advanced-deletion-patterns)
- [Change Management for Deletions](#change-management-for-deletions)
- [Performance Considerations](#performance-considerations)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [Common Deletion Patterns](#common-deletion-patterns)
- [Deletion Strategies](#deletion-strategies)
- [Next Steps](#next-steps)

## Overview

Routier's delete operations feature:

1. **Individual entity removal** - Remove specific entities by reference
2. **Batch deletion** - Remove multiple entities efficiently
3. **Query-based removal** - Remove entities matching specific criteria
4. **Automatic cleanup** - Proper disposal of removed entities
5. **Change tracking** - Deletions are tracked until saved

## ⚠️ Important: Persistence Requires Save

**Note: When you call `removeAsync()`, the entity is marked for removal in memory, but it is NOT automatically removed from the database. You must call `saveChanges()` or `saveChangesAsync()` to persist the deletion.**

## Basic Delete Operations

### Removing Single Entities

Remove individual entities by reference:

{% capture snippet_7mnuqn %}{% include code/from-docs/how-to/crud/delete/removing-single-entities.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_7mnuqn  | strip }}{% endhighlight %}

### Removing Multiple Entities

Remove multiple entities in a single operation:

{% capture snippet_i4h7cy %}{% include code/from-docs/how-to/crud/delete/removing-multiple-entities.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_i4h7cy  | strip }}{% endhighlight %}

### Removing with Callbacks

Use callback-based deletion for advanced error handling:

{% capture snippet_o2pl49 %}{% include code/from-docs/how-to/crud/delete/removing-with-callbacks.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_o2pl49  | strip }}{% endhighlight %}

## Query-Based Deletion

### Remove by Query

Remove entities matching specific criteria:

{% capture snippet_jowtyu %}{% include code/from-docs/how-to/crud/delete/remove-by-query.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_jowtyu  | strip }}{% endhighlight %}

### Remove with Complex Criteria

Apply complex filtering conditions for deletion:

{% capture snippet_ntn7jz %}{% include code/from-docs/how-to/crud/delete/remove-with-complex-criteria.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_ntn7jz  | strip }}{% endhighlight %}

### Remove with Parameters

Use parameterized queries for dynamic deletion:

{% capture snippet_fexf0e %}{% include code/from-docs/how-to/crud/delete/remove-with-parameters.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_fexf0e  | strip }}{% endhighlight %}

## Batch Deletion Patterns

### Remove by Status

Delete entities based on status or state:

{% capture snippet_khspbq %}{% include code/from-docs/how-to/crud/delete/remove-by-status.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_khspbq  | strip }}{% endhighlight %}

### Remove with Confirmation

Implement confirmation patterns for important deletions:

{% capture snippet_pjopln %}{% include code/from-docs/how-to/crud/delete/remove-with-confirmation.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_pjopln  | strip }}{% endhighlight %}

### Remove with Backup

Create backups before performing deletions:

{% capture snippet_kdmz4x %}{% include code/from-docs/how-to/crud/delete/remove-with-backup.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_kdmz4x  | strip }}{% endhighlight %}

## Advanced Deletion Patterns

### Cascading Deletion

Handle related data when deleting entities:

{% capture snippet_9c2sj8 %}{% include code/from-docs/how-to/crud/delete/cascading-deletion.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_9c2sj8  | strip }}{% endhighlight %}

### Soft Deletion

Implement soft deletion patterns:

{% capture snippet_p26y1b %}{% include code/from-docs/how-to/crud/delete/soft-deletion.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_p26y1b  | strip }}{% endhighlight %}

### Conditional Deletion

Apply conditional logic to deletion operations:

{% capture snippet_2s8ypq %}{% include code/from-docs/how-to/crud/delete/conditional-deletion.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_2s8ypq  | strip }}{% endhighlight %}

## Change Management for Deletions

### Checking Deletion Changes

Monitor deletion changes before saving:

{% capture snippet_56jqdx %}{% include code/from-docs/how-to/crud/delete/checking-deletion-changes.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_56jqdx  | strip }}{% endhighlight %}

### Saving Deletion Changes

Persist deletion changes to the database:

{% capture snippet_ca6a7p %}{% include code/from-docs/how-to/crud/delete/saving-deletion-changes.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_ca6a7p  | strip }}{% endhighlight %}

### Rolling Back Deletions

Implement rollback mechanisms for deletions:

{% capture snippet_nlb686 %}{% include code/from-docs/how-to/crud/delete/rolling-back-deletions.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_nlb686  | strip }}{% endhighlight %}

## Performance Considerations

### Batch Deletion

Optimize performance with batch deletion operations:

{% capture snippet_f10lqn %}{% include code/from-docs/how-to/crud/delete/batch-deletion.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_f10lqn  | strip }}{% endhighlight %}

### Large Dataset Deletion

Handle large dataset deletions efficiently:

{% capture snippet_bdc0uw %}{% include code/from-docs/how-to/crud/delete/large-dataset-deletion.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_bdc0uw  | strip }}{% endhighlight %}

## Error Handling

### Safe Deletion

Implement safe deletion patterns with error handling:

{% capture snippet_kx3x6d %}{% include code/from-docs/how-to/crud/delete/safe-deletion.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_kx3x6d  | strip }}{% endhighlight %}

### Deletion with Recovery

Implement recovery mechanisms for failed deletions:

{% capture snippet_ju9hps %}{% include code/from-docs/how-to/crud/delete/deletion-with-recovery.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_ju9hps  | strip }}{% endhighlight %}

## Best Practices

### 1. **Confirm Deletions for Important Data**

Always confirm important deletions:

{% capture snippet_3o6p0t %}{% include code/from-docs/how-to/crud/delete/confirm-deletions.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_3o6p0t  | strip }}{% endhighlight %}

### 2. **Use Appropriate Deletion Methods**

Choose the right deletion method for your use case:

{% capture snippet_vewmxn %}{% include code/from-docs/how-to/crud/delete/appropriate-deletion-methods.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_vewmxn  | strip }}{% endhighlight %}

### 3. **Handle Related Data Appropriately**

Consider related data when deleting entities:

{% capture snippet_acizfz %}{% include code/from-docs/how-to/crud/delete/handle-related-data.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_acizfz  | strip }}{% endhighlight %}

### 4. **Log Deletion Operations**

Implement logging for deletion operations:

{% capture snippet_gxg1tw %}{% include code/from-docs/how-to/crud/delete/log-deletion-operations.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_gxg1tw  | strip }}{% endhighlight %}

## Common Deletion Patterns

### User Account Deletion

```ts
const user = await ctx.users.where((u) => u.id === userId).firstAsync();
if (user) {
  // Delete related data first
  await ctx.userSessions.where((s) => s.userId === userId).removeAsync();
  await ctx.userPreferences.where((p) => p.userId === userId).removeAsync();

  // Delete the user
  await ctx.users.removeAsync(user);
  await ctx.saveChangesAsync();
}
```

### Cleanup Operations

```ts
// Remove old sessions
const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
await ctx.sessions.where((s) => s.lastActivity < cutoffDate).removeAsync();

// Remove inactive users
await ctx.users
  .where((u) => u.isActive === false && u.lastLogin < cutoffDate)
  .removeAsync();

await ctx.saveChangesAsync();
```

### Batch Cleanup with Confirmation

```ts
const itemsToDelete = await ctx.items
  .where((i) => i.status === "archived")
  .toArrayAsync();
if (itemsToDelete.length > 0) {
  const confirmed = await confirmDeletion(itemsToDelete.length);
  if (confirmed) {
    await ctx.items.removeAsync(itemsToDelete);
    await ctx.saveChangesAsync();
  }
}
```

## Deletion Strategies

### Hard Delete vs Soft Delete

**Hard Delete**: Permanently removes entities from the database

```ts
await ctx.users.removeAsync(user);
await ctx.saveChangesAsync();
```

**Soft Delete**: Marks entities as deleted without removing them

```ts
user.isDeleted = true;
user.deletedAt = new Date();
await ctx.saveChangesAsync();
```

### Cascade Delete Patterns

**Manual Cascade**: Explicitly delete related entities

```ts
// Delete user and all related data
await ctx.userSessions.where((s) => s.userId === userId).removeAsync();
await ctx.userPosts.where((p) => p.userId === userId).removeAsync();
await ctx.users.removeAsync(user);
```

**Database Cascade**: Let the database handle cascading (plugin-dependent)

```ts
// If your plugin supports cascade delete
await ctx.users.removeAsync(user); // Related data deleted automatically
```

## Next Steps

- [Create Operations](create.md) - Learn how to add new entities
- [Read Operations](read.md) - Learn how to query and retrieve data
- [Update Operations](update.md) - Learn how to modify existing entities
- [Bulk Operations](bulk/README.md) - Learn how to handle multiple entities efficiently
