# Delete Operations

Delete operations in Routier allow you to remove entities from your collections. The framework provides both individual and batch deletion methods, with support for query-based removal and proper cleanup.

## Overview

Routier's delete operations feature:

1. **Individual entity removal** - Remove specific entities by reference
2. **Batch deletion** - Remove multiple entities efficiently
3. **Query-based removal** - Remove entities matching specific criteria
4. **Automatic cleanup** - Proper disposal of removed entities
5. **Change tracking** - Deletions are tracked until saved

## ⚠️ Important: Persistence Requires Save

**Note: When you call `removeAsync()`, the entity is marked for removal in memory, but it is NOT automatically removed from the database. You must call `saveChanges()` or `saveChangesAsync()` to persist the deletion.**

## Basic Delete Operations

### Removing Single Entities


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/delete/block-1.ts %}{% endhighlight %}


### Removing Multiple Entities


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/delete/block-2.ts %}{% endhighlight %}


### Removing with Callbacks


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/delete/block-3.ts %}{% endhighlight %}


## Query-Based Deletion

### Remove by Query


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/delete/block-4.ts %}{% endhighlight %}


### Remove with Complex Criteria


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/delete/block-5.ts %}{% endhighlight %}


### Remove with Parameters


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/delete/block-6.ts %}{% endhighlight %}


## Batch Deletion Patterns

### Remove by Status


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/delete/block-7.ts %}{% endhighlight %}


### Remove with Confirmation


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/delete/block-8.ts %}{% endhighlight %}


### Remove with Backup


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/delete/block-9.ts %}{% endhighlight %}


## Advanced Deletion Patterns

### Cascading Deletion


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/delete/block-10.ts %}{% endhighlight %}


### Soft Deletion


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/delete/block-11.ts %}{% endhighlight %}


### Conditional Deletion


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/delete/block-12.ts %}{% endhighlight %}


## Change Management for Deletions

### Checking Deletion Changes


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/delete/block-13.ts %}{% endhighlight %}


### Saving Deletion Changes


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/delete/block-14.ts %}{% endhighlight %}


### Rolling Back Deletions


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/delete/block-15.ts %}{% endhighlight %}


## Performance Considerations

### Batch Deletion


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/delete/block-16.ts %}{% endhighlight %}


### Large Dataset Deletion


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/delete/block-17.ts %}{% endhighlight %}


## Error Handling

### Safe Deletion


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/delete/block-18.ts %}{% endhighlight %}


### Deletion with Recovery


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/delete/block-19.ts %}{% endhighlight %}


## Best Practices

### 1. **Confirm Deletions for Important Data**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/delete/block-20.ts %}{% endhighlight %}


### 2. **Use Appropriate Deletion Methods**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/delete/block-21.ts %}{% endhighlight %}


### 3. **Handle Related Data Appropriately**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/delete/block-22.ts %}{% endhighlight %}


### 4. **Log Deletion Operations**


{% highlight ts linenos %}{% include code/from-docs/how-to/crud/delete/block-23.ts %}{% endhighlight %}


## Next Steps

- [Create Operations](create.md) - Learn how to add new entities
- [Read Operations](read.md) - Learn how to query and retrieve data
- [Update Operations](update.md) - Learn how to modify existing entities
- [Bulk Operations](bulk/README.md) - Learn how to handle multiple entities efficiently
