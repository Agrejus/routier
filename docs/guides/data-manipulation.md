---
title: Data Manipulation
layout: default
parent: Guides
nav_order: 4
---

## Data Manipulation

Practical recipes for transforming, updating, and working with data in your Routier collections.

## Quick Navigation

- [Overview](#overview)
- [Querying and Transforming Data](#querying-and-transforming-data)
- [Updating Entities with Proxies](#updating-entities-with-proxies)
- [How Proxies Work](#how-proxies-work)
- [Complete Example](#complete-example)
- [Related Guides](#related-guides)

## Overview

Data manipulation in Routier covers both querying your data and modifying it through proxy-based entities:

- **Querying**: Filter, sort, aggregate, and transform data with the fluent query API
- **Transforming**: Reshape entities using `map()` to project specific fields
- **Updating**: Modify entities using JavaScript proxies for automatic change tracking
- **Arrays & Objects**: Proper techniques for updating nested structures

## Querying and Transforming Data

All data manipulation operations are built into the query API. Here are common patterns:


{% highlight ts linenos %}{% include code/from-docs/guides/data-manipulation/block-1.ts %}{% endhighlight %}


## Updating Entities with Proxies

Entities returned from queries are **proxy objects** that automatically track changes. This means you update data by simply modifying properties—no manual update methods needed.

### How Proxies Work

JavaScript proxies intercept property assignments, allowing Routier to detect and track every change. When you modify an entity, the proxy:

1. Intercepts the property assignment
2. Records what changed
3. Marks the entity as dirty
4. Returns the operation as successful

This happens transparently—you write normal JavaScript code and Routier handles the tracking.

### Updating Simple Properties

Update properties directly:


{% highlight ts linenos %}{% include code/from-docs/guides/data-manipulation/block-2.ts %}{% endhighlight %}


### Updating Nested Objects

Nested objects are also proxied, so changes are tracked automatically:


{% highlight ts linenos %}{% include code/from-docs/guides/data-manipulation/block-3.ts %}{% endhighlight %}


### Updating Arrays

Arrays require special handling. Here's what works and what doesn't:

#### ✅ Works: Mutating Arrays Directly


{% highlight ts linenos %}{% include code/from-docs/guides/data-manipulation/block-4.ts %}{% endhighlight %}


#### ⚠️ Limitation: Replacing Entire Arrays

When you replace an entire array, the change is tracked:


{% highlight ts linenos %}{% include code/from-docs/guides/data-manipulation/block-5.ts %}{% endhighlight %}


### What Works and What Doesn't

**✅ Works (Tracked):**

- Direct property assignment: `user.name = "John"`
- Nested property updates: `user.address.city = "NYC"`
- Array mutations: `user.tags.push("new")`
- Replacing arrays: `user.tags = ["new", "array"]`
- Updating array elements: `user.orders[0].status = "shipped"`

**❌ Doesn't Work (Not Tracked):**

- Array methods that don't mutate: `.filter()`, `.map()`, `.slice()` (unless you reassign)
- Reassigning non-existent properties (adds to object but may not persist)
- Methods attached to the entity (these are stripped before persistence)

### Complete Example

Here's a complete example showing proper update patterns:


{% highlight ts linenos %}{% include code/from-docs/guides/data-manipulation/block-6.ts %}{% endhighlight %}


## Related Guides

- **[Update Operations](/how-to/crud/update)** - Detailed guide to updating entities
- **[Queries Guide](/concepts/queries/)** - Comprehensive query documentation
- **[Field Selection](/concepts/queries/field-selection/)** - Data transformation techniques
- **[Filtering](/concepts/queries/filtering/)** - Advanced filtering patterns
