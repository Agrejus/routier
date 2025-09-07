# Bulk Operations

Routier provides powerful bulk operations for efficiently handling large numbers of entities. Bulk operations are optimized for performance and can significantly improve the speed of data operations when working with multiple entities.

## Overview

Bulk operations allow you to:

- **Add multiple entities** in a single operation
- **Update multiple entities** efficiently
- **Remove multiple entities** by criteria
- **Process large datasets** with minimal overhead
- **Maintain consistency** across multiple operations

## ⚠️ Important: Persistence Requires Save

**Note: Bulk operations (add, update, remove) are tracked in memory but are NOT automatically persisted to the database. You must call `saveChanges()` or `saveChangesAsync()` to persist all bulk changes.**

## Bulk Create Operations

### Adding Multiple Entities


{% capture snippet_yrprqb %}{% include code/from-docs/how-to/crud/bulk/README/block-1.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_yrprqb }}{% endhighlight %}


### Bulk Add with Array


{% capture snippet_uw8bcx %}{% include code/from-docs/how-to/crud/bulk/README/block-2.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_uw8bcx }}{% endhighlight %}


### Bulk Add with Data Generation


{% capture snippet_jvrsl9 %}{% include code/from-docs/how-to/crud/bulk/README/block-3.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_jvrsl9 }}{% endhighlight %}


## Bulk Update Operations

### Batch Property Updates


{% capture snippet_eag9mn %}{% include code/from-docs/how-to/crud/bulk/README/block-4.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_eag9mn }}{% endhighlight %}


### Conditional Bulk Updates


{% capture snippet_xp7cs4 %}{% include code/from-docs/how-to/crud/bulk/README/block-5.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_xp7cs4 }}{% endhighlight %}


### Bulk Updates with Transformations


{% capture snippet_q9gyuz %}{% include code/from-docs/how-to/crud/bulk/README/block-6.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_q9gyuz }}{% endhighlight %}


## Bulk Delete Operations

### Remove Multiple Entities


{% capture snippet_cyz6su %}{% include code/from-docs/how-to/crud/bulk/README/block-7.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_cyz6su }}{% endhighlight %}


### Remove by Query


{% capture snippet_x08o3f %}{% include code/from-docs/how-to/crud/bulk/README/block-8.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_x08o3f }}{% endhighlight %}


### Bulk Remove with Confirmation


{% capture snippet_w3hrvr %}{% include code/from-docs/how-to/crud/bulk/README/block-9.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_w3hrvr }}{% endhighlight %}


## Bulk Operations with Change Tracking

### Efficient Change Management


{% capture snippet_tb922c %}{% include code/from-docs/how-to/crud/bulk/README/block-10.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_tb922c }}{% endhighlight %}


### Previewing Bulk Changes


{% capture snippet_qs8ydl %}{% include code/from-docs/how-to/crud/bulk/README/block-11.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_qs8ydl }}{% endhighlight %}


## Performance Considerations

### Batch Size Optimization


{% capture snippet_bf0381 %}{% include code/from-docs/how-to/crud/bulk/README/block-12.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_bf0381 }}{% endhighlight %}


### Memory Management


{% capture snippet_99drnf %}{% include code/from-docs/how-to/crud/bulk/README/block-13.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_99drnf }}{% endhighlight %}


## Error Handling in Bulk Operations

### Graceful Failure Handling


{% capture snippet_i43kay %}{% include code/from-docs/how-to/crud/bulk/README/block-14.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_i43kay }}{% endhighlight %}


### Partial Success Handling


{% capture snippet_u5x4xt %}{% include code/from-docs/how-to/crud/bulk/README/block-15.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_u5x4xt }}{% endhighlight %}


## Best Practices

### 1. **Use Appropriate Batch Sizes**


{% capture snippet_6rl9cc %}{% include code/from-docs/how-to/crud/bulk/README/block-16.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_6rl9cc }}{% endhighlight %}


### 2. **Save Changes Strategically**


{% capture snippet_sz50tg %}{% include code/from-docs/how-to/crud/bulk/README/block-17.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_sz50tg }}{% endhighlight %}


### 3. **Handle Errors Gracefully**


{% capture snippet_gcc4wa %}{% include code/from-docs/how-to/crud/bulk/README/block-18.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_gcc4wa }}{% endhighlight %}


### 4. **Monitor Performance**


{% capture snippet_3htkn6 %}{% include code/from-docs/how-to/crud/bulk/README/block-19.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_3htkn6 }}{% endhighlight %}


## Next Steps

- [CRUD Operations](../README.md) - Back to basic CRUD operations
- [Data Collections](../../data-collections/) - Understanding collections and change tracking
- [Performance Optimization](../../../advanced-features/performance-profiling/) - Optimizing bulk operations
- [State Management](../state-management/) - Managing application state with Routier
