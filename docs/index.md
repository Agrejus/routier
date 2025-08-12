---
layout: default
title: Home
nav_order: 1
---

# Routier Framework

A modern, flexible data management framework for building scalable applications with robust data handling, change tracking, and real-time synchronization.

## 🚀 Quick Start

Get up and running with Routier in minutes:

```bash
npm install routier
npm install routier-plugin-memory
```

```typescript
import { DataStore } from "routier";
import { s } from "routier-core/schema";
import { MemoryPlugin } from "routier-plugin-memory";

// Define a schema
const userSchema = s
  .define("user", {
    _id: s.string().key().identity(),
    _rev: s.string().identity(),
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

[Get Started →](quick-start/getting-started.md)

## ✨ Key Features

- **Schema-driven data validation** with TypeScript support
- **Change tracking** for undo/redo functionality
- **Real-time synchronization** across multiple data sources
- **Plugin architecture** for extensibility
- **React integration** with hooks and components
- **High performance** with optimized data pipelines
- **Multiple storage backends** (Memory, LocalStorage, IndexedDB, SQLite, etc.)

## 🔌 Built-in Plugins

- **Memory Plugin** - In-memory data storage
- **Local Storage Plugin** - Browser localStorage/sessionStorage
- **File System Plugin** - Node.js file system storage
- **PouchDB Plugin** - CouchDB/PouchDB integration
- **Dexie Plugin** - IndexedDB wrapper
- **SQLite Plugin** - SQLite database support
- **Testing Plugin** - Test utilities and mocks

## 📚 Documentation

- [Core Concepts](core-concepts/) - Schema, collections, queries, and data pipeline
- [Plugins](plugins/) - Built-in plugins and creating custom ones
- [Data Operations](data-operations/) - CRUD, change tracking, and state management
- [React Integration](react-integration/) - Hooks, components, and performance
- [Advanced Features](advanced-features/) - Performance, validation, and error handling
- [Examples](examples/) - Code examples and real-world use cases

## 🎯 Use Cases

- **Web Applications** - React, Vue, Angular apps
- **Desktop Applications** - Electron apps with local storage
- **Mobile Applications** - React Native with local data
- **Backend Services** - Node.js data management
- **Real-time Applications** - Live data synchronization
- **Offline-first Apps** - Local data with sync capabilities

## 🤝 Community

- [GitHub Repository](https://github.com/your-username/routier)
- [Issues & Bug Reports](https://github.com/your-username/routier/issues)
- [Discussions](https://github.com/your-username/routier/discussions)
- [Contributing Guide](CONTRIBUTING.md)

## 📄 License

This project is licensed under the [LICENSE](LICENSE) file.
