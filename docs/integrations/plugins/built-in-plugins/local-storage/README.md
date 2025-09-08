---
title: Local Storage Plugin
layout: default
parent: Built-in Plugins
grand_parent: Integrations
nav_order: 3
---

# Local Storage Plugin

Browser `localStorage`-backed plugin for simple persistence. Best for small datasets and quick prototypes.

## Installation

```bash
npm install @routier/browser-storage-plugin
```

## Basic Usage

{% capture snippet_ls_basic %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_ls_basic | strip }}{% endhighlight %}

## Notes

- Synchronous API; storage limits (typically ~5–10MB).
- Consider Dexie or PouchDB for larger datasets.
