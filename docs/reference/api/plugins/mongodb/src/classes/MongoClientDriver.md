[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/mongodb/src](../README.md) / MongoClientDriver

# Class: MongoClientDriver

Defined in: [plugins/mongodb/src/MongoClientDriver.ts:73](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/mongodb/src/MongoClientDriver.ts#L73)

## Implements

- [`MongoDriver`](../interfaces/MongoDriver.md)

## Constructors

### Constructor

> **new MongoClientDriver**(`client`, `databaseName?`, `options?`): `MongoClientDriver`

Defined in: [plugins/mongodb/src/MongoClientDriver.ts:81](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/mongodb/src/MongoClientDriver.ts#L81)

#### Parameters

##### client

[`MongoClientLike`](../type-aliases/MongoClientLike.md)

##### databaseName?

`string`

##### options?

[`MongoClientDriverOptions`](../type-aliases/MongoClientDriverOptions.md)

#### Returns

`MongoClientDriver`

## Properties

### name

> `readonly` **name**: `"mongodb"` = `"mongodb"`

Defined in: [plugins/mongodb/src/MongoClientDriver.ts:75](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/mongodb/src/MongoClientDriver.ts#L75)

Names the engine, for errors that would otherwise not say which one failed.

#### Implementation of

[`MongoDriver`](../interfaces/MongoDriver.md).[`name`](../interfaces/MongoDriver.md#name)

## Methods

### collection()

> **collection**(`name`): `Promise`\<[`MongoCollection`](../interfaces/MongoCollection.md)\>

Defined in: [plugins/mongodb/src/MongoClientDriver.ts:91](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/mongodb/src/MongoClientDriver.ts#L91)

#### Parameters

##### name

`string`

#### Returns

`Promise`\<[`MongoCollection`](../interfaces/MongoCollection.md)\>

#### Implementation of

[`MongoDriver`](../interfaces/MongoDriver.md).[`collection`](../interfaces/MongoDriver.md#collection)

***

### transaction()

> **transaction**\<`T`\>(`work`): `Promise`\<`T`\>

Defined in: [plugins/mongodb/src/MongoClientDriver.ts:95](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/mongodb/src/MongoClientDriver.ts#L95)

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

#### Implementation of

[`MongoDriver`](../interfaces/MongoDriver.md).[`transaction`](../interfaces/MongoDriver.md#transaction)

***

### dropDatabase()

> **dropDatabase**(): `Promise`\<`void`\>

Defined in: [plugins/mongodb/src/MongoClientDriver.ts:135](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/mongodb/src/MongoClientDriver.ts#L135)

Removes the database. Succeeds when it does not exist.

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`MongoDriver`](../interfaces/MongoDriver.md).[`dropDatabase`](../interfaces/MongoDriver.md#dropdatabase)

***

### close()

> **close**(): `Promise`\<`void`\>

Defined in: [plugins/mongodb/src/MongoClientDriver.ts:139](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/mongodb/src/MongoClientDriver.ts#L139)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`MongoDriver`](../interfaces/MongoDriver.md).[`close`](../interfaces/MongoDriver.md#close)
