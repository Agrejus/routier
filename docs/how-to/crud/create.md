---
title: Create Operations
layout: default
parent: CRUD
grand_parent: Data Operations
nav_order: 2
---

# Create Operations

Create operations in Routier allow you to add new entities to your collections. The framework provides both synchronous and asynchronous methods, with automatic change tracking and type safety.

## Overview

When you create entities in Routier:

1. **Entities are type-checked** against your schema
2. **Default values are applied** automatically
3. **Identity fields are generated** if specified
4. **Changes are tracked** for later persistence
5. **Entities are returned** with all properties set

## ⚠️ Important: Persistence Requires Save

**Note: When you call `addAsync()`, the entity is added to the collection in memory, but it is NOT automatically persisted to the database. You must call `saveChanges()` or `saveChangesAsync()` to persist the changes.**

## Basic Create Operations

### Adding Single Entities

{% capture snippet_vvzyz2 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_vvzyz2  | strip }}{% endhighlight %}

### Adding Multiple Entities

{% capture snippet_gsb9ng %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_gsb9ng  | strip }}{% endhighlight %}

### Adding with Callbacks

**Note: Callback-based operations use a discriminated union result pattern. The callback receives a single `result` parameter that can be either `{ ok: "success", data: T }` or `{ ok: "error", error: any }`.**

{% capture snippet_lyyye4 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_lyyye4  | strip }}{% endhighlight %}

## Schema-Driven Creation

### Automatic Default Values

{% capture snippet_yg8xxi %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_yg8xxi  | strip }}{% endhighlight %}

### Identity Field Generation

{% capture snippet_hgf9sv %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_hgf9sv  | strip }}{% endhighlight %}

### Nested Object Creation

{% capture snippet_knkpix %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_knkpix  | strip }}{% endhighlight %}

## Type Safety and Error Handling

### Schema Type Checking

Routier's `.distinct()` modifier creates database indexes for uniqueness constraints. The actual enforcement of these constraints depends on the plugin implementation - some plugins may enforce uniqueness at the database level, while others may allow duplicates in memory.

{% capture snippet_y4xs72 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_y4xs72  | strip }}{% endhighlight %}

### TypeScript Type Safety

Routier relies on TypeScript for compile-time type checking rather than runtime validation. Operations will succeed at runtime even with incorrect types, making it important to use TypeScript's type system and `InferCreateType` for proper type safety.

{% capture snippet_jv9ahy %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_jv9ahy  | strip }}{% endhighlight %}

### Constraint Enforcement

Constraint enforcement is handled by the individual plugins rather than Routier core. For example, SQLite plugins may enforce unique constraints at the database level, while memory plugins might allow duplicates. Check your specific plugin's documentation for constraint behavior.

{% capture snippet_0b1hfq %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_0b1hfq  | strip }}{% endhighlight %}

## Advanced Create Patterns

### Conditional Creation

{% capture snippet_cnidll %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_cnidll  | strip }}{% endhighlight %}

### Batch Creation with Type Safety

{% capture snippet_xxyrbc %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_xxyrbc  | strip }}{% endhighlight %}

### Creation with Computed Fields

{% capture snippet_4705gv %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_4705gv  | strip }}{% endhighlight %}

## Performance Considerations

### Batch Creation

{% capture snippet_k1ho3m %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_k1ho3m  | strip }}{% endhighlight %}

### Memory Management

{% capture snippet_ltnx8g %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_ltnx8g  | strip }}{% endhighlight %}

## Best Practices

### 1. **Type-Check Data Before Creation**

{% capture snippet_u8ea3c %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_u8ea3c  | strip }}{% endhighlight %}

### 2. **Use Appropriate Default Values**

{% capture snippet_fc5ex3 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_fc5ex3  | strip }}{% endhighlight %}

### 3. **Handle Errors Gracefully**

{% capture snippet_uf275q %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_uf275q  | strip }}{% endhighlight %}

### 4. **Leverage Schema Features**

{% capture snippet_n3llsb %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_n3llsb  | strip }}{% endhighlight %}

## Next Steps

- [Read Operations](read.md) - Learn how to query and retrieve data
- [Update Operations](update.md) - Learn how to modify existing entities
- [Delete Operations](delete.md) - Learn how to remove entities
- [Bulk Operations](bulk/README.md) - Learn how to handle multiple entities efficiently
