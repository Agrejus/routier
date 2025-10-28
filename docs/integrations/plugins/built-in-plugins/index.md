---
title: Built-in Plugins
layout: default
parent: Integrations
has_children: true
nav_order: 1
permalink: /integrations/plugins/built-in-plugins/
---

## Built-in Plugins

Routier provides several built-in storage plugins to get you started quickly.

## Quick Navigation

- [Memory Plugin](memory/) - In-memory storage (no persistence)
- [Local Storage Plugin](local-storage/) - Browser local storage
- [File System Plugin](file-system/) - File system storage
- [Dexie DependencyWrapper](dexie/) - IndexedDB via Dexie
- [SQLite DependencyWrapper](sqlite/) - SQLite storage
- [PouchDB DependencyWrapper](pouchdb/) - PouchDB storage

## Overview

Each plugin provides storage capabilities for different environments:

- **Memory**: Fast in-memory storage for testing and prototyping
- **Local Storage**: Persistent browser storage
- **File System**: File-based storage for Node.js environments
- **Dexie**: IndexedDB wrapper with advanced querying
- **SQLite**: SQL database for desktop and server applications
- **PouchDB**: Sync-enabled NoSQL database

## Installation

Install the plugins you need:

```bash
npm install @routier/memory-plugin
npm install @routier/local-storage-plugin
npm install @routier/file-system-plugin
npm install @routier/dexie-plugin
npm install @routier/sqlite-plugin
npm install @routier/pouchdb-plugin
```

## Related

- [Create Your Own Plugin](../create-your-own/) - Build custom storage plugins
