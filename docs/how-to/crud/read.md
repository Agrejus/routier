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


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/read/block-1.ts %}{% endhighlight %}


### Getting Single Entities


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/read/block-2.ts %}{% endhighlight %}


## Filtering with Where

### Simple Filters


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/read/block-3.ts %}{% endhighlight %}


### Parameterized Filters


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/read/block-4.ts %}{% endhighlight %}


### Advanced Filters


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/read/block-5.ts %}{% endhighlight %}


## Sorting

### Basic Sorting


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/read/block-6.ts %}{% endhighlight %}


### Complex Sorting


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/read/block-7.ts %}{% endhighlight %}


## Pagination

### Skip and Take


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/read/block-8.ts %}{% endhighlight %}


### Complete Pagination Example


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/read/block-9.ts %}{% endhighlight %}


## Aggregation Operations

### Counting


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/read/block-10.ts %}{% endhighlight %}


### Sum Operations


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/read/block-11.ts %}{% endhighlight %}


### Min and Max Operations


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/read/block-12.ts %}{% endhighlight %}


### Distinct Values


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/read/block-13.ts %}{% endhighlight %}


## Data Transformation

### Mapping Data


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/read/block-14.ts %}{% endhighlight %}


### Complex Transformations


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/read/block-15.ts %}{% endhighlight %}


## Query Chaining

### Complex Query Examples


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/read/block-16.ts %}{% endhighlight %}


### Query with Aggregation


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/read/block-17.ts %}{% endhighlight %}


## Performance Considerations

### Query Optimization


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/read/block-18.ts %}{% endhighlight %}


### Memory Management


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/read/block-19.ts %}{% endhighlight %}


## Best Practices

### 1. **Use Appropriate Query Methods**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/read/block-20.ts %}{% endhighlight %}


### 2. **Chain Operations Efficiently**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/read/block-21.ts %}{% endhighlight %}


### 3. **Handle Empty Results Gracefully**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/read/block-22.ts %}{% endhighlight %}


### 4. **Use Type-Safe Queries**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/read/block-23.ts %}{% endhighlight %}


## Next Steps

- [Create Operations](create.md) - Learn how to add new entities
- [Update Operations](update.md) - Learn how to modify existing entities
- [Delete Operations](delete.md) - Learn how to remove entities
- [Bulk Operations](bulk/README.md) - Learn how to handle multiple entities efficiently
