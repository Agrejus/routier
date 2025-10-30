---
title: Basic Example
layout: default
parent: Tutorials
nav_order: 2
---

# Basic Example

This guide shows a complete working example of using Routier for a simple user management system.

## Complete Example

{% capture snippet_fmz07h %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_fmz07h  | strip }}{% endhighlight %}

## What This Example Shows

- **Schema definition** with various property types
- **Context class** extending DataStore
- **Collection creation** and data addition
- **Change tracking** and saving
- **Querying** with filters and sorting
- **Async operations** throughout

## Next Steps

- [Configuration](configuration.md) - Advanced configuration options
- [Schema Guide](../concepts/schema/creating-a-schema.md) - Detailed schema creation
- [Query Guide](../concepts/queries/index.md) - Advanced querying techniques
