---
title: Memory Plugin
layout: default
parent: Built-in Plugins
grand_parent: Integrations
nav_order: 1
---

# Memory Plugin

The Memory Plugin provides fast, in-memory data storage for your Routier application.

## Overview

The Memory Plugin is the fastest storage option in Routier, storing all data in RAM for instant access. It's perfect for development, testing, and high-performance applications.

## Installation

```bash
npm install routier-plugin-memory
```

## Basic Usage

{% capture snippet_j93uk4 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_j93uk4 | escape;
  }
}
```

## Configuration

### Constructor Parameters

{% capture snippet_wmjaxi %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_wmjaxi | escape;
  }
}
```

### Database Name

The database name is used to namespace your data and should be unique within your application:

{% capture snippet_t0gugq %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_t0gugq | escape;
  }
}
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

{% capture snippet_bjnyoi %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_bjnyoi | escape;
  }
}
```

### High-Performance Applications

{% capture snippet_e67add %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_e67add | escape;
  }
}
```

### Offline-First with Sync

{% capture snippet_1e3k2w %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_1e3k2w | escape;
  }
}
```

## API Reference

### Constructor

{% capture snippet_41jr8p %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_41jr8p | escape;
  }
}
```

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
