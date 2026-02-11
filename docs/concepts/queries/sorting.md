---
title: Sorting
layout: default
parent: Queries
nav_order: 2
permalink: /concepts/queries/sorting/
---

# Sorting Results

Sort your data in ascending or descending order using `orderBy` and `orderByDescending`.

## Quick Navigation

- [Ascending Sort](#ascending-sort)
- [Descending Sort](#descending-sort)
- [Multiple Sort Criteria](#multiple-sort-criteria)
- [Combined with Filtering](#combined-with-filtering)
- [Related](#related)

## Ascending Sort

Sort data in ascending order:

{% capture snippet_sorting_ascending %}{% include code/from-docs/concepts/queries/sorting-ascending.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_sorting_ascending | strip }}{% endhighlight %}

## Descending Sort

Sort data in descending order:

{% capture snippet_sorting_descending %}{% include code/from-docs/concepts/queries/sorting-descending.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_sorting_descending | strip }}{% endhighlight %}

## Multiple Sort Criteria

Chain multiple sort operations for complex sorting:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/sorting/block-1.ts %}{% endhighlight %}


## Combined with Filtering

Sort filtered results:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/sorting/block-2.ts %}{% endhighlight %}


## Related

- [Filtering Data](/concepts/queries/filtering/)
- [Pagination](/concepts/queries/pagination/)
- [Terminal Methods](/concepts/queries/terminal-methods/)
