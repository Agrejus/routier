# Create Operations

Create operations in Routier allow you to add new entities to your collections. The framework provides both synchronous and asynchronous methods, with automatic change tracking and validation.

## Overview

When you create entities in Routier:

1. **Entities are validated** against your schema
2. **Default values are applied** automatically
3. **Identity fields are generated** if specified
4. **Changes are tracked** for later persistence
5. **Entities are returned** with all properties set

## ⚠️ Important: Persistence Requires Save

**Note: When you call `addAsync()`, the entity is added to the collection in memory, but it is NOT automatically persisted to the database. You must call `saveChanges()` or `saveChangesAsync()` to persist the changes.**

## Basic Create Operations

### Adding Single Entities


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/create/block-1.ts %}{% endhighlight %}


### Adding Multiple Entities


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/create/block-2.ts %}{% endhighlight %}


### Adding with Callbacks

**Note: Callback-based operations use a discriminated union result pattern. The callback receives a single `result` parameter that can be either `{ ok: "success", data: T }` or `{ ok: "error", error: any }`.**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/create/block-3.ts %}{% endhighlight %}


## Schema-Driven Creation

### Automatic Default Values


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/create/block-4.ts %}{% endhighlight %}


### Identity Field Generation


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/create/block-5.ts %}{% endhighlight %}


### Nested Object Creation


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/create/block-6.ts %}{% endhighlight %}


## Validation and Error Handling

### Schema Validation


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/create/block-7.ts %}{% endhighlight %}


### Type Validation


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/create/block-8.ts %}{% endhighlight %}


### Constraint Validation


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/create/block-9.ts %}{% endhighlight %}


## Advanced Create Patterns

### Conditional Creation


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/create/block-10.ts %}{% endhighlight %}


### Batch Creation with Validation


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/create/block-11.ts %}{% endhighlight %}


### Creation with Computed Fields


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/create/block-12.ts %}{% endhighlight %}


## Performance Considerations

### Batch Creation


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/create/block-13.ts %}{% endhighlight %}


### Memory Management


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/create/block-14.ts %}{% endhighlight %}


## Best Practices

### 1. **Validate Data Before Creation**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/create/block-15.ts %}{% endhighlight %}


### 2. **Use Appropriate Default Values**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/create/block-16.ts %}{% endhighlight %}


### 3. **Handle Errors Gracefully**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/create/block-17.ts %}{% endhighlight %}


### 4. **Leverage Schema Features**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/create/block-18.ts %}{% endhighlight %}


## Next Steps

- [Read Operations](read.md) - Learn how to query and retrieve data
- [Update Operations](update.md) - Learn how to modify existing entities
- [Delete Operations](delete.md) - Learn how to remove entities
- [Bulk Operations](bulk/README.md) - Learn how to handle multiple entities efficiently
