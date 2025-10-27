---
title: File System Plugin
layout: default
parent: Built-in Plugins
grand_parent: Integrations
nav_order: 4
---

# File System Plugin

Node.js file-system backed storage for server-side or tooling use.

## Installation

```bash
npm install @routier/file-system-plugin
```

## Basic Usage

{% capture snippet_fs_basic %}{% include code/from-docs/integrations/plugins/built-in-plugins/file-system/README/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_fs_basic | strip }}{% endhighlight %}

## Notes

- Persists to disk; good for CLIs or server processes.
- For SQLite support with SQL, see the SQLite plugin.
