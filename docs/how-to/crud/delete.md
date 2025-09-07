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


{% capture snippet_7mnuqn %}{% include code/from-docs/how-to/crud/delete/block-1.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_7mnuqn }}{% endhighlight %}


### Removing Multiple Entities


{% capture snippet_i4h7cy %}{% include code/from-docs/how-to/crud/delete/block-2.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_i4h7cy }}{% endhighlight %}


### Removing with Callbacks


{% capture snippet_o2pl49 %}{% include code/from-docs/how-to/crud/delete/block-3.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_o2pl49 }}{% endhighlight %}


## Query-Based Deletion

### Remove by Query


{% capture snippet_jowtyu %}{% include code/from-docs/how-to/crud/delete/block-4.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_jowtyu }}{% endhighlight %}


### Remove with Complex Criteria


{% capture snippet_ntn7jz %}{% include code/from-docs/how-to/crud/delete/block-5.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_ntn7jz }}{% endhighlight %}


### Remove with Parameters


{% capture snippet_fexf0e %}{% include code/from-docs/how-to/crud/delete/block-6.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_fexf0e }}{% endhighlight %}


## Batch Deletion Patterns

### Remove by Status


{% capture snippet_khspbq %}{% include code/from-docs/how-to/crud/delete/block-7.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_khspbq }}{% endhighlight %}


### Remove with Confirmation


{% capture snippet_pjopln %}{% include code/from-docs/how-to/crud/delete/block-8.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_pjopln }}{% endhighlight %}


### Remove with Backup


{% capture snippet_kdmz4x %}{% include code/from-docs/how-to/crud/delete/block-9.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_kdmz4x }}{% endhighlight %}


## Advanced Deletion Patterns

### Cascading Deletion


{% capture snippet_9c2sj8 %}{% include code/from-docs/how-to/crud/delete/block-10.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_9c2sj8 }}{% endhighlight %}


### Soft Deletion


{% capture snippet_p26y1b %}{% include code/from-docs/how-to/crud/delete/block-11.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_p26y1b }}{% endhighlight %}


### Conditional Deletion


{% capture snippet_2s8ypq %}{% include code/from-docs/how-to/crud/delete/block-12.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_2s8ypq }}{% endhighlight %}


## Change Management for Deletions

### Checking Deletion Changes


{% capture snippet_56jqdx %}{% include code/from-docs/how-to/crud/delete/block-13.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_56jqdx }}{% endhighlight %}


### Saving Deletion Changes


{% capture snippet_ca6a7p %}{% include code/from-docs/how-to/crud/delete/block-14.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_ca6a7p }}{% endhighlight %}


### Rolling Back Deletions


{% capture snippet_nlb686 %}{% include code/from-docs/how-to/crud/delete/block-15.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_nlb686 }}{% endhighlight %}


## Performance Considerations

### Batch Deletion


{% capture snippet_f10lqn %}{% include code/from-docs/how-to/crud/delete/block-16.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_f10lqn }}{% endhighlight %}


### Large Dataset Deletion


{% capture snippet_bdc0uw %}{% include code/from-docs/how-to/crud/delete/block-17.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_bdc0uw }}{% endhighlight %}


## Error Handling

### Safe Deletion


{% capture snippet_kx3x6d %}{% include code/from-docs/how-to/crud/delete/block-18.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_kx3x6d }}{% endhighlight %}


### Deletion with Recovery


{% capture snippet_ju9hps %}{% include code/from-docs/how-to/crud/delete/block-19.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_ju9hps }}{% endhighlight %}


## Best Practices

### 1. **Confirm Deletions for Important Data**


{% capture snippet_3o6p0t %}{% include code/from-docs/how-to/crud/delete/block-20.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_3o6p0t }}{% endhighlight %}


### 2. **Use Appropriate Deletion Methods**


{% capture snippet_vewmxn %}{% include code/from-docs/how-to/crud/delete/block-21.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_vewmxn }}{% endhighlight %}


### 3. **Handle Related Data Appropriately**


{% capture snippet_acizfz %}{% include code/from-docs/how-to/crud/delete/block-22.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_acizfz }}{% endhighlight %}


### 4. **Log Deletion Operations**


{% capture snippet_gxg1tw %}{% include code/from-docs/how-to/crud/delete/block-23.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_gxg1tw }}{% endhighlight %}


## Next Steps

- [Create Operations](create.md) - Learn how to add new entities
- [Read Operations](read.md) - Learn how to query and retrieve data
- [Update Operations](update.md) - Learn how to modify existing entities
- [Bulk Operations](bulk/README.md) - Learn how to handle multiple entities efficiently
