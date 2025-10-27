---
title: Dexie Plugin
layout: default
parent: Built-in Plugins
grand_parent: Integrations
nav_order: 2
---

# Dexie Plugin

The Dexie Plugin stores data in IndexedDB via Dexie. Ideal for web apps needing persistent, performant client-side storage.

## Installation

```bash
npm install @routier/dexie-plugin dexie
```

## Basic Usage

{% capture snippet_dexie_basic %}{% include code/from-docs/integrations/plugins/built-in-plugins/dexie/README/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_dexie_basic | strip }}{% endhighlight %}

## Notes

- Runs in browsers (and Electron) using IndexedDB.
- Use for persistent storage with good performance and large capacity.
