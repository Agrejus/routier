# Natural Queries

Routier provides a natural, fluent query API that makes data retrieval intuitive and powerful. All queries are performed through a collection.

## Basic Querying

{% capture snippet_cohq0u %}{% include code/from-docs/concepts/queries/natural-queries/block-1.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_cohq0u }}{% endhighlight %}

Queries always start from a collection:

{% capture snippet_25zqea %}{% include code/from-docs/concepts/queries/natural-queries/block-2.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_25zqea }}{% endhighlight %}

## Filtering with Where

{% capture snippet_odc3mc %}{% include code/from-docs/concepts/queries/natural-queries/block-3.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_odc3mc }}{% endhighlight %}

### Parameterized queries

When compiling to a JavaScript filter function, free variables cannot be evaluated. Inject values via parameters to avoid full collection scans:


{% capture snippet_yh53h9 %}{% include code/from-docs/concepts/queries/natural-queries/block-1.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_yh53h9 }}{% endhighlight %}


## Sorting

{% capture snippet_9ex9mv %}{% include code/from-docs/concepts/queries/natural-queries/block-4.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_9ex9mv }}{% endhighlight %}

## Mapping and Transformation

{% capture snippet_biz3yl %}{% include code/from-docs/concepts/queries/natural-queries/block-5.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_biz3yl }}{% endhighlight %}

## Aggregation

{% capture snippet_2o2ifg %}{% include code/from-docs/concepts/queries/natural-queries/block-6.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_2o2ifg }}{% endhighlight %}

## Pagination

{% capture snippet_ia3pbi %}{% include code/from-docs/concepts/queries/natural-queries/block-7.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_ia3pbi }}{% endhighlight %}

## Chaining Queries

{% capture snippet_sxpk65 %}{% include code/from-docs/concepts/queries/natural-queries/block-8.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_sxpk65 }}{% endhighlight %}

## Next Steps

- [Expressions](/concepts/queries/expressions/) - Advanced filtering expressions
- [Query Options](/concepts/queries/query-options/) - Available query options
- [Performance Optimization](/concepts/data-pipeline/performance-optimization.md) - Optimizing query performance
