---
title: Local Storage Plugin
---

# Local Storage Plugin

Browser `localStorage`-backed plugin for simple persistence. Best for small datasets and quick prototypes.

## Installation

```bash
npm install @routier/browser-storage-plugin
```

## Basic Usage

<<< @/_snippets/code/from-docs/integrations/plugins/built-in-plugins/local-storage/README/block-1.ts

## Notes

- Synchronous API; storage limits (typically ~5–10MB).
- Consider Dexie or PouchDB for larger datasets.
