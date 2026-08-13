[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/mongodb/src](../README.md) / MongoUpdate

# Type Alias: MongoUpdate

> **MongoUpdate** = `object`

Defined in: [plugins/mongodb/src/driver.ts:21](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mongodb/src/driver.ts#L21)

One update, already resolved to the document it targets.

## Properties

### filter

> `readonly` **filter**: [`MqlFilter`](MqlFilter.md)

Defined in: [plugins/mongodb/src/driver.ts:27](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mongodb/src/driver.ts#L27)

Selects the document, and for a schema with a concurrency token also carries the
expected value. A filter that matches nothing is how a lost race is detected — the
plugin turns it into an OptimisticConcurrencyError.

***

### set

> `readonly` **set**: `Record`\<`string`, `unknown`\>

Defined in: [plugins/mongodb/src/driver.ts:29](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mongodb/src/driver.ts#L29)

The `$set` payload: what changed, in document terms.
