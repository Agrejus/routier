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


{% capture snippet_vvzyz2 %}{% include code/from-docs/how-to/crud/create/block-1.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_vvzyz2 }}{% endhighlight %}


### Adding Multiple Entities


{% capture snippet_gsb9ng %}{% include code/from-docs/how-to/crud/create/block-2.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_gsb9ng }}{% endhighlight %}


### Adding with Callbacks

**Note: Callback-based operations use a discriminated union result pattern. The callback receives a single `result` parameter that can be either `{ ok: "success", data: T }` or `{ ok: "error", error: any }`.**


{% capture snippet_lyyye4 %}{% include code/from-docs/how-to/crud/create/block-3.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_lyyye4 }}{% endhighlight %}


## Schema-Driven Creation

### Automatic Default Values


{% capture snippet_yg8xxi %}{% include code/from-docs/how-to/crud/create/block-4.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_yg8xxi }}{% endhighlight %}


### Identity Field Generation


{% capture snippet_hgf9sv %}{% include code/from-docs/how-to/crud/create/block-5.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_hgf9sv }}{% endhighlight %}


### Nested Object Creation


{% capture snippet_knkpix %}{% include code/from-docs/how-to/crud/create/block-6.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_knkpix }}{% endhighlight %}


## Validation and Error Handling

### Schema Validation


{% capture snippet_y4xs72 %}{% include code/from-docs/how-to/crud/create/block-7.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_y4xs72 }}{% endhighlight %}


### Type Validation


{% capture snippet_jv9ahy %}{% include code/from-docs/how-to/crud/create/block-8.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_jv9ahy }}{% endhighlight %}


### Constraint Validation


{% capture snippet_0b1hfq %}{% include code/from-docs/how-to/crud/create/block-9.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_0b1hfq }}{% endhighlight %}


## Advanced Create Patterns

### Conditional Creation


{% capture snippet_cnidll %}{% include code/from-docs/how-to/crud/create/block-10.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_cnidll }}{% endhighlight %}


### Batch Creation with Validation


{% capture snippet_xxyrbc %}{% include code/from-docs/how-to/crud/create/block-11.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_xxyrbc }}{% endhighlight %}


### Creation with Computed Fields


{% capture snippet_4705gv %}{% include code/from-docs/how-to/crud/create/block-12.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_4705gv }}{% endhighlight %}


## Performance Considerations

### Batch Creation


{% capture snippet_k1ho3m %}{% include code/from-docs/how-to/crud/create/block-13.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_k1ho3m }}{% endhighlight %}


### Memory Management


{% capture snippet_ltnx8g %}{% include code/from-docs/how-to/crud/create/block-14.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_ltnx8g }}{% endhighlight %}


## Best Practices

### 1. **Validate Data Before Creation**


{% capture snippet_u8ea3c %}{% include code/from-docs/how-to/crud/create/block-15.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_u8ea3c }}{% endhighlight %}


### 2. **Use Appropriate Default Values**


{% capture snippet_fc5ex3 %}{% include code/from-docs/how-to/crud/create/block-16.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_fc5ex3 }}{% endhighlight %}


### 3. **Handle Errors Gracefully**


{% capture snippet_uf275q %}{% include code/from-docs/how-to/crud/create/block-17.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_uf275q }}{% endhighlight %}


### 4. **Leverage Schema Features**


{% capture snippet_n3llsb %}{% include code/from-docs/how-to/crud/create/block-18.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_n3llsb }}{% endhighlight %}


## Next Steps

- [Read Operations](read.md) - Learn how to query and retrieve data
- [Update Operations](update.md) - Learn how to modify existing entities
- [Delete Operations](delete.md) - Learn how to remove entities
- [Bulk Operations](bulk/README.md) - Learn how to handle multiple entities efficiently
