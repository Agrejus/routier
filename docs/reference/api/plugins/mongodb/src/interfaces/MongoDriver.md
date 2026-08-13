[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/mongodb/src](../README.md) / MongoDriver

# Interface: MongoDriver

Defined in: [plugins/mongodb/src/driver.ts:51](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mongodb/src/driver.ts#L51)

## Properties

### name

> `readonly` **name**: `string`

Defined in: [plugins/mongodb/src/driver.ts:53](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mongodb/src/driver.ts#L53)

Names the engine, for errors that would otherwise not say which one failed.

## Methods

### collection()

> **collection**(`name`): `Promise`\<[`MongoCollection`](MongoCollection.md)\>

Defined in: [plugins/mongodb/src/driver.ts:54](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mongodb/src/driver.ts#L54)

#### Parameters

##### name

`string`

#### Returns

`Promise`\<[`MongoCollection`](MongoCollection.md)\>

***

### transaction()

> **transaction**\<`T`\>(`work`): `Promise`\<`T`\>

Defined in: [plugins/mongodb/src/driver.ts:68](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mongodb/src/driver.ts#L68)

Runs `work` exactly once, atomically, and returns what it returned.

Exactly once is part of the contract, not an accident of the implementation. Mongo's
`withTransaction` helper retries on a transient error and on a commit conflict, and a
driver that used it would make this the only backend in the repository that silently
repeats a save — SQLite lets `SQLITE_BUSY` abort, and the same code has to fail the
same way everywhere. A driver retries nothing; a conflict reaches the caller.

A driver whose engine cannot offer atomicity — a standalone `mongod` rejects
transactions outright — may run `work` with an unbound scope, but it has to say so when
it is constructed rather than at the first save.

#### Type Parameters

##### T

`T`

#### Parameters

##### work

(`scope`) => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

***

### dropDatabase()

> **dropDatabase**(): `Promise`\<`void`\>

Defined in: [plugins/mongodb/src/driver.ts:70](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mongodb/src/driver.ts#L70)

Removes the database. Succeeds when it does not exist.

#### Returns

`Promise`\<`void`\>

***

### close()

> **close**(): `Promise`\<`void`\>

Defined in: [plugins/mongodb/src/driver.ts:71](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mongodb/src/driver.ts#L71)

#### Returns

`Promise`\<`void`\>
