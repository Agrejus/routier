---
title: Quick Start
layout: default
parent: Getting Started
nav_order: 3
---

## Quick Start

Spin up a minimal project and see live queries and optimistic updates in action.

## Quick Navigation

- [Quick Setup](#quick-setup-memory-plugin)
- [What's Next?](#whats-next)

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

## What's Next?

- **[Learn About Schemas]({{ site.baseurl }}/concepts/schema/)** - Define your data structure
- **[Explore Queries]({{ site.baseurl }}/concepts/queries/)** - Query and filter data
- **[Try Live Queries]({{ site.baseurl }}/guides/live-queries)** - Build reactive UIs
- **[Use with React]({{ site.baseurl }}/getting-started/react-adapter)** - React integration
