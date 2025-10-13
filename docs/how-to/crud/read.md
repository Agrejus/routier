---
title: Read Operations
layout: default
parent: CRUD
grand_parent: Data Operations
nav_order: 3
---

# Read Operations

Read operations in Routier provide powerful querying capabilities with a fluent, chainable API. The framework supports filtering, sorting, pagination, and aggregation operations.

## Overview

Routier's read operations feature:

1. **Fluent query API** - Chain multiple operations together
2. **Type-safe queries** - Full TypeScript support
3. **Efficient filtering** - Database-level query optimization
4. **Flexible sorting** - Multiple sort criteria support
5. **Built-in aggregation** - Count, sum, min, max operations
6. **Pagination support** - Skip and take operations

## Basic Query Operations

### Getting All Entities

{% capture snippet_9o40qi %}{% include code/from-docs/how-to/crud/read/basic-queries.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_9o40qi  | strip }}{% endhighlight %}

### Getting Single Entities

{% capture snippet_t6x45d %}{% include code/from-docs/how-to/crud/read/simple-filters.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_t6x45d  | strip }}{% endhighlight %}

## Filtering with Where

### Simple Filters

{% capture snippet_p5nl2e %}{% include code/from-docs/how-to/crud/read/parameterized-filters.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_p5nl2e  | strip }}{% endhighlight %}

### Parameterized Filters

{% capture snippet_jcvg14 %}{% include code/from-docs/how-to/crud/read/advanced-filters.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_jcvg14  | strip }}{% endhighlight %}

### Advanced Filters

{% capture snippet_v1gr0f %}{% include code/from-docs/how-to/crud/read/basic-sorting.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_v1gr0f  | strip }}{% endhighlight %}

## Sorting

### Basic Sorting

{% capture snippet_mb35us %}{% include code/from-docs/how-to/crud/read/complex-sorting.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_mb35us  | strip }}{% endhighlight %}

### Complex Sorting

{% capture snippet_kiewxc %}{% include code/from-docs/how-to/crud/read/skip-take.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_kiewxc  | strip }}{% endhighlight %}

## Pagination

### Skip and Take

{% capture snippet_q0v3kz %}{% include code/from-docs/how-to/crud/read/complete-pagination.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_q0v3kz  | strip }}{% endhighlight %}

### Complete Pagination Example

{% capture snippet_5hcao5 %}{% include code/from-docs/how-to/crud/read/counting.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_5hcao5  | strip }}{% endhighlight %}

## Aggregation Operations

### Counting

{% capture snippet_xunr8i %}{% include code/from-docs/how-to/crud/read/sum-operations.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_xunr8i  | strip }}{% endhighlight %}

### Sum Operations

{% capture snippet_jm836j %}{% include code/from-docs/how-to/crud/read/min-max-operations.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_jm836j  | strip }}{% endhighlight %}

### Min and Max Operations

{% capture snippet_nnkaip %}{% include code/from-docs/how-to/crud/read/distinct-values.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_nnkaip  | strip }}{% endhighlight %}

### Distinct Values

{% capture snippet_wq7fry %}{% include code/from-docs/how-to/crud/read/mapping-data.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_wq7fry  | strip }}{% endhighlight %}

## Data Transformation

### Mapping Data

{% capture snippet_oygbvt %}{% include code/from-docs/how-to/crud/read/complex-transformations.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_oygbvt  | strip }}{% endhighlight %}

### Complex Transformations

{% capture snippet_zrxxjw %}{% include code/from-docs/how-to/crud/read/complex-query-examples.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_zrxxjw  | strip }}{% endhighlight %}

## Query Chaining

### Complex Query Examples

{% capture snippet_cqlpyx %}{% include code/from-docs/how-to/crud/read/query-optimization.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_cqlpyx  | strip }}{% endhighlight %}

### Query with Aggregation

{% capture snippet_7zimzt %}{% include code/from-docs/how-to/crud/read/memory-management.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_7zimzt  | strip }}{% endhighlight %}

## Performance Considerations

### Query Optimization

{% capture snippet_7w1agc %}{% include code/from-docs/how-to/crud/read/appropriate-query-methods.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_7w1agc  | strip }}{% endhighlight %}

### Memory Management

{% capture snippet_gytojx %}{% include code/from-docs/how-to/crud/read/chain-operations-efficiently.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_gytojx  | strip }}{% endhighlight %}

## Best Practices

### 1. **Use Appropriate Query Methods**

{% capture snippet_7xxzgt %}{% include code/from-docs/how-to/crud/read/handle-empty-results.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_7xxzgt  | strip }}{% endhighlight %}

### 2. **Chain Operations Efficiently**

{% capture snippet_8phcbm %}{% include code/from-docs/how-to/crud/read/type-safe-queries.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_8phcbm  | strip }}{% endhighlight %}

### 3. **Handle Empty Results Gracefully**

{% capture snippet_fvul6i %}{% include code/from-docs/how-to/crud/read/type-safe-queries.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_fvul6i  | strip }}{% endhighlight %}

### 4. **Use Type-Safe Queries**

{% capture snippet_mfx2x7 %}{% include code/from-docs/how-to/crud/read/type-safe-queries.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_mfx2x7  | strip }}{% endhighlight %}

## Next Steps

- [Create Operations](create.md) - Learn how to add new entities
- [Update Operations](update.md) - Learn how to modify existing entities
- [Delete Operations](delete.md) - Learn how to remove entities
- [Bulk Operations](bulk/README.md) - Learn how to handle multiple entities efficiently
