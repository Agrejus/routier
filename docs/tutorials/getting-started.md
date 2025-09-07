---
title: Getting Started with Routier
layout: default
parent: Tutorials
nav_order: 1
permalink: /tutorials/getting-started
---

# Getting Started with Routier

Welcome to Routier! This guide will help you get up and running with the framework quickly.

## What is Routier?

Routier is a modern, flexible data management framework designed for building scalable applications with:

- **Robust data handling** with schema validation
- **Change tracking** for undo/redo functionality
- **Real-time synchronization** across multiple data sources
- **Plugin architecture** for extensibility
- **React integration** for modern web applications

## Installation

```bash
npm install routier
npm install routier-plugin-memory
npm install routier-plugin-local-storage
```

## Basic Setup

{% capture snippet_y1mh9l %}{% include code/from-docs/tutorials/getting-started/block-2.ts %}{% endcapture %}
{% highlight ts linenos %}{{ snippet_y1mh9l }}{% endhighlight %}

## Next Steps

- [Installation Guide](installation.md) - Detailed installation instructions
- [Basic Example](basic-example.md) - Complete working example
- [Configuration](configuration.md) - Configuration options

## Need Help?

- Check out our [examples](../examples/basic/README.md)
- Join our [community discussions](https://github.com/your-username/routier/discussions)
- Report issues on [GitHub](https://github.com/your-username/routier/issues)
