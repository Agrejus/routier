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


{% capture snippet_0z48wy %}{% include code/from-docs/how-to/crud/update/block-1.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_0z48wy }}{% endhighlight %}


### Automatic Change Detection


{% capture snippet_yc1i8q %}{% include code/from-docs/how-to/crud/update/block-2.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_yc1i8q }}{% endhighlight %}


## Basic Update Operations

### Single Property Updates


{% capture snippet_2zb0mt %}{% include code/from-docs/how-to/crud/update/block-3.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_2zb0mt }}{% endhighlight %}


### Multiple Property Updates


{% capture snippet_kp5kwi %}{% include code/from-docs/how-to/crud/update/block-4.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_kp5kwi }}{% endhighlight %}


### Nested Object Updates


{% capture snippet_yzjelp %}{% include code/from-docs/how-to/crud/update/block-5.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_yzjelp }}{% endhighlight %}


### Array Updates


{% capture snippet_m0pu4q %}{% include code/from-docs/how-to/crud/update/block-6.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_m0pu4q }}{% endhighlight %}


## Batch Update Operations

### Update Multiple Entities


{% capture snippet_pvqwqf %}{% include code/from-docs/how-to/crud/update/block-7.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_pvqwqf }}{% endhighlight %}


### Conditional Batch Updates


{% capture snippet_wv83pp %}{% include code/from-docs/how-to/crud/update/block-8.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_wv83pp }}{% endhighlight %}


### Batch Updates with Transformations


{% capture snippet_nhh9ur %}{% include code/from-docs/how-to/crud/update/block-9.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_nhh9ur }}{% endhighlight %}


## Advanced Update Patterns

### Computed Updates


{% capture snippet_vhw95t %}{% include code/from-docs/how-to/crud/update/block-10.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_vhw95t }}{% endhighlight %}


### Incremental Updates


{% capture snippet_wm35ir %}{% include code/from-docs/how-to/crud/update/block-11.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_wm35ir }}{% endhighlight %}


### Conditional Field Updates


{% capture snippet_0he1gr %}{% include code/from-docs/how-to/crud/update/block-12.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_0he1gr }}{% endhighlight %}


## Change Management

### Checking for Changes


{% capture snippet_tzekfo %}{% include code/from-docs/how-to/crud/update/block-13.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_tzekfo }}{% endhighlight %}


### Saving Changes


{% capture snippet_ypky6a %}{% include code/from-docs/how-to/crud/update/block-14.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_ypky6a }}{% endhighlight %}


### Partial Saves


{% capture snippet_rd7whz %}{% include code/from-docs/how-to/crud/update/block-15.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_rd7whz }}{% endhighlight %}


## Update Validation

### Schema Validation


{% capture snippet_361bbf %}{% include code/from-docs/how-to/crud/update/block-16.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_361bbf }}{% endhighlight %}


### Business Logic Validation


{% capture snippet_gy1j1u %}{% include code/from-docs/how-to/crud/update/block-17.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_gy1j1u }}{% endhighlight %}


## Performance Considerations

### Batch Updates


{% capture snippet_sl83kr %}{% include code/from-docs/how-to/crud/update/block-18.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_sl83kr }}{% endhighlight %}


### Change Batching


{% capture snippet_kp4hzu %}{% include code/from-docs/how-to/crud/update/block-19.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_kp4hzu }}{% endhighlight %}


## Best Practices

### 1. **Leverage Change Tracking**


{% capture snippet_wsbnun %}{% include code/from-docs/how-to/crud/update/block-20.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_wsbnun }}{% endhighlight %}


### 2. **Update Related Fields Together**


{% capture snippet_4scm75 %}{% include code/from-docs/how-to/crud/update/block-21.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_4scm75 }}{% endhighlight %}


### 3. **Validate Before Updating**


{% capture snippet_grsuc9 %}{% include code/from-docs/how-to/crud/update/block-22.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_grsuc9 }}{% endhighlight %}


### 4. **Use Meaningful Update Patterns**


{% capture snippet_6764ib %}{% include code/from-docs/how-to/crud/update/block-23.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_6764ib }}{% endhighlight %}


## Error Handling

### Update Error Handling


{% capture snippet_s88jdm %}{% include code/from-docs/how-to/crud/update/block-24.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_s88jdm }}{% endhighlight %}


## Next Steps

- [Create Operations](create.md) - Learn how to add new entities
- [Read Operations](read.md) - Learn how to query and retrieve data
- [Delete Operations](delete.md) - Learn how to remove entities
- [Bulk Operations](bulk/README.md) - Learn how to handle multiple entities efficiently
