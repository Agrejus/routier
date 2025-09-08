---
title: SQLite Plugin
layout: default
parent: Built-in Plugins
grand_parent: Integrations
nav_order: 6
---

# SQLite Plugin

SQLite-backed storage for Node/Electron environments.

## Installation

```bash
npm install @routier/sqlite-plugin sqlite3
```

## Basic Usage

{% capture snippet_sqlite_basic %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_sqlite_basic | strip }}{% endhighlight %}

## Notes

- Good when you need SQL and strong persistence locally.
