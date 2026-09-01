---
title: Dexie Plugin
---

# Dexie Plugin

The Dexie Plugin stores data in IndexedDB via Dexie. Ideal for web apps needing persistent, performant client-side storage.

## Installation

```bash
npm install @routier/dexie-plugin dexie
```

## Basic Usage

<<< @/_snippets/code/from-docs/integrations/plugins/built-in-plugins/dexie/README/block-1.ts

## Indexes and query speed

A filter runs as a JavaScript predicate over a cursor walk unless part of it can use an
IndexedDB index. Declare `.index()` or `.distinct()` on every property you filter or sort by.
On such a property these shapes become an index seek:

- a strict equality: `x.status === p.status`
- an OR of strict equalities on one property: `x.status === p.a || x.status === p.b`
- one or two range bounds on one property: `x.amount >= p.lo && x.amount < p.hi`
- a strict equality on every member of a compound `.index("name")` group

A single `sort` on an indexed, non-nullable string, number, or Date property walks the index
in key order when no seek is in use, so `skip` and `take` stop the cursor early even with a
predicate in front. `count()` runs in IndexedDB when the query has no window or projection. Date values never seek, because rows
store dates as ISO strings. `.explain()` shows which path a query took.

Adding an index changes the IndexedDB layout. Pass a higher `version` to the plugin for a
database that already exists.

## Notes

- Runs in browsers (and Electron) using IndexedDB.
- Use for persistent storage with good performance and large capacity.
