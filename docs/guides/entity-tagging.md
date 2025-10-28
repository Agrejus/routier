---
title: Entity Tagging
layout: default
parent: Guides
nav_order: 7
---

## Entity Tagging

Entity tagging attaches one or more tags to a write operation (insert/update/delete). Tags are propagated to the storage plugin so it can attribute the write (e.g., who performed it, which subsystem triggered it, correlation IDs).

## Quick Navigation

- [What and Why](#what-and-why)
- [Common Uses](#common-uses)
- [Basic Usage](#basic-usage)
- [Notes](#notes)
- [React Example](#react-example)

## What and why

Entity tagging attaches one or more tags to a write operation (insert/update/delete). Tags are propagated to the storage plugin so it can attribute the write (e.g., who performed it, which subsystem triggered it, correlation IDs).

## Common uses

- Track the actor or source of a change (UI click vs background job)
- Add correlation/trace IDs for observability
- Drive plugin behavior (e.g., audit logging, route-by-tag)

## Basic usage

You can tag a write by calling `tag(...)` on the collection before the write:

```ts
await ctx.users.tag("ui:clicked:add-user").addAsync({
  name: "James",
  email: "james.demeuse@gmail.com",
});
await ctx.saveChangesAsync();
```

Programmatic writes can use a different tag:

```ts
await ctx.users.tag("system:sync").addAsync({
  name: "Sync Bot",
  email: "sync@example.com",
});
await ctx.saveChangesAsync();
```

## Notes

- Tags are pushed down to the plugin. Your plugin can read the tags during the write transaction and decide how to persist/log/route the operation.
- Tagging does not change validation or schema behavior; it annotates the transaction with context.

## React Example

The example below shows tagging user-initiated vs programmatic inserts.

```tsx
import React from "react";
import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// 1) Define schema
const userSchema = s
  .define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
    createdAt: s.date().default(() => new Date()),
  })
  .compile();

// 2) Create a store (singleton for the app)
class AppContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("routier-docs"));
  }

  users = this.collection(userSchema).create();
}

export const ctx = new AppContext();

// 3) Component with two flows: UI and programmatic
export function UsersDemo() {
  const addFromUi = async () => {
    await ctx.users
      .tag("ui:clicked:add-user") // tag who/what triggered
      .addAsync({ name: "James", email: "james.demeuse@gmail.com" });
    await ctx.saveChangesAsync();
  };

  const addFromSystem = async () => {
    await ctx.users
      .tag("system:import") // programmatic / background tag
      .addAsync({ name: "Imported", email: "import@example.com" });
    await ctx.saveChangesAsync();
  };

  return (
    <div style={{ display: "flex", gap: 12 }}>
      <button onClick={addFromUi}>Add User (UI)</button>
      <button onClick={addFromSystem}>Add User (System)</button>
    </div>
  );
}
```

In your storage plugin, read the tags from the write transaction/context to record who performed the operation or to adjust persistence behavior.
