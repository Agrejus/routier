---
title: Pagination
layout: default
parent: Queries
nav_order: 4
permalink: /concepts/queries/pagination/
---

# Pagination

Use `take` and `skip` to implement pagination for large datasets.

## Quick Navigation

- [Basic Pagination](#basic-pagination)
- [Simple Take and Skip](#simple-take-and-skip)
- [Pagination with Filtering](#pagination-with-filtering)
- [Pagination with Sorting](#pagination-with-sorting)
- [Related](#related)

## Basic Pagination

Implement page-based pagination:

{% capture snippet_pagination_example %}{% include code/from-docs/concepts/queries/pagination-example.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_pagination_example | strip }}{% endhighlight %}

## Simple Take and Skip


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/pagination/block-1.ts %}{% endhighlight %}


## Pagination with Filtering

Paginate filtered results:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/pagination/block-2.ts %}{% endhighlight %}


## Pagination with Sorting

Paginate sorted results:


{% highlight ts linenos %}{% include code/from-docs/concepts/queries/pagination/block-3.ts %}{% endhighlight %}


## Related

- [Filtering Data](/concepts/queries/filtering/)
- [Sorting Results](/concepts/queries/sorting/)
- [Terminal Methods](/concepts/queries/terminal-methods/)
