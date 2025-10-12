---
title: Field Selection
layout: default
parent: Queries
nav_order: 3
permalink: /concepts/queries/field-selection/
---

# Selecting Fields

Use `map` to select specific fields or create computed values from your data.

## Quick Navigation

- [Select Specific Fields](#select-specific-fields)
- [Computed Fields](#computed-fields)
- [Single Field Selection](#single-field-selection)
- [Combined with Other Operations](#combined-with-other-operations)
- [Related](#related)

## Select Specific Fields

Project only the fields you need:

{% capture snippet_selecting_fields %}{% include code/from-docs/concepts/queries/selecting-fields.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_selecting_fields | strip }}{% endhighlight %}

## Computed Fields

Create computed values and transformations:

{% capture snippet_selecting_computed %}{% include code/from-docs/concepts/queries/selecting-computed.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_selecting_computed | strip }}{% endhighlight %}

## Single Field Selection

Select just one field:

```ts
// Get only product names
const productNames = await dataStore.products.map((p) => p.name).toArrayAsync();

// Get only prices
const productPrices = await dataStore.products
  .map((p) => p.price)
  .toArrayAsync();
```

## Combined with Other Operations

Use field selection with filtering and sorting:

```ts
const expensiveProductNames = await dataStore.products
  .where((p) => p.price > 100)
  .sortDescending((p) => p.price)
  .map((p) => p.name)
  .toArrayAsync();
```

## Related

- [Filtering Data](/concepts/queries/filtering/)
- [Sorting Results](/concepts/queries/sorting/)
- [Terminal Methods](/concepts/queries/terminal-methods/)
