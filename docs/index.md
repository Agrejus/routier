---
layout: default
title: Home
nav_order: 1
---

# Overview

<p align="center">
  <img src="{{ site.baseurl }}/assets/routier.svg" alt="Routier" width="140" height="140" />
</p>

Routier is a reactive data toolkit for building fast, local-first apps. It provides schemas, collections, live queries, and optimistic mutations with a plugin model for any storage.

## How it works

- Define schemas: type-safe entity definitions with indexes and modifiers
- Create collections: typed sets of entities backed by a plugin
- Use live queries: reactive queries across one or more collections
- Make optimistic mutations: instant UI updates with automatic rollback

{% highlight ts linenos %}{% include code/from-docs/index/block-1.ts %}{% endhighlight %}

## Getting Started

- [Installation]({{ site.baseurl }}/getting-started/installation)
- [Quick Start]({{ site.baseurl }}/getting-started/quick-start)
- [React Adapter]({{ site.baseurl }}/getting-started/react-adapter)

## Concepts

- [Schemas]({{ site.baseurl }}/concepts/schema/)
- [Queries]({{ site.baseurl }}/concepts/queries/)
- [Data Pipeline]({{ site.baseurl }}/concepts/data-pipeline/)

## Guides

- [Live Queries]({{ site.baseurl }}/guides/live-queries.html)
- [Optimistic Updates]({{ site.baseurl }}/guides/optimistic-updates.html)
- [State Management]({{ site.baseurl }}/guides/state-management.html)
- [Data Manipulation]({{ site.baseurl }}/guides/data-manipulation.html)
- [History Tracking]({{ site.baseurl }}/guides/history-tracking.html)
- [Syncing]({{ site.baseurl }}/guides/syncing.html)
- [Entity Tagging]({{ site.baseurl }}/guides/entity-tagging.html)

## API

- [API Landing]({{ site.baseurl }}/api/)
- [Reference]({{ site.baseurl }}/reference/api/)

## Examples

- [Basic]({{ site.baseurl }}/examples/basic/)
- [Advanced]({{ site.baseurl }}/examples/advanced/)
- [Performance]({{ site.baseurl }}/examples/performance/)
- [Real-world]({{ site.baseurl }}/examples/real-world/)
