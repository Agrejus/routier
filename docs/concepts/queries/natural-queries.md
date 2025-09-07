# Natural Queries

Routier provides a natural, fluent query API that makes data retrieval intuitive and powerful. All queries are performed through a collection.

## Basic Querying

{% highlight ts linenos %}{% include code/from-docs/concepts/queries/natural-queries/block-1.ts %}{% endhighlight %}

Queries always start from a collection:

{% highlight ts linenos %}{% include code/from-docs/concepts/queries/natural-queries/block-2.ts %}{% endhighlight %}

## Filtering with Where

{% highlight ts linenos %}{% include code/from-docs/concepts/queries/natural-queries/block-3.ts %}{% endhighlight %}

### Parameterized queries

When compiling to a JavaScript filter function, free variables cannot be evaluated. Inject values via parameters to avoid full collection scans:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/natural-queries/block-1.ts %}{% endhighlight %}


## Sorting

{% highlight ts linenos %}{% include code/from-docs/concepts/queries/natural-queries/block-4.ts %}{% endhighlight %}

## Mapping and Transformation

{% highlight ts linenos %}{% include code/from-docs/concepts/queries/natural-queries/block-5.ts %}{% endhighlight %}

## Aggregation

{% highlight ts linenos %}{% include code/from-docs/concepts/queries/natural-queries/block-6.ts %}{% endhighlight %}

## Pagination

{% highlight ts linenos %}{% include code/from-docs/concepts/queries/natural-queries/block-7.ts %}{% endhighlight %}

## Chaining Queries

{% highlight ts linenos %}{% include code/from-docs/concepts/queries/natural-queries/block-8.ts %}{% endhighlight %}

## Next Steps

- [Expressions](/concepts/queries/expressions/) - Advanced filtering expressions
- [Query Options](/concepts/queries/query-options/) - Available query options
- [Performance Optimization](/concepts/data-pipeline/performance-optimization.md) - Optimizing query performance
