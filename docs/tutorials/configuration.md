---
title: Configuration
layout: default
parent: Getting Started
nav_order: 5
---

# Configuration

This guide covers the various configuration options available in Routier.

## Quick Navigation

- [Plugin Configuration](#plugin-configuration)
- [Advanced Configuration](#advanced-configuration)
- [Environment-Specific Configuration](#environment-specific-configuration)
- [Next Steps](#next-steps)

## Plugin Configuration

### Memory Plugin

{% capture snippet_imbwmu %}{% include code/from-docs/tutorials/configuration/block-1.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_imbwmu  | strip }}{% endhighlight %}

### Local Storage Plugin

{% capture snippet_8h6l29 %}{% include code/from-docs/tutorials/configuration/block-2.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_8h6l29  | strip }}{% endhighlight %}

### File System Plugin

{% capture snippet_jyjuyw %}{% include code/from-docs/tutorials/configuration/block-3.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_jyjuyw  | strip }}{% endhighlight %}

### PouchDB Plugin

{% capture snippet_f44scf %}{% include code/from-docs/tutorials/configuration/block-4.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_f44scf  | strip }}{% endhighlight %}

### Dexie Plugin

{% capture snippet_pzlbnl %}{% include code/from-docs/tutorials/configuration/block-5.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_pzlbnl  | strip }}{% endhighlight %}

## Advanced Configuration

### Plugin Composition

{% capture snippet_akaglm %}{% include code/from-docs/tutorials/configuration/block-6.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_akaglm  | strip }}{% endhighlight %}

### Custom Context Configuration

{% capture snippet_6q0ij4 %}{% include code/from-docs/tutorials/configuration/block-7.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_6q0ij4  | strip }}{% endhighlight %}

## Environment-Specific Configuration

### Development

{% capture snippet_8s640w %}{% include code/from-docs/tutorials/configuration/block-8.ts %}{% endcapture %}
{% highlight ts %}{{ snippet_8s640w  | strip }}{% endhighlight %}

### Testing

For tests, prefer the Memory plugin or mocks/stubs around persistence. The internal testing plugin is not part of the public distribution.

## Next Steps

- [Getting Started](getting-started.md) - Basic setup
- [Basic Example](basic-example.md) - Complete working example
- [Plugin Architecture](../plugins/create-your-own/plugin-architecture.md) - Creating custom plugins
