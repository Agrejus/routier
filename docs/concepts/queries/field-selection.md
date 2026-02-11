---
title: Field Selection
layout: default
parent: Queries
nav_order: 3
permalink: /concepts/queries/field-selection/
---

# Selecting Fields

Use `map` to select specific fields or create computed values from your data.

## Quick Navigation

- [Select Specific Fields](#select-specific-fields)
- [Computed Fields](#computed-fields)
- [Single Field Selection](#single-field-selection)
- [Combined with Other Operations](#combined-with-other-operations)
- [Related](#related)

## Select Specific Fields

Project only the fields you need:

{% capture snippet_selecting_fields %}{% include code/from-docs/concepts/queries/selecting-fields.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_selecting_fields | strip }}{% endhighlight %}

## Computed Fields

Create computed values and transformations:

{% capture snippet_selecting_computed %}{% include code/from-docs/concepts/queries/selecting-computed.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_selecting_computed | strip }}{% endhighlight %}

## Single Field Selection

Select just one field:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/field-selection/block-1.ts %}{% endhighlight %}


## Combined with Other Operations

Use field selection with filtering and sorting:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/field-selection/block-2.ts %}{% endhighlight %}


## Related

- [Filtering Data](/concepts/queries/filtering/)
- [Sorting Results](/concepts/queries/sorting/)
- [Terminal Methods](/concepts/queries/terminal-methods/)
