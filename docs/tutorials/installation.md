---
title: Installation Guide
layout: default
parent: Tutorials
nav_order: 3
---

# Installation Guide

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Installation

### Core Package

```bash
npm install @routier/core @routier/datastore
```

### Plugins

```bash
# Memory plugin for in-memory storage
npm install @routier/memory-plugin

# Local storage plugin for browser storage
npm install @routier/browser-storage-plugin

# File system plugin for Node.js
npm install @routier/file-system-plugin

# PouchDB plugin for CouchDB integration
npm install @routier/pouchdb-plugin

# Dexie plugin for IndexedDB
npm install @routier/dexie-plugin

# SQLite plugin for SQLite databases
npm install @routier/sqlite-plugin

# (Optional) Use Memory plugin for testing/mocks
# No dedicated testing plugin is required
```

## TypeScript Support

Routier is built with TypeScript and includes full type definitions. No additional `@types` packages are needed.

## Next Steps

- [Getting Started](getting-started.md) - Basic setup and configuration
- [Basic Example](basic-example.md) - Complete working example
- [Configuration](configuration.md) - Configuration options
