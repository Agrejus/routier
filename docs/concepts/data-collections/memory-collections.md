# Memory Collections

Memory collections provide fast, in-memory data storage for your Routier application.

## Overview

Memory collections are the fastest storage option in Routier, storing all data in RAM for instant access. They're perfect for:

- Development and testing
- Temporary data storage
- High-performance applications
- Offline-first applications with sync capabilities

## Creating Memory Collections



{% capture snippet_mc_1 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_mc_1 | escape }}
```


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



{% capture snippet_mc_2 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_mc_2 | escape }}
```


### High-Performance Applications



{% capture snippet_mc_3 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_mc_3 | escape }}
```


### Offline-First with Sync



{% capture snippet_mc_4 %}{% include code/%}{% endcapture %}

```ts
{{ snippet_mc_4 | escape }}
```


## Next Steps

- [Change Tracking](change-tracking.md) - Understanding how changes are tracked
- [Entity Management](entity-management.md) - Managing entities in collections
- [Memory Plugin](../plugins/built-in-plugins/memory/README.md) - Detailed plugin documentation
