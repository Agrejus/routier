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

The simplest way to create a new entity is using `addAsync()`:

{% capture snippet_vvzyz2 %}{% include code/from-docs/how-to/crud/create/single-entity.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_vvzyz2  | strip }}{% endhighlight %}

### Adding Multiple Entities

You can add multiple entities in a single operation for better performance:

{% capture snippet_gsb9ng %}{% include code/from-docs/how-to/crud/create/multiple-entities.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_gsb9ng  | strip }}{% endhighlight %}

### Adding with Callbacks

For advanced scenarios, you can use callback-based operations with error handling:

{% capture snippet_lyyye4 %}{% include code/from-docs/how-to/crud/create/callback-pattern.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_lyyye4  | strip }}{% endhighlight %}

## Schema-Driven Creation

### Automatic Default Values

Routier automatically applies default values defined in your schema:

{% capture snippet_yg8xxi %}{% include code/from-docs/how-to/crud/create/default-values.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_yg8xxi  | strip }}{% endhighlight %}

### Identity Field Generation

Identity fields are automatically generated when creating new entities:

{% capture snippet_hgf9sv %}{% include code/from-docs/how-to/crud/create/identity-generation.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_hgf9sv  | strip }}{% endhighlight %}

### Nested Object Creation

You can create entities with nested objects and arrays:

{% capture snippet_knkpix %}{% include code/from-docs/how-to/crud/create/nested-objects.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_knkpix  | strip }}{% endhighlight %}

## Type Safety and Error Handling

### Schema Type Checking

Routier provides compile-time type safety through TypeScript:

{% capture snippet_y4xs72 %}{% include code/from-docs/how-to/crud/create/schema-type-checking.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_y4xs72  | strip }}{% endhighlight %}

### TypeScript Type Safety

Use `InferCreateType` for proper type inference:

{% capture snippet_jv9ahy %}{% include code/from-docs/how-to/crud/create/typescript-type-safety.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_jv9ahy  | strip }}{% endhighlight %}

### Constraint Enforcement

Constraint enforcement depends on your plugin implementation:

{% capture snippet_0b1hfq %}{% include code/from-docs/how-to/crud/create/constraint-enforcement.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_0b1hfq  | strip }}{% endhighlight %}

## Advanced Create Patterns

### Conditional Creation

Create entities based on conditions or business logic:

{% capture snippet_cnidll %}{% include code/from-docs/how-to/crud/create/conditional-creation.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_cnidll  | strip }}{% endhighlight %}

### Batch Creation with Type Safety

Create multiple entities with proper type checking:

{% capture snippet_xxyrbc %}{% include code/from-docs/how-to/crud/create/batch-creation.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_xxyrbc  | strip }}{% endhighlight %}

### Creation with Computed Fields

Create entities that include computed or derived fields:

{% capture snippet_4705gv %}{% include code/from-docs/how-to/crud/create/computed-fields.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_4705gv  | strip }}{% endhighlight %}

## Performance Considerations

### Batch Creation

Batch creation is more efficient than individual creates:

{% capture snippet_k1ho3m %}{% include code/from-docs/how-to/crud/create/batch-performance.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_k1ho3m  | strip }}{% endhighlight %}

### Memory Management

Consider memory usage when creating large numbers of entities:

{% capture snippet_ltnx8g %}{% include code/from-docs/how-to/crud/create/memory-management.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_ltnx8g  | strip }}{% endhighlight %}

## Best Practices

### 1. **Type-Check Data Before Creation**

Validate data before creating entities:

{% capture snippet_u8ea3c %}{% include code/from-docs/how-to/crud/create/type-check-data.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_u8ea3c  | strip }}{% endhighlight %}

### 2. **Use Appropriate Default Values**

Define meaningful default values in your schema:

{% capture snippet_fc5ex3 %}{% include code/from-docs/how-to/crud/create/appropriate-defaults.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_fc5ex3  | strip }}{% endhighlight %}

### 3. **Handle Errors Gracefully**

Implement proper error handling for create operations:

{% capture snippet_uf275q %}{% include code/from-docs/how-to/crud/create/handle-errors.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_uf275q  | strip }}{% endhighlight %}

### 4. **Leverage Schema Features**

Use schema features like enums, defaults, and constraints effectively:

{% capture snippet_n3llsb %}{% include code/from-docs/how-to/crud/create/leverage-schema-features.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_n3llsb  | strip }}{% endhighlight %}

## Common Patterns

### User Registration

```ts
const newUser = await ctx.users.addAsync({
  name: userData.name,
  email: userData.email,
  passwordHash: await hashPassword(userData.password),
});
await ctx.saveChangesAsync();
```

### Product Catalog Management

```ts
const products = await ctx.products.addAsync(
  ...productData.map((p) => ({
    name: p.name,
    price: p.price,
    category: p.category,
    inStock: true,
  }))
);
await ctx.saveChangesAsync();
```

### Bulk Data Import

```ts
const batchSize = 100;
for (let i = 0; i < data.length; i += batchSize) {
  const batch = data.slice(i, i + batchSize);
  await ctx.items.addAsync(...batch);
  await ctx.saveChangesAsync();
}
```

## Next Steps

- [Read Operations](read.md) - Learn how to query and retrieve data
- [Update Operations](update.md) - Learn how to modify existing entities
- [Delete Operations](delete.md) - Learn how to remove entities
- [Bulk Operations](bulk/README.md) - Learn how to handle multiple entities efficiently
