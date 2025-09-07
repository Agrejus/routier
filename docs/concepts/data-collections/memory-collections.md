# Memory Collections

Memory collections provide fast, in-memory data storage for your Routier application.

## Overview

Memory collections are the fastest storage option in Routier, storing all data in RAM for instant access. They're perfect for:

- Development and testing
- Temporary data storage
- High-performance applications
- Offline-first applications with sync capabilities

## Creating Memory Collections


{% highlight ts linenos %}{% include code/from-docs/concepts/data-collections/memory-collections/block-1.ts %}{% endhighlight %}


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


{% highlight ts linenos %}{% include code/from-docs/concepts/data-collections/memory-collections/block-2.ts %}{% endhighlight %}


### High-Performance Applications


{% highlight ts linenos %}{% include code/from-docs/concepts/data-collections/memory-collections/block-3.ts %}{% endhighlight %}


### Offline-First with Sync


{% highlight ts linenos %}{% include code/from-docs/concepts/data-collections/memory-collections/block-4.ts %}{% endhighlight %}


## Next Steps

- [Change Tracking](change-tracking.md) - Understanding how changes are tracked
- [Entity Management](entity-management.md) - Managing entities in collections
- [Memory Plugin](../plugins/built-in-plugins/memory/README.md) - Detailed plugin documentation
