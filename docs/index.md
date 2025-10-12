---
layout: default
title: Home
nav_order: 1
---

# Overview

<p align="center">
  <img src="{{ site.baseurl }}/assets/routier.svg" alt="Routier" width="140" height="140" />
</p>

## What is Routier?

Routier is a fast, front-end–first data toolkit that augments any datastore with
schemas, collections, live queries, optimistic mutations, replication, caching,
and more—without locking you into a specific ORM or backend. It’s designed to be
extremely thin and fast, staying close to “bare‑metal” JavaScript by avoiding
promises/async-await in core hot paths.

### Why Routier

Modern apps inevitably build a data abstraction layer: defaults, business rules,
computed fields, and adapters for whatever ORM or datastore you start with. That
works—until you need to change. You hit performance ceilings, need local-first,
or want to adopt a different storage primitive (e.g., SQLite/PG‑Lite, IndexedDB,
OPFS). Rewriting your data layer every time is costly and risky.

Routier solves this by providing a thin, fast, datastore‑agnostic layer you
control. Keep your domain model and data API intact; swap the storage plugin
beneath it. Get the same developer experience and app behavior, regardless of
which frontend datastore you're running today, or migrate to tomorrow.

## Quick Example

Here's how Routier works in practice:

{% capture snippet_qcxtd6 %}{% include code/from-docs/index/block-1.ts %}{% endcapture %}

```ts
{
  {
    snippet_qcxtd6;
  }
}
```

### Target Platform

While Routier works on both frontend and backend, it’s primarily designed for
client-side applications and modern browser storage technologies:

- IndexedDB
- Local Storage
- SQLite
- Origin Private File System (OPFS)

## Philosophy

- Toolkit, not an ORM: Routier augments any datastore. It doesn’t bake in
  validation or force a query language; bring your own validation if needed (Zod, AJV).
- Front-end first: Tuned for client runtimes and local-first patterns; also
  works on the backend if needed.
- Thin and fast by design: Internally avoids promises/async-await in hot paths,
  opting for minimal abstractions and callbacks to reduce overhead.
- Portable by plugins: Storage-specific behavior is encapsulated in plugins.
  Swap plugins to move between stores without rewriting app code.

## Core Features

### Schemas: Transformation and Structure (bring your own validation)

Routier schemas focus on structure, transformation, and behavior. Validation is
intentionally left to libraries like Zod or AJV.

- Defaults
  - Static or functional defaults for create/update (e.g., timestamps, status).
- Distinct (uniqueness)
  - Enforce unique fields even if your store lacks native support.
- Property Remapping
  - Map awkward source names (e.g., `__id`) to clean domain names via `.from()`.
- Identity
  - Let Routier generate IDs or declare that your database issues them.
- Indexes
  - Single or composite indexes for faster lookups and views.
- Nullability and Optionality
  - Encode presence semantics explicitly; support read-only fields as well.
- Serialization Hooks
  - Per-field `serialize`/`deserialize` to translate store formats (e.g., dates).
- Computed Properties
  - Derive fields before save or on read (e.g., `fullName`, `age`).
- Methods on Records
  - Attach functions like `getAge()` or `getFullName()` to returned objects.
    These are stripped before persistence and never serialized.

### Collections, Live Queries, and Mutations

- Collections
  - Typed entity sets backed by any storage plugin.
- Live Queries
  - Reactive queries that update automatically when underlying data changes.
- Optimistic Mutations
  - Instant UI updates with automatic rollback on failure.

### Views, Replication, and Caching

- Views
  - Create views even if your datastore doesn’t support them natively.
- Replication
  - Synchronize between stores (e.g., local-first → remote) with control over
    direction and conflicts.
- Caching
  - Smart caching and predictable invalidation for fast read paths.

### Plugin Architecture

- Universal Compatibility
  - Works with any storage backend through plugins.
- Easy Migration
  - Swap storage solutions without changing your domain layer or app code.
- Extensible
  - Create custom plugins for specialized use cases.

## Performance Philosophy

Routier is built for maximum performance. In the core architecture, we
intentionally avoided promises and async/await to reduce microtask scheduling
and hidden chains in hot paths. The result: a thin, fast layer that stays out of
your way while providing powerful data behavior.

## How Routier Fits Your Stack

- Enhance, don’t replace
  - Keep your existing datastore. Routier adds structure (schemas, defaults,
    serialization), speed (indexes, caching), and ergonomics (live queries,
    optimistic updates).
- Swap without rewrites
  - Move from IndexedDB to SQLite or adopt OPFS by changing the
    plugin; preserve your domain model and app code.
- Validation by choice
  - Use Zod or AJV for input/output validation; Routier handles transformation
    and persistence concerns.
- Client-first, backend-capable
  - Designed for the browser and local-first, adaptable to backend runtimes.

## Typical Workflow

1. Define collections and schemas
   - Describe fields, defaults, identity, indexes, and per-field serializers.
   - Add computed fields and instance methods for richer domain objects.
2. Choose a storage plugin
   - IndexedDB, Local Storage, SQLite/PG‑Lite, OPFS, or your custom adapter.
3. Read and observe
   - Use live queries to reflect changes immediately in your UI and state.
4. Write with confidence
   - Perform optimistic mutations; rely on indexes and caching for speed.
5. Replicate and evolve
   - Synchronize local-first data with remote sources—without changing your
     domain model.

## How it works

- Define schemas: type-safe entity definitions with indexes and modifiers
- Create collections: typed sets of entities backed by a plugin
- Use live queries: reactive queries across one or more collections
- Make optimistic mutations: instant UI updates with automatic rollback

## Getting Started

- [Installation]({{ site.baseurl }}/getting-started/installation)
- [Quick Start]({{ site.baseurl }}/getting-started/quick-start)
- [React Adapter]({{ site.baseurl }}/getting-started/react-adapter)

## Concepts

- [Schemas]({{ site.baseurl }}/concepts/schema/)
- [Queries]({{ site.baseurl }}/concepts/queries/)
- [Data Pipeline]({{ site.baseurl }}/concepts/data-pipeline/)

## Guides

- [Live Queries]({{ site.baseurl }}/guides/live-queries.html)
- [Optimistic Updates]({{ site.baseurl }}/guides/optimistic-updates.html)
- [State Management]({{ site.baseurl }}/guides/state-management.html)
- [Data Manipulation]({{ site.baseurl }}/guides/data-manipulation.html)
- [History Tracking]({{ site.baseurl }}/guides/history-tracking.html)
- [Syncing]({{ site.baseurl }}/guides/syncing.html)
- [Entity Tagging]({{ site.baseurl }}/guides/entity-tagging.html)

## API

- [API Landing]({{ site.baseurl }}/api/)
- [Reference]({{ site.baseurl }}/reference/api/)

## Examples

- [Basic]({{ site.baseurl }}/examples/basic/)
- [Advanced]({{ site.baseurl }}/examples/advanced/)
- [Performance]({{ site.baseurl }}/examples/performance/)
- [Real-world]({{ site.baseurl }}/examples/real-world/)
