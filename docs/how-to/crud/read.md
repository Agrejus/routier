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




{% capture snippet_9o40qi %}{% include code/%}{% endcapture %}

```ts
{{ snippet_9o40qi | escape }}
```



### Getting Single Entities




{% capture snippet_t6x45d %}{% include code/%}{% endcapture %}

```ts
{{ snippet_t6x45d | escape }}
```



## Filtering with Where

### Simple Filters




{% capture snippet_p5nl2e %}{% include code/%}{% endcapture %}

```ts
{{ snippet_p5nl2e | escape }}
```



### Parameterized Filters




{% capture snippet_jcvg14 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_jcvg14 | escape }}
```



### Advanced Filters




{% capture snippet_v1gr0f %}{% include code/%}{% endcapture %}

```ts
{{ snippet_v1gr0f | escape }}
```



## Sorting

### Basic Sorting




{% capture snippet_mb35us %}{% include code/%}{% endcapture %}

```ts
{{ snippet_mb35us | escape }}
```



### Complex Sorting




{% capture snippet_kiewxc %}{% include code/%}{% endcapture %}

```ts
{{ snippet_kiewxc | escape }}
```



## Pagination

### Skip and Take




{% capture snippet_q0v3kz %}{% include code/%}{% endcapture %}

```ts
{{ snippet_q0v3kz | escape }}
```



### Complete Pagination Example




{% capture snippet_5hcao5 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_5hcao5 | escape }}
```



## Aggregation Operations

### Counting




{% capture snippet_xunr8i %}{% include code/%}{% endcapture %}

```ts
{{ snippet_xunr8i | escape }}
```



### Sum Operations




{% capture snippet_jm836j %}{% include code/%}{% endcapture %}

```ts
{{ snippet_jm836j | escape }}
```



### Min and Max Operations




{% capture snippet_nnkaip %}{% include code/%}{% endcapture %}

```ts
{{ snippet_nnkaip | escape }}
```



### Distinct Values




{% capture snippet_wq7fry %}{% include code/%}{% endcapture %}

```ts
{{ snippet_wq7fry | escape }}
```



## Data Transformation

### Mapping Data




{% capture snippet_oygbvt %}{% include code/%}{% endcapture %}

```ts
{{ snippet_oygbvt | escape }}
```



### Complex Transformations




{% capture snippet_zrxxjw %}{% include code/%}{% endcapture %}

```ts
{{ snippet_zrxxjw | escape }}
```



## Query Chaining

### Complex Query Examples




{% capture snippet_cqlpyx %}{% include code/%}{% endcapture %}

```ts
{{ snippet_cqlpyx | escape }}
```



### Query with Aggregation




{% capture snippet_7zimzt %}{% include code/%}{% endcapture %}

```ts
{{ snippet_7zimzt | escape }}
```



## Performance Considerations

### Query Optimization




{% capture snippet_7w1agc %}{% include code/%}{% endcapture %}

```ts
{{ snippet_7w1agc | escape }}
```



### Memory Management




{% capture snippet_gytojx %}{% include code/%}{% endcapture %}

```ts
{{ snippet_gytojx | escape }}
```



## Best Practices

### 1. **Use Appropriate Query Methods**




{% capture snippet_7xxzgt %}{% include code/%}{% endcapture %}

```ts
{{ snippet_7xxzgt | escape }}
```



### 2. **Chain Operations Efficiently**




{% capture snippet_8phcbm %}{% include code/%}{% endcapture %}

```ts
{{ snippet_8phcbm | escape }}
```



### 3. **Handle Empty Results Gracefully**




{% capture snippet_fvul6i %}{% include code/%}{% endcapture %}

```ts
{{ snippet_fvul6i | escape }}
```



### 4. **Use Type-Safe Queries**




{% capture snippet_mfx2x7 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_mfx2x7 | escape }}
```



## Next Steps

- [Create Operations](create.md) - Learn how to add new entities
- [Update Operations](update.md) - Learn how to modify existing entities
- [Delete Operations](delete.md) - Learn how to remove entities
- [Bulk Operations](bulk/README.md) - Learn how to handle multiple entities efficiently
