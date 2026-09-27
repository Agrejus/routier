---
title: React Native
description: "Use Routier in React Native: the React hook, which storage plugin to use, and the polyfill Hermes may need."
---

# React Native

`@routier/react` works in React Native as it is. The questions are where the data is stored and whether the runtime has everything Routier uses.

## Installation

```bash
npm install @routier/react @routier/datastore @routier/core
```

Use `useQuery` exactly as the [React guide](/integrations/react/) describes.

## Polyfill `structuredClone` if it's missing

Routier uses `structuredClone` to copy array properties, to deliver live-query changes within the app when `BroadcastChannel` is not available, and in `CacheDbPlugin`. Hermes, React Native's default engine, may not provide it, depending on your React Native version. Check once:

```ts
console.log(typeof structuredClone); // "function" means you're set
```

If it prints `"undefined"`, install a polyfill such as `@ungap/structured-clone` and assign it before the store is created:

```ts
import structuredClone from "@ungap/structured-clone";

if (typeof globalThis.structuredClone !== "function") {
  globalThis.structuredClone = structuredClone;
}
```

`BroadcastChannel` isn't needed. Since `@routier/core` 0.8.1, live queries work without it: changes reach the same app directly. `crypto.randomUUID` isn't needed either; Routier falls back when it's missing.

## Choosing storage

There is no IndexedDB and no `localStorage` in React Native, and Routier doesn't ship a React Native storage driver. Pick one of these:

| Need | Plugin |
| --- | --- |
| Data that doesn't have to survive a restart, or data synced from a server on start | `MemoryPlugin` from `@routier/memory-plugin` |
| Persistence in a synchronous key-value store | `BrowserStoragePlugin` from `@routier/browser-storage-plugin`, with an adapter |
| Persistence in SQLite | `SqliteDbPlugin` from `@routier/sqlite-plugin`, with a driver for your SQLite library |
| Data owned by a server | `HttpDbPlugin` from `@routier/replication-plugin`, which only needs `fetch` |

### A synchronous key-value store

`BrowserStoragePlugin` takes a `Storage` object and only calls `getItem`, `setItem`, and `removeItem`, synchronously. A synchronous key-value library can back it through a small adapter that implements the rest of the `Storage` interface. An asynchronous store such as AsyncStorage can't, because the plugin reads synchronously.

### SQLite

`SqliteDbPlugin` talks to SQLite through a small driver interface: a `name`, a `foldsUnicodeCasing` flag, `open`, which returns a connection with `all`, `run`, and `close`, and `deleteDatabase`. Implement it over your React Native SQLite library and pass it as `new SqliteDbPlugin(name, { driver })`. See the [SQLite plugin](/integrations/plugins/built-in-plugins/sqlite/README) for the interface and the drivers that ship with it.
