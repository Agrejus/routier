---
layout: default
title: Home
nav_order: 1
---

# Overview

<p align="center">
  <img src="{{ site.baseurl }}/assets/routier.svg" alt="Routier" width="140" height="140" />
</p>

Routier is a fast, front-end–first data toolkit that augments any datastore with
schemas, collections, live queries, optimistic mutations, replication, caching,
and more—without locking you into a specific ORM or backend. It's designed to be
extremely thin and fast, staying close to "bare‑metal" JavaScript by avoiding
promises/async-await in core hot paths.

### Why Routier

Modern apps inevitably build a data abstraction layer: defaults, business rules,
computed fields, and adapters for whatever ORM or datastore you start with. That
works—until you need to change. You hit performance ceilings, need local-first,
or want to adopt a different storage primitive (e.g., SQLite/PG‑Lite, IndexedDB,
OPFS). Rewriting your data layer every time is costly and risky.

Routier solves this by providing a feature-rich, fast, datastore‑agnostic layer you
control. Keep your domain model and data API intact; swap the storage plugin
beneath it. Get the same developer experience and app behavior, regardless of
which frontend datastore you're running today, or migrate to tomorrow.

## Quick Example

Here's how Routier works in practice:

{% capture snippet_qcxtd6 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

{% highlight ts %}{{ snippet_qcxtd6 | strip }}{% endhighlight %}

### Target Platform

While Routier works on both frontend and backend, it’s primarily designed for
client-side applications and modern browser storage technologies:

- IndexedDB
- Local Storage
- SQLite
- Origin Private File System (OPFS)

## Philosophy

Routier follows a simple, clear philosophy that guides every design decision.

**Toolkit, not an ORM**: Routier augments any datastore without forcing a particular approach. Bring your own validation (Zod, AJV) and keep full control of your data layer.

**Front-end first**: Optimized for client runtimes and local-first patterns, with performance tuned for the browser. Also works beautifully on the backend.

**Thin and fast by design**: Core hot paths avoid promises/async-await, using minimal abstractions and callbacks for maximum performance.

**Portable by plugins**: Storage-specific behavior lives in plugins. Swap between IndexedDB, SQLite, Local Storage, or any backend without changing your app code.

[Learn about our philosophy →]({{ site.baseurl }}/getting-started/)

## Core Features

Routier provides a comprehensive toolkit for managing data in modern applications.

### 📐 **Schemas**

Define your data structure with power and flexibility:

- **Defaults**: Automatic values for new records (timestamps, statuses)
- **Identity**: Auto-generated or database-managed primary keys
- **Indexes**: Fast lookups with single or composite indexes
- **Computed Properties**: Derived fields that update automatically
- **Serialization**: Transform data when saving or loading (e.g., dates)
- **Property Mapping**: Clean up awkward database field names
- **Methods**: Attach functions to entities (stripped before persistence)

Type checking is handled by libraries like Zod or AJV—Routier focuses on structure and transformation.

### 🔄 **Live Queries**

Reactive data that updates automatically:

- Subscriptions that push updates when data changes
- Zero-config reactivity for real-time UIs
- Built-in change detection and propagation

### ⚡ **Performance**

Optimized for speed:

- **Optimistic Replication**: Reads from memory, writes persist asynchronously
- **Smart Caching**: Predictable invalidation for fast reads
- **Database Views**: Create views even without native support

### 🔌 **Plugin Architecture**

Storage that adapts to your needs:

- **Any Backend**: Works with IndexedDB, SQLite, Local Storage, OPFS, and more
- **Easy Migration**: Swap storage without changing your code
- **Extensible**: Build custom plugins for specialized needs

## Performance Philosophy

Routier is built for maximum performance. We intentionally avoided promises and async/await in core hot paths to reduce microtask scheduling overhead. The result is a thin, fast layer that provides powerful data behavior without getting in your way.

Performance isn't just about speed—it's about predictable, consistent behavior that scales with your application. [See how it works →]({{ site.baseurl }}/getting-started/)

## How Routier Fits Your Stack

Routier enhances your existing setup rather than replacing it, giving you the benefits you need without the constraints you don't.

**Enhance, don't replace**: Keep your existing datastore. Add structure (schemas, defaults, serialization), speed (indexes, caching), and better ergonomics (live queries, optimistic updates).

**Swap without rewrites**: Move from IndexedDB to SQLite or adopt OPFS by changing the plugin. Your domain model and app code remain unchanged.

**Type checking by choice**: Use Zod or AJV for validation. Routier handles transformation and persistence concerns separately.

**Client-first, backend-capable**: Designed for the browser and local-first workflows, adaptable to backend runtimes as needed.

[Installation guide →]({{ site.baseurl }}/getting-started/installation) | [Configuration →]({{ site.baseurl }}/tutorials/configuration)

## Getting Started with Routier

Here's the typical workflow when building with Routier:

**1. Define schemas and collections**: Describe your data structure with fields, defaults, indexes, and computed properties. [Creating schemas →]({{ site.baseurl }}/concepts/schema/creating-a-schema)

**2. Choose a storage plugin**: Pick IndexedDB, Local Storage, SQLite, OPFS, or build your own. [Built-in plugins →]({{ site.baseurl }}/integrations/plugins/built-in-plugins/)

**3. Read with live queries**: Subscribe to data changes for reactive UIs that update automatically. [Live queries guide →]({{ site.baseurl }}/guides/live-queries)

**4. Write with confidence**: Use optimistic replication for fast writes. Changes tracked automatically until you save. [State management →]({{ site.baseurl }}/guides/state-management)

**5. Evolve and scale**: Sync data, add more collections, swap storage backends—all without changing your domain code.

[Quick start guide →]({{ site.baseurl }}/getting-started/quick-start)

## How It Works

Routier provides a simple, consistent API that works across all storage backends.

**Define schemas**: Type-safe entity definitions with indexes, computed properties, and modifiers. [Schema guide →]({{ site.baseurl }}/concepts/schema/)

**Create collections**: Typed entity sets backed by your chosen plugin. [Collections overview →]({{ site.baseurl }}/how-to/collections/)

**Query your data**: Filter, sort, aggregate, and paginate with a fluent query API. [Query guide →]({{ site.baseurl }}/concepts/queries/)

**Watch for changes**: Subscribe to live queries that update when data changes. [Live queries →]({{ site.baseurl }}/guides/live-queries)

## Next Steps

Ready to get started? Choose your path:

**[Installation]({{ site.baseurl }}/getting-started/installation)** - Install packages and dependencies  
**[Quick Start]({{ site.baseurl }}/getting-started/quick-start)** - Build your first app in minutes  
**[React Integration]({{ site.baseurl }}/integrations/react/)** - Use Routier with React  
**[View All Guides]({{ site.baseurl }}/guides/)** - Explore comprehensive guides
