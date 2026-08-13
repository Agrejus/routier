---
title: PouchDB Plugin
---

# PouchDB Plugin

Client-side database with optional CouchDB sync. Great for offline-first apps.

## Installation

```bash
npm install @routier/pouchdb-plugin pouchdb
```

## Basic Usage

<<< @/_snippets/code/from-docs/integrations/plugins/built-in-plugins/pouchdb/README/block-1.ts

## Notes

- Pair with CouchDB for two-way sync.
- See Syncing guide for setup.
- When storing multiple entity types in one database, scope each collection to a discriminator. See: [Scope a collection (single physical store)](/how-to/collections/scope-single-store).
