# Memory Plugin

The Memory Plugin provides fast, in-memory data storage for your Routier application.

## Overview

The Memory Plugin is the fastest storage option in Routier, storing all data in RAM for instant access. It's perfect for development, testing, and high-performance applications.

## Installation

```bash
npm install routier-plugin-memory
```

## Basic Usage


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/built-in-plugins/memory/README/block-2.ts %}{% endhighlight %}


## Configuration

### Constructor Parameters


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/built-in-plugins/memory/README/block-3.ts %}{% endhighlight %}


### Database Name

The database name is used to namespace your data and should be unique within your application:


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/built-in-plugins/memory/README/block-4.ts %}{% endhighlight %}


## Performance Characteristics

### Advantages

- **Instant access** - No I/O delays
- **High throughput** - Can handle thousands of operations per second
- **Low latency** - Sub-millisecond response times
- **No serialization overhead** - Data stays in memory

### Limitations

- **Memory usage** - All data must fit in RAM
- **No persistence** - Data is lost when application restarts
- **No sharing** - Data is isolated to the current process

## Use Cases

### Development and Testing


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/built-in-plugins/memory/README/block-5.ts %}{% endhighlight %}


### High-Performance Applications


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/built-in-plugins/memory/README/block-6.ts %}{% endhighlight %}


### Offline-First with Sync


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/built-in-plugins/memory/README/block-7.ts %}{% endhighlight %}


## API Reference

### Constructor


{% highlight ts linenos %}{% include code/from-docs/integrations/plugins/built-in-plugins/memory/README/block-8.ts %}{% endhighlight %}


### Properties

- `databaseName` - The name of the database

### Methods

The Memory Plugin implements all standard plugin methods:

- `add()` - Add entities to collections
- `update()` - Update existing entities
- `remove()` - Remove entities
- `query()` - Query collections
- `destroy()` - Clean up resources

## Next Steps

- [Local Storage Plugin](../local-storage/README.md) - Browser storage plugin
- [File System Plugin](../file-system/README.md) - Node.js file storage
- [Plugin Architecture](../../create-your-own/plugin-architecture.md) - Creating custom plugins
