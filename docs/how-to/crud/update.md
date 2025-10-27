---
title: Update Operations
layout: default
parent: CRUD
grand_parent: Data Operations
nav_order: 4
---

# Update Operations

Update operations in Routier leverage the framework's powerful change tracking system. Entities returned from queries are **proxy objects** that automatically track changes, making updates simple and efficient.

## Quick Navigation

- [Overview](#overview)
- [How Change Tracking Works](#how-change-tracking-works)
- [Basic Update Operations](#basic-update-operations)
- [Batch Update Operations](#batch-update-operations)
- [Advanced Update Patterns](#advanced-update-patterns)
- [Change Management](#change-management)
- [Update Type Safety](#update-type-safety)
- [Performance Considerations](#performance-considerations)
- [Best Practices](#best-practices)
- [Error Handling](#error-handling)
- [Common Update Patterns](#common-update-patterns)
- [Next Steps](#next-steps)

## Overview

Routier's update system works through:

1. **Proxy-based change tracking** - Entities automatically track modifications
2. **No manual update calls** - Changes are detected automatically
3. **Batch change management** - Multiple changes are saved together
4. **Type-safe updates** - Full TypeScript support for property modifications
5. **Efficient persistence** - Changes are optimized for database operations

## How Change Tracking Works

### Proxy Entities

When you query entities in Routier, they are returned as **proxy objects** that automatically track changes:

{% capture snippet_0z48wy %}{% include code/from-docs/how-to/crud/update/proxy-entities.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_0z48wy  | strip }}{% endhighlight %}

### Automatic Change Detection

Routier automatically detects property changes without requiring manual update calls:

{% capture snippet_yc1i8q %}{% include code/from-docs/how-to/crud/update/automatic-change-detection.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_yc1i8q  | strip }}{% endhighlight %}

## Basic Update Operations

### Single Property Updates

Update individual properties on entities:

{% capture snippet_2zb0mt %}{% include code/from-docs/how-to/crud/update/single-property-updates.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_2zb0mt  | strip }}{% endhighlight %}

### Multiple Property Updates

Update multiple properties on a single entity:

{% capture snippet_kp5kwi %}{% include code/from-docs/how-to/crud/update/multiple-property-updates.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_kp5kwi  | strip }}{% endhighlight %}

### Nested Object Updates

Update nested objects and their properties:

{% capture snippet_yzjelp %}{% include code/from-docs/how-to/crud/update/nested-object-updates.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_yzjelp  | strip }}{% endhighlight %}

### Array Updates

Modify arrays within entities:

{% capture snippet_m0pu4q %}{% include code/from-docs/how-to/crud/update/array-updates.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_m0pu4q  | strip }}{% endhighlight %}

## Batch Update Operations

### Update Multiple Entities

Update multiple entities efficiently:

{% capture snippet_pvqwqf %}{% include code/from-docs/how-to/crud/update/update-multiple-entities.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_pvqwqf  | strip }}{% endhighlight %}

### Conditional Batch Updates

Apply updates based on conditions:

{% capture snippet_wv83pp %}{% include code/from-docs/how-to/crud/update/conditional-batch-updates.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_wv83pp  | strip }}{% endhighlight %}

### Batch Updates with Transformations

Apply transformations to multiple entities:

{% capture snippet_nhh9ur %}{% include code/from-docs/how-to/crud/update/batch-updates-with-transformations.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_nhh9ur  | strip }}{% endhighlight %}

## Advanced Update Patterns

### Computed Updates

Update entities with computed or derived values:

{% capture snippet_vhw95t %}{% include code/from-docs/how-to/crud/update/computed-updates.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_vhw95t  | strip }}{% endhighlight %}

### Incremental Updates

Apply incremental changes to numeric fields:

{% capture snippet_wm35ir %}{% include code/from-docs/how-to/crud/update/incremental-updates.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_wm35ir  | strip }}{% endhighlight %}

### Conditional Field Updates

Update fields based on specific conditions:

{% capture snippet_0he1gr %}{% include code/from-docs/how-to/crud/update/conditional-field-updates.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_0he1gr  | strip }}{% endhighlight %}

