---
title: Getting Started
layout: default
nav_order: 1
has_children: true
permalink: /getting-started/
---

## Overview

Routier is a reactive data toolkit for building fast, local‑first apps. It gives you typed schemas, high‑level collections, live queries, and optimistic mutations, all backed by pluggable storage.

### How it works

- Define schemas (types, defaults, indexes, modifiers)
- Create collections from schemas (backed by a plugin)
- Read with live queries (reactive, incremental updates)
- Write with optimistic mutations (instant UI; rollback on error when implemented by the selected plugin)

### Why Routier

Choosing storage for local‑first apps is hard—and the landscape moves fast. Frameworks/ORMs and front‑end storage (e.g. OPFS + WASM) keep evolving, so the “right” choice today may not be right tomorrow. Routier separates your domain model from persistence through a small plugin interface:

- Swap storage backends without changing schemas, queries, or UI
- Use any framework/ORM/data store you want via plugins
- Experiment safely: to try a new store (e.g. OPFS + WASM), write a plugin and keep the rest of your app the same
- Fill ORM gaps: if your ORM lacks features, Routier is feature‑rich and easily extended (via plugins or collection modifiers)

See also: [Built‑in plugins]({{ site.baseurl }}/integrations/plugins/built-in-plugins/)

### Where to start

- Install the packages you need
- Set up a datastore with a plugin
- Follow the Quick Start for a working example

### What you get

- Typed schemas and safe mutations
- Reactive live queries across collections
- Optimistic state with automatic rollback
- Pluggable storage (Memory, Local Storage, Dexie, SQLite, PouchDB, …)

### Performance

Routier is designed to be blazing fast. It minimizes client‑side overhead so, in practice, most perceived latency comes from your chosen database/ORM. Query compilation, incremental change tracking, and memoized live updates keep reads and writes snappy.

- Learn more: [Performance Profiling]({{ site.baseurl }}/advanced-features/performance-profiling/) · [Benchmarks]({{ site.baseurl }}/demos/performance-benchmarks/)

### Next steps

- [Installation]({{ site.baseurl }}/getting-started/installation)
- [Quick Start]({{ site.baseurl }}/getting-started/quick-start)
- [React Adapter]({{ site.baseurl }}/getting-started/react-adapter)
- [Concepts]({{ site.baseurl }}/concepts/)
