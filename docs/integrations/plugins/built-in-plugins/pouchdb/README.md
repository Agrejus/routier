---
title: PouchDB Plugin
layout: default
parent: Built-in Plugins
grand_parent: Integrations
nav_order: 5
---

# PouchDB Plugin

Client-side database with optional CouchDB sync. Great for offline-first apps.

## Installation

```bash
npm install @routier/pouchdb-plugin pouchdb
```

## Basic Usage

{% capture snippet_pouch_basic %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_pouch_basic | strip }}{% endhighlight %}

## Notes

- Pair with CouchDB for two-way sync.
- See Syncing guide for setup.
- When storing multiple entity types in one database, scope each collection to a discriminator. See: [Scope a collection (single physical store)]({{ site.baseurl }}/how-to/collections/scope-single-store/).