## Change Management

### Checking for Changes

Monitor and check for pending changes:

{% capture snippet_tzekfo %}{% include code/from-docs/how-to/crud/update/checking-for-changes.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_tzekfo  | strip }}{% endhighlight %}

### Saving Changes

Persist tracked changes to the database:

{% capture snippet_ypky6a %}{% include code/from-docs/how-to/crud/update/saving-changes.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_ypky6a  | strip }}{% endhighlight %}

### Partial Saves

Save changes in batches or selectively:

{% capture snippet_rd7whz %}{% include code/from-docs/how-to/crud/update/partial-saves.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_rd7whz  | strip }}{% endhighlight %}

## Update Type Safety

### Schema Type Checking

Ensure type safety when updating entities:

{% capture snippet_361bbf %}{% include code/from-docs/how-to/crud/update/schema-type-checking.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_361bbf  | strip }}{% endhighlight %}

### Business Logic Type Checking

Implement business logic validation during updates:

{% capture snippet_gy1j1u %}{% include code/from-docs/how-to/crud/update/business-logic-type-checking.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_gy1j1u  | strip }}{% endhighlight %}

## Performance Considerations

### Batch Updates

Optimize performance with batch update operations:

{% capture snippet_sl83kr %}{% include code/from-docs/how-to/crud/update/batch-updates.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_sl83kr  | strip }}{% endhighlight %}

### Change Batching

Manage change batching for optimal performance:

{% capture snippet_kp4hzu %}{% include code/from-docs/how-to/crud/update/change-batching.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_kp4hzu  | strip }}{% endhighlight %}

## Best Practices

### 1. **Leverage Change Tracking**

Take advantage of automatic change tracking:

{% capture snippet_wsbnun %}{% include code/from-docs/how-to/crud/update/leverage-change-tracking.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_wsbnun  | strip }}{% endhighlight %}

### 2. **Update Related Fields Together**

Update related fields in a single operation:

{% capture snippet_4scm75 %}{% include code/from-docs/how-to/crud/update/update-related-fields-together.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_4scm75  | strip }}{% endhighlight %}

### 3. **Validate Before Updating**

Implement validation before applying updates:

{% capture snippet_grsuc9 %}{% include code/from-docs/how-to/crud/update/validate-before-updating.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_grsuc9  | strip }}{% endhighlight %}

### 4. **Use Meaningful Update Patterns**

Follow consistent patterns for updates:

{% capture snippet_6764ib %}{% include code/from-docs/how-to/crud/update/meaningful-update-patterns.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_6764ib  | strip }}{% endhighlight %}

## Error Handling

### Update Error Handling

Handle errors gracefully during update operations:

{% capture snippet_s88jdm %}{% include code/from-docs/how-to/crud/update/update-error-handling.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_s88jdm  | strip }}{% endhighlight %}

## Common Update Patterns

### User Profile Updates

```ts
const user = await ctx.users.where((u) => u.id === userId).firstAsync();
if (user) {
  user.name = newData.name;
  user.email = newData.email;
  user.updatedAt = new Date();
  await ctx.saveChangesAsync();
}
```

### Status Updates

```ts
const orders = await ctx.orders
  .where((o) => o.status === "pending")
  .toArrayAsync();
orders.forEach((order) => {
  order.status = "processing";
  order.processedAt = new Date();
});
await ctx.saveChangesAsync();
```

### Batch Price Updates

```ts
const products = await ctx.products
  .where((p) => p.category === "electronics")
  .toArrayAsync();
products.forEach((product) => {
  product.price = product.price * 1.1; // 10% increase
});
await ctx.saveChangesAsync();
```

## Next Steps

- [Create Operations](create.md) - Learn how to add new entities
- [Read Operations](read.md) - Learn how to query and retrieve data
- [Delete Operations](delete.md) - Learn how to remove entities
- [Bulk Operations](bulk/README.md) - Learn how to handle multiple entities efficiently
