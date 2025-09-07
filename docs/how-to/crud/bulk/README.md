---
title: Bulk Operations
layout: default
parent: CRUD
grand_parent: Data Operations
nav_order: 6
---

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

{% capture snippet_yrprqb %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_yrprqb | escape }}{% endhighlight %}

### Bulk Add with Array

{% capture snippet_uw8bcx %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_uw8bcx | escape }}{% endhighlight %}

### Bulk Add with Data Generation

{% capture snippet_jvrsl9 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_jvrsl9 | escape }}{% endhighlight %}

## Bulk Update Operations

### Batch Property Updates

{% capture snippet_eag9mn %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_eag9mn | escape }}{% endhighlight %}

### Conditional Bulk Updates

{% capture snippet_xp7cs4 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_xp7cs4 | escape }}{% endhighlight %}

### Bulk Updates with Transformations

{% capture snippet_q9gyuz %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_q9gyuz | escape }}{% endhighlight %}

## Bulk Delete Operations

### Remove Multiple Entities

{% capture snippet_cyz6su %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_cyz6su | escape }}{% endhighlight %}

### Remove by Query

{% capture snippet_x08o3f %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_x08o3f | escape }}{% endhighlight %}

### Bulk Remove with Confirmation

{% capture snippet_w3hrvr %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_w3hrvr | escape }}{% endhighlight %}

## Bulk Operations with Change Tracking

### Efficient Change Management

{% capture snippet_tb922c %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_tb922c | escape }}{% endhighlight %}

### Previewing Bulk Changes

{% capture snippet_qs8ydl %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_qs8ydl | escape }}{% endhighlight %}

## Performance Considerations

### Batch Size Optimization

{% capture snippet_bf0381 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_bf0381 | escape }}{% endhighlight %}

### Memory Management

{% capture snippet_99drnf %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_99drnf | escape }}{% endhighlight %}

## Error Handling in Bulk Operations

### Graceful Failure Handling

{% capture snippet_i43kay %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_i43kay | escape }}{% endhighlight %}

### Partial Success Handling

{% capture snippet_u5x4xt %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_u5x4xt | escape }}{% endhighlight %}

## Best Practices

### 1. **Use Appropriate Batch Sizes**

{% capture snippet_6rl9cc %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_6rl9cc | escape }}{% endhighlight %}

### 2. **Save Changes Strategically**

{% capture snippet_sz50tg %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_sz50tg | escape }}{% endhighlight %}

### 3. **Handle Errors Gracefully**

{% capture snippet_gcc4wa %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_gcc4wa | escape }}{% endhighlight %}

### 4. **Monitor Performance**

{% capture snippet_3htkn6 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_3htkn6 | escape }}{% endhighlight %}

## Next Steps

- [CRUD Operations](../README.md) - Back to basic CRUD operations
- [Data Collections](../../data-collections/) - Understanding collections and change tracking
- [Performance Optimization](../../../advanced-features/performance-profiling/) - Optimizing bulk operations
- [State Management](../state-management/) - Managing application state with Routier
