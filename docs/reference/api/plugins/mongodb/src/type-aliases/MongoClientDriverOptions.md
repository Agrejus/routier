[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/mongodb/src](../README.md) / MongoClientDriverOptions

# Type Alias: MongoClientDriverOptions

> **MongoClientDriverOptions** = `object`

Defined in: [plugins/mongodb/src/MongoClientDriver.ts:54](https://github.com/Agrejus/routier/blob/main/plugins/mongodb/src/MongoClientDriver.ts#L54)

## Properties

### transactions

> `readonly` **transactions**: `"required"` \| `"unavailable"`

Defined in: [plugins/mongodb/src/MongoClientDriver.ts:71](https://github.com/Agrejus/routier/blob/main/plugins/mongodb/src/MongoClientDriver.ts#L71)

Whether this deployment can do transactions.

MongoDB transactions need a replica set. A standalone `mongod` — what most people run
locally — rejects them outright, so this cannot be assumed and must not be discovered
on the first multi-collection save.

- `"required"` opens a session and commits. A deployment that cannot support it fails
  the save with Mongo's own error, which names the cause.
- `"unavailable"` runs each save without a session. Writes are applied in order and
  reported, but a failure part way through leaves the earlier ones in place.

There is no `"auto"`. Detecting it would mean a store silently losing atomicity when
it moved from a replica set to a standalone, which is precisely the thing worth
knowing about.
