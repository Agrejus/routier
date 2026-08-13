---
title: Memory Collections
---

# Memory Collections

Memory collections provide fast, in-memory data storage for your Routier application.

## Overview

Memory collections are the fastest storage option in Routier, storing all data in RAM for instant access. They're perfect for:

- Development and testing
- Temporary data storage
- High-performance applications
- Offline-first applications with sync capabilities

## Creating Memory Collections


<<< @/_snippets/code/from-docs/index/block-1.ts

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


<<< @/_snippets/code/from-docs/index/block-1.ts

### High-Performance Applications


<<< @/_snippets/code/from-docs/index/block-1.ts

### Offline-First with Sync


<<< @/_snippets/code/from-docs/index/block-1.ts

## Next Steps

- [Change Tracking](/concepts/change-tracking) - Understanding how changes are tracked

- [Memory Plugin](/integrations/plugins/built-in-plugins/memory/README) - Detailed plugin documentation
