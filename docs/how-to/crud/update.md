# Update Operations

Update operations in Routier leverage the framework's powerful change tracking system. Entities returned from queries are **proxy objects** that automatically track changes, making updates simple and efficient.

## Overview

Routier's update system works through:

1. **Proxy-based change tracking** - Entities automatically track modifications
2. **No manual update calls** - Changes are detected automatically
3. **Batch change management** - Multiple changes are saved together
4. **Type-safe updates** - Full TypeScript support for property modifications
5. **Efficient persistence** - Changes are optimized for database operations

## How Change Tracking Works

### Proxy Entities

When you query entities in Routier, they are returned as **proxy objects** that automatically track changes:


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/update/block-1.ts %}{% endhighlight %}


### Automatic Change Detection


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/update/block-2.ts %}{% endhighlight %}


## Basic Update Operations

### Single Property Updates


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/update/block-3.ts %}{% endhighlight %}


### Multiple Property Updates


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/update/block-4.ts %}{% endhighlight %}


### Nested Object Updates


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/update/block-5.ts %}{% endhighlight %}


### Array Updates


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/update/block-6.ts %}{% endhighlight %}


## Batch Update Operations

### Update Multiple Entities


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/update/block-7.ts %}{% endhighlight %}


### Conditional Batch Updates


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/update/block-8.ts %}{% endhighlight %}


### Batch Updates with Transformations


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/update/block-9.ts %}{% endhighlight %}


## Advanced Update Patterns

### Computed Updates


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/update/block-10.ts %}{% endhighlight %}


### Incremental Updates


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/update/block-11.ts %}{% endhighlight %}


### Conditional Field Updates


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/update/block-12.ts %}{% endhighlight %}


## Change Management

### Checking for Changes


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/update/block-13.ts %}{% endhighlight %}


### Saving Changes


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/update/block-14.ts %}{% endhighlight %}


### Partial Saves


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/update/block-15.ts %}{% endhighlight %}


## Update Validation

### Schema Validation


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/update/block-16.ts %}{% endhighlight %}


### Business Logic Validation


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/update/block-17.ts %}{% endhighlight %}


## Performance Considerations

### Batch Updates


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/update/block-18.ts %}{% endhighlight %}


### Change Batching


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/update/block-19.ts %}{% endhighlight %}


## Best Practices

### 1. **Leverage Change Tracking**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/update/block-20.ts %}{% endhighlight %}


### 2. **Update Related Fields Together**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/update/block-21.ts %}{% endhighlight %}


### 3. **Validate Before Updating**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/update/block-22.ts %}{% endhighlight %}


### 4. **Use Meaningful Update Patterns**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/update/block-23.ts %}{% endhighlight %}


## Error Handling

### Update Error Handling


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/update/block-24.ts %}{% endhighlight %}


## Next Steps

- [Create Operations](create.md) - Learn how to add new entities
- [Read Operations](read.md) - Learn how to query and retrieve data
- [Delete Operations](delete.md) - Learn how to remove entities
- [Bulk Operations](bulk/README.md) - Learn how to handle multiple entities efficiently
