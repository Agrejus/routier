# Installation Guide

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Installation

### Core Package

```bash
npm install routier
```

### Plugins

```bash
# Memory plugin for in-memory storage
npm install routier-plugin-memory

# Local storage plugin for browser storage
npm install routier-plugin-local-storage

# File system plugin for Node.js
npm install routier-plugin-file-system

# PouchDB plugin for CouchDB integration
npm install routier-plugin-pouchdb

# Dexie plugin for IndexedDB
npm install routier-plugin-dexie

# SQLite plugin for SQLite databases
npm install routier-plugin-sqlite

# Testing plugin for test utilities
npm install routier-plugin-testing
```

## TypeScript Support

Routier is built with TypeScript and includes full type definitions. No additional `@types` packages are needed.

## Next Steps

- [Getting Started](getting-started.md) - Basic setup and configuration
- [Basic Example](basic-example.md) - Complete working example
- [Configuration](configuration.md) - Configuration options
