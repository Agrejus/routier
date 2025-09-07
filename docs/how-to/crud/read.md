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


{% capture snippet_9o40qi %}{% include code/from-docs/how-to/crud/read/block-1.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_9o40qi }}{% endhighlight %}


### Getting Single Entities


{% capture snippet_t6x45d %}{% include code/from-docs/how-to/crud/read/block-2.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_t6x45d }}{% endhighlight %}


## Filtering with Where

### Simple Filters


{% capture snippet_p5nl2e %}{% include code/from-docs/how-to/crud/read/block-3.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_p5nl2e }}{% endhighlight %}


### Parameterized Filters


{% capture snippet_jcvg14 %}{% include code/from-docs/how-to/crud/read/block-4.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_jcvg14 }}{% endhighlight %}


### Advanced Filters


{% capture snippet_v1gr0f %}{% include code/from-docs/how-to/crud/read/block-5.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_v1gr0f }}{% endhighlight %}


## Sorting

### Basic Sorting


{% capture snippet_mb35us %}{% include code/from-docs/how-to/crud/read/block-6.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_mb35us }}{% endhighlight %}


### Complex Sorting


{% capture snippet_kiewxc %}{% include code/from-docs/how-to/crud/read/block-7.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_kiewxc }}{% endhighlight %}


## Pagination

### Skip and Take


{% capture snippet_q0v3kz %}{% include code/from-docs/how-to/crud/read/block-8.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_q0v3kz }}{% endhighlight %}


### Complete Pagination Example


{% capture snippet_5hcao5 %}{% include code/from-docs/how-to/crud/read/block-9.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_5hcao5 }}{% endhighlight %}


## Aggregation Operations

### Counting


{% capture snippet_xunr8i %}{% include code/from-docs/how-to/crud/read/block-10.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_xunr8i }}{% endhighlight %}


### Sum Operations


{% capture snippet_jm836j %}{% include code/from-docs/how-to/crud/read/block-11.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_jm836j }}{% endhighlight %}


### Min and Max Operations


{% capture snippet_nnkaip %}{% include code/from-docs/how-to/crud/read/block-12.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_nnkaip }}{% endhighlight %}


### Distinct Values


{% capture snippet_wq7fry %}{% include code/from-docs/how-to/crud/read/block-13.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_wq7fry }}{% endhighlight %}


## Data Transformation

### Mapping Data


{% capture snippet_oygbvt %}{% include code/from-docs/how-to/crud/read/block-14.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_oygbvt }}{% endhighlight %}


### Complex Transformations


{% capture snippet_zrxxjw %}{% include code/from-docs/how-to/crud/read/block-15.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_zrxxjw }}{% endhighlight %}


## Query Chaining

### Complex Query Examples


{% capture snippet_cqlpyx %}{% include code/from-docs/how-to/crud/read/block-16.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_cqlpyx }}{% endhighlight %}


### Query with Aggregation


{% capture snippet_7zimzt %}{% include code/from-docs/how-to/crud/read/block-17.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_7zimzt }}{% endhighlight %}


## Performance Considerations

### Query Optimization


{% capture snippet_7w1agc %}{% include code/from-docs/how-to/crud/read/block-18.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_7w1agc }}{% endhighlight %}


### Memory Management


{% capture snippet_gytojx %}{% include code/from-docs/how-to/crud/read/block-19.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_gytojx }}{% endhighlight %}


## Best Practices

### 1. **Use Appropriate Query Methods**


{% capture snippet_7xxzgt %}{% include code/from-docs/how-to/crud/read/block-20.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_7xxzgt }}{% endhighlight %}


### 2. **Chain Operations Efficiently**


{% capture snippet_8phcbm %}{% include code/from-docs/how-to/crud/read/block-21.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_8phcbm }}{% endhighlight %}


### 3. **Handle Empty Results Gracefully**


{% capture snippet_fvul6i %}{% include code/from-docs/how-to/crud/read/block-22.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_fvul6i }}{% endhighlight %}


### 4. **Use Type-Safe Queries**


{% capture snippet_mfx2x7 %}{% include code/from-docs/how-to/crud/read/block-23.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_mfx2x7 }}{% endhighlight %}


## Next Steps

- [Create Operations](create.md) - Learn how to add new entities
- [Update Operations](update.md) - Learn how to modify existing entities
- [Delete Operations](delete.md) - Learn how to remove entities
- [Bulk Operations](bulk/README.md) - Learn how to handle multiple entities efficiently
