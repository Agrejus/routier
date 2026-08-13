---
title: Browser Storage Plugin
---

# Browser Storage Plugin

`BrowserStoragePlugin` uses an injected DOM `Storage` object. Pass `localStorage` for durable browser storage, `sessionStorage` for per-tab data, or a compatible fake in tests.

## Installation

```bash
npm install @routier/browser-storage-plugin
```

## Basic Usage

<<< @/_snippets/code/from-docs/integrations/plugins/built-in-plugins/local-storage/README/block-1.ts

## Constructor

```ts
new BrowserStoragePlugin("app", localStorage)
new BrowserStoragePlugin("preview", sessionStorage)
```

## Notes

- Each logical collection is stored as one key and rewritten as a whole.
- Storage is synchronous and typically limited to about 5 MB per origin.
- Concurrent writers across tabs are not supported; the last whole-collection write wins.
- Use Dexie for larger data or multiple browser writers.
