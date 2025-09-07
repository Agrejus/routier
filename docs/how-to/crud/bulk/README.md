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


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/bulk/README/block-1.ts %}{% endhighlight %}


### Bulk Add with Array


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/bulk/README/block-2.ts %}{% endhighlight %}


### Bulk Add with Data Generation


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/bulk/README/block-3.ts %}{% endhighlight %}


## Bulk Update Operations

### Batch Property Updates


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/bulk/README/block-4.ts %}{% endhighlight %}


### Conditional Bulk Updates


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/bulk/README/block-5.ts %}{% endhighlight %}


### Bulk Updates with Transformations


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/bulk/README/block-6.ts %}{% endhighlight %}


## Bulk Delete Operations

### Remove Multiple Entities


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/bulk/README/block-7.ts %}{% endhighlight %}


### Remove by Query


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/bulk/README/block-8.ts %}{% endhighlight %}


### Bulk Remove with Confirmation


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/bulk/README/block-9.ts %}{% endhighlight %}


## Bulk Operations with Change Tracking

### Efficient Change Management


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/bulk/README/block-10.ts %}{% endhighlight %}


### Previewing Bulk Changes


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/bulk/README/block-11.ts %}{% endhighlight %}


## Performance Considerations

### Batch Size Optimization


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/bulk/README/block-12.ts %}{% endhighlight %}


### Memory Management


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/bulk/README/block-13.ts %}{% endhighlight %}


## Error Handling in Bulk Operations

### Graceful Failure Handling


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/bulk/README/block-14.ts %}{% endhighlight %}


### Partial Success Handling


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/bulk/README/block-15.ts %}{% endhighlight %}


## Best Practices

### 1. **Use Appropriate Batch Sizes**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/bulk/README/block-16.ts %}{% endhighlight %}


### 2. **Save Changes Strategically**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/bulk/README/block-17.ts %}{% endhighlight %}


### 3. **Handle Errors Gracefully**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/bulk/README/block-18.ts %}{% endhighlight %}


### 4. **Monitor Performance**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/bulk/README/block-19.ts %}{% endhighlight %}


## Next Steps

- [CRUD Operations](../README.md) - Back to basic CRUD operations
- [Data Collections](../../data-collections/) - Understanding collections and change tracking
- [Performance Optimization](../../../advanced-features/performance-profiling/) - Optimizing bulk operations
- [State Management](../state-management/) - Managing application state with Routier
