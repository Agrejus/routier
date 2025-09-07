---
title: Quick Start
layout: default
parent: Getting Started
nav_order: 3
---

## Quick Start

Spin up a minimal project and see live queries and optimistic updates in action.

### Quick setup (Memory plugin)

```ts
import { DataStore } from "@routier/datastore";
import { MemoryPlugin } from "@routier/memory-plugin";
import { s } from "@routier/core/schema";

// Define a schema
const userSchema = s
  .define("users", {
    id: s.string().key().identity(),
    name: s.string(),
    email: s.string().distinct(),
  })
  .compile();

// Create a context (datastore) using the plugin
class AppContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("routier-app"));
  }
  users = this.collection(userSchema).create();
}

const ctx = new AppContext();
await ctx.users.addAsync({ name: "Ada", email: "ada@example.com" });
await ctx.saveChangesAsync();
```

See step-by-step: {{ site.baseurl }}/tutorials/getting-started
