---
title: Update Operations
layout: default
parent: CRUD
grand_parent: Data Operations
nav_order: 4
---

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

{% capture snippet_0z48wy %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_0z48wy | escape }}{% endhighlight %}

### Automatic Change Detection

{% capture snippet_yc1i8q %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_yc1i8q | escape }}{% endhighlight %}

## Basic Update Operations

### Single Property Updates

{% capture snippet_2zb0mt %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_2zb0mt | escape }}{% endhighlight %}

### Multiple Property Updates

{% capture snippet_kp5kwi %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_kp5kwi | escape }}{% endhighlight %}

### Nested Object Updates

{% capture snippet_yzjelp %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_yzjelp | escape }}{% endhighlight %}

### Array Updates

{% capture snippet_m0pu4q %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_m0pu4q | escape }}{% endhighlight %}

## Batch Update Operations

### Update Multiple Entities

{% capture snippet_pvqwqf %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_pvqwqf | escape }}{% endhighlight %}

### Conditional Batch Updates

{% capture snippet_wv83pp %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_wv83pp | escape }}{% endhighlight %}

### Batch Updates with Transformations

{% capture snippet_nhh9ur %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_nhh9ur | escape }}{% endhighlight %}

## Advanced Update Patterns

### Computed Updates

{% capture snippet_vhw95t %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_vhw95t | escape }}{% endhighlight %}

### Incremental Updates

{% capture snippet_wm35ir %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_wm35ir | escape }}{% endhighlight %}

### Conditional Field Updates

{% capture snippet_0he1gr %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_0he1gr | escape }}{% endhighlight %}

## Change Management

### Checking for Changes

{% capture snippet_tzekfo %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_tzekfo | escape }}{% endhighlight %}

### Saving Changes

{% capture snippet_ypky6a %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_ypky6a | escape }}{% endhighlight %}

### Partial Saves

{% capture snippet_rd7whz %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_rd7whz | escape }}{% endhighlight %}

## Update Validation

### Schema Validation

{% capture snippet_361bbf %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_361bbf | escape }}{% endhighlight %}

### Business Logic Validation

{% capture snippet_gy1j1u %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_gy1j1u | escape }}{% endhighlight %}

## Performance Considerations

### Batch Updates

{% capture snippet_sl83kr %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_sl83kr | escape }}{% endhighlight %}

### Change Batching

{% capture snippet_kp4hzu %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_kp4hzu | escape }}{% endhighlight %}

## Best Practices

### 1. **Leverage Change Tracking**

{% capture snippet_wsbnun %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_wsbnun | escape }}{% endhighlight %}

### 2. **Update Related Fields Together**

{% capture snippet_4scm75 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_4scm75 | escape }}{% endhighlight %}

### 3. **Validate Before Updating**

{% capture snippet_grsuc9 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_grsuc9 | escape }}{% endhighlight %}

### 4. **Use Meaningful Update Patterns**

{% capture snippet_6764ib %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_6764ib | escape }}{% endhighlight %}

## Error Handling

### Update Error Handling

{% capture snippet_s88jdm %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_s88jdm | escape }}{% endhighlight %}

## Next Steps

- [Create Operations](create.md) - Learn how to add new entities
- [Read Operations](read.md) - Learn how to query and retrieve data
- [Delete Operations](delete.md) - Learn how to remove entities
- [Bulk Operations](bulk/README.md) - Learn how to handle multiple entities efficiently
