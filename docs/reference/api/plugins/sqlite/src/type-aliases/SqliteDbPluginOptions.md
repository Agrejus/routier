[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sqlite/src](../README.md) / SqliteDbPluginOptions

# Type Alias: SqliteDbPluginOptions

> **SqliteDbPluginOptions** = `object`

Defined in: [plugins/sqlite/src/plugin.ts:11](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sqlite/src/plugin.ts#L11)

## Properties

### driver?

> `optional` **driver**: [`SqliteDriver`](../interfaces/SqliteDriver.md)

Defined in: [plugins/sqlite/src/plugin.ts:20](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/sqlite/src/plugin.ts#L20)

The engine to run against.

Defaults to `node:sqlite` in Node and SQLite WASM over OPFS in a browser, chosen by the
`exports` conditions in this package's manifest. Pass one explicitly to override:
`sqlite3Driver()` for Node 18 and 20, or `wasmDriver({ storage: 'memory' })` for a
browser database that should not persist.
