---
layout: home

hero:
  name: Routier
  text: Reactive data for any datastore
  tagline: A fast, front-end-first data toolkit — schemas, live queries, optimistic mutations, and swappable storage plugins. No lock-in, no rewrite.
  image:
    src: /routier.svg
    alt: Routier
  actions:
    - theme: brand
      text: Quick Start
      link: /getting-started/quick-start
    - theme: alt
      text: Why Routier?
      link: /getting-started/why-routier
    - theme: alt
      text: Try it in CodeSandbox
      link: https://codesandbox.io/p/devbox/routier-4nlxsx

features:
  - icon: 📐
    title: Powerful Schemas
    details: Defaults, identity keys, indexes, computed properties, transforms, and property mapping—bring your own validation with Zod or AJV.
    link: /concepts/schema/
    linkText: Schema guide
  - icon: 🔌
    title: Storage and Capability Plugins
    details: Choose memory, IndexedDB, SQLite, PostgreSQL, MySQL, MongoDB, PouchDB, or files—then add caching, replication, concurrency, encryption, and blob storage.
    link: /integrations/plugins/built-in-plugins/
    linkText: Choose plugins
  - icon: 🔗
    title: Joins and Rich Queries
    details: Inner and left joins across collections, views, stores, and plugins—plus filtering, aggregation, reusable queries, full-text search, and vector similarity.
    link: /concepts/queries/
    linkText: Explore queries
  - icon: 🔄
    title: Live Queries
    details: Subscriptions push updates when data changes. Zero-config reactivity for real-time UIs with built-in change detection.
    link: /guides/live-queries
    linkText: Live queries guide
  - icon: 🌐
    title: Local-First Ready
    details: Optimistic writes, history tracking, entity tagging, and sync patterns for apps that work offline and reconcile later.
    link: /guides/local-first-apps
    linkText: Local-first guide
  - icon: ⚛️
    title: React Integration
    details: First-class hooks that keep components in sync with your data—no extra state-management layer required.
    link: /integrations/react/
    linkText: React adapter
  - icon: ⚡
    title: Less Work Per Row
    details: Key lookups skip the scan. Filters run before copies. Routier generates copy functions from schemas instead of calling structuredClone.
    link: /concepts/performance
    linkText: Performance
---

## What is Routier?

Routier is a fast, front-end-first data toolkit that augments any datastore with
schemas, collections, live queries, optimistic mutations, replication, caching,
and more — without locking you into a specific ORM or backend.

Modern apps inevitably build a data abstraction layer: defaults, business rules,
computed fields, and adapters for whatever datastore you start with. That works —
until you hit performance ceilings, need local-first, or want to adopt a
different storage primitive. Routier gives you a datastore-agnostic layer you
control: keep your domain model and data API intact, and swap the storage plugin
beneath it.

## Quick Example

::: tip Try it live
[Open the CodeSandbox demo](https://codesandbox.io/p/devbox/routier-4nlxsx) to see this code running interactively.
:::

<<< @/_snippets/code/from-docs/index/block-1.ts

## How Routier Fits Your Stack

- **Enhance, don't replace** — keep your existing datastore. Add structure (schemas, defaults, serialization), speed (indexes, caching), and better ergonomics (live queries, optimistic updates).
- **Swap without rewrites** — move from IndexedDB to SQLite or adopt OPFS by changing the plugin. Your app code remains unchanged.
- **Type checking by choice** — use Zod or AJV for validation. Routier handles transformation and persistence.
- **Client-first, backend-capable** — designed for the browser and local-first workflows, adaptable to backend runtimes.

## Next Steps

| I want to…                     | Start here                                                        |
| ------------------------------ | ----------------------------------------------------------------- |
| Install and build my first app | [Installation](/getting-started/installation) → [Quick Start](/getting-started/quick-start) |
| Decide whether Routier fits    | [Why Routier?](/getting-started/why-routier)                     |
| Understand the core ideas      | [Concepts](/concepts/)                                            |
| Use Routier with React         | [React Integration](/integrations/react/)                         |
| Explore real patterns          | [Guides](/guides/)                                                |
