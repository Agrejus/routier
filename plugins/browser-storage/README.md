# @routier/browser-storage-plugin

<p align="center">
  <img src="https://routier.dev/routier.svg" alt="Routier" width="140" height="140" />
</p>

Routier storage backed by a DOM `Storage` object — `localStorage`, `sessionStorage`, or any
object that implements the same interface.

```ts
import { DataStore } from "@routier/datastore";
import { BrowserStoragePlugin } from "@routier/browser-storage-plugin";

class AppStore extends DataStore {
  constructor() {
    super(new BrowserStoragePlugin("my-database", localStorage));
  }
}
```

The plugin takes the `Storage` object as an argument instead of reading a global. Pass
`sessionStorage` for per-tab data, or a fake implementation in tests.

## Contracts

### Durability

`localStorage` survives a page reload and a browser restart. `sessionStorage` survives a
reload and ends with the tab. The browser can evict either one under storage pressure.

Each collection is one storage key, named `<database>__<collection>`. A save serializes the
whole collection into that key.

### Tab boundary — single writer

**Concurrent writers across tabs are not supported.** Two tabs that write one database are
independent read-modify-write owners of the same key, and the last save wins the whole
collection. The plugin does not detect the conflict.

After the first read, the in-memory view is authoritative and storage is write-only. Rows
another tab writes are never observed by this one.

If you need several tabs to write, elect one writer — a `SharedWorker`, a leader-election
lock, or a `BroadcastChannel` protocol you own — and route every write through it.

### Concurrency within one tab

Safe. One collection instance per (Storage object, database name, collection name) is shared
process-wide, so every writer in the tab mutates the same view and each save is a superset of
the last.

### Quota

`localStorage` gives about 5 MB per origin, shared with everything else on that origin. The
plugin stores compact JSON, not pretty-printed. A quota overflow fails the save with the
browser's `QuotaExceededError`; nothing is written and the previous value stays.

`Storage` is synchronous, so a large collection blocks the main thread on every save. Use
`@routier/dexie-plugin` for datasets above a few thousand rows.

### Schema migration

None. The plugin stores whole entities as JSON. A schema change that renames or removes a
property does not rewrite what is already stored, so read old values and write them back
yourself if you need them converted.

### Corrupt values

If a storage key does not hold valid JSON, every read of that collection fails with an error
that names the key. **The plugin never discards a value it cannot parse.** Resetting to empty
would turn unreadable data into deleted data.

To recover, inspect the key and remove it. The next read then starts from an empty collection.

An empty-string value is a valid empty collection, not corruption.

### Disposal

Call `store.destroyAsync()` to remove this database's keys. The plugin holds no handles or
timers, so a store that is never destroyed leaks nothing.

### Failure semantics

A failed save leaves the stored value unchanged. The plugin reports the browser's error —
quota, a security exception in a blocked third-party context, or a value that cannot be
serialized.

## Supported versions

Any browser with `Storage`. Node 18 or later with a `Storage` implementation supplied by the
caller.

## See also

- [Local storage plugin guide](https://routier.dev/integrations/plugins/built-in-plugins/local-storage/README)
