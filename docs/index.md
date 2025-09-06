---
layout: default
title: Home
nav_order: 1
---

# Routier - Documentation

Routier is a reactive data toolkit for building fast, local-first apps. It provides schemas, collections, live queries, and optimistic mutations with a plugin model for any storage.

## How it works

- Define schemas: type-safe entity definitions with indexes and modifiers
- Create collections: typed sets of entities backed by a plugin
- Use live queries: reactive queries across one or more collections
- Make optimistic mutations: instant UI updates with automatic rollback

```ts
import { DataStore } from "routier";
import { s } from "routier-core/schema";
import { MemoryPlugin } from "routier-plugin-memory";

const userSchema = s
  .define("users", {
    id: s.string().key().identity(),
    email: s.string().distinct(),
    name: s.string(),
    createdAt: s.date().default(() => new Date()),
  })
  .compile();

class Ctx extends DataStore {
  users = this.collection(userSchema).create();
  constructor() {
    super(new MemoryPlugin("app"));
  }
}

const ctx = new Ctx();
await ctx.users.addAsync({ name: "Ada", email: "ada@example.com" });
await ctx.saveChangesAsync();
```

## Getting Started

- Installation: /getting-started/installation
- Quick Start: /getting-started/quick-start
- React Adapter: /getting-started/react-adapter

## Concepts

- Schemas: /concepts/schema/
- Queries: /concepts/queries/
- Data Pipeline: /concepts/data-pipeline/

## Guides

- Live Queries: /guides/live-queries.md
- Optimistic Updates: /guides/optimistic-updates.md
- State Management: /guides/state-management.md
- Data Manipulation: /guides/data-manipulation.md
- History Tracking: /guides/history-tracking.md
- Syncing: /guides/syncing.md
- Entity Tagging: /guides/entity-tagging.md

## API

- API Landing: /api/
- Reference: /reference/api/

## Examples

- Basic: /examples/basic/
- Advanced: /examples/advanced/
- Performance: /examples/performance/
- Real-world: /examples/real-world/

More inspiration: TanStack DB Overview (structure and flow) — `https://tanstack.com/db/latest/docs/overview`
