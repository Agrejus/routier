# Getting Started with Routier

Welcome to Routier! This guide will help you get up and running with the framework quickly.

## What is Routier?

Routier is a modern, flexible data management framework designed for building scalable applications with:

- **Robust data handling** with schema validation
- **Change tracking** for undo/redo functionality
- **Real-time synchronization** across multiple data sources
- **Plugin architecture** for extensibility
- **React integration** for modern web applications

## Installation

```bash
npm install routier
npm install routier-plugin-memory
npm install routier-plugin-local-storage
```

## Basic Setup

```typescript
import { DataStore } from "routier";
import { s } from "routier-core/schema";
import { MemoryPlugin } from "routier-plugin-memory";

// Define a schema
const userSchema = s
  .define("user", {
    id: s.string().key().identity(),
    name: s.string().index(),
    email: s.string(),
    age: s.number().optional(),
    createdAt: s.date().default(() => new Date()),
  })
  .compile();

// Create a custom context class that extends DataStore
class AppContext extends DataStore {
  constructor() {
    super(new MemoryPlugin("my-app"));
  }

  // Create collections from schemas
  users = this.collection(userSchema).create();
}

// Use the context
const ctx = new AppContext();

// Add data to the collection
await ctx.users.addAsync({
  name: "John Doe",
  email: "john@example.com",
  age: 30,
});

// Save changes
await ctx.saveChangesAsync();
```

## Next Steps

- [Installation Guide](installation.md) - Detailed installation instructions
- [Basic Example](basic-example.md) - Complete working example
- [Configuration](configuration.md) - Configuration options

## Need Help?

- Check out our [examples](../examples/basic/README.md)
- Join our [community discussions](https://github.com/your-username/routier/discussions)
- Report issues on [GitHub](https://github.com/your-username/routier/issues)
