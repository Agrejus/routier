[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / RetryDbPlugin

# Class: RetryDbPlugin

Defined in: [core/src/plugins/RetryDbPlugin.ts:66](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/RetryDbPlugin.ts#L66)

Interface for a database plugin, which provides query, destroy, and bulk operations.

## Implements

- [`IDbPlugin`](../interfaces/IDbPlugin.md)

## Constructors

### Constructor

> **new RetryDbPlugin**(`plugin`, `options`): `RetryDbPlugin`

Defined in: [core/src/plugins/RetryDbPlugin.ts:73](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/RetryDbPlugin.ts#L73)

#### Parameters

##### plugin

[`IDbPlugin`](../interfaces/IDbPlugin.md)

##### options

[`RetryDbPluginOptions`](../type-aliases/RetryDbPluginOptions.md) = `{}`

#### Returns

`RetryDbPlugin`

## Accessors

### databaseName

#### Get Signature

> **get** **databaseName**(): `string`

Defined in: [core/src/plugins/RetryDbPlugin.ts:82](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/RetryDbPlugin.ts#L82)

Uniquely identifies the database this plugin talks to, INCLUDING host or path where a
bare name would collide — `orders.db` in two directories is two databases, and `mydb`
on two hosts is two databases. Two instances over the same database must return the
same string, in this process and in any other; two over different databases must not.

Used to scope schema subscription channels, so instances of one database (another tab,
a worker) see each other's change notifications and unrelated databases holding the
same schema do not.

Required rather than optional on purpose. An absent value used to fall back to scoping
by schema alone, which shares one channel across every database holding that schema —
the exact cross-talk this prevents, arrived at by omission. Requiring it also makes a
wrapper that forgets to forward it a compile error rather than a silent regression.

Derive it, never generate it: a random value is unique per PROCESS, not per database,
so another tab would never match one and cross-context notifications would stop.

Must not contain credentials — it becomes part of a channel key, so build it from
host/port/database rather than returning a connection string.

##### Returns

`string`

Uniquely identifies the database this plugin talks to, INCLUDING host or path where a
bare name would collide — `orders.db` in two directories is two databases, and `mydb`
on two hosts is two databases. Two instances over the same database must return the
same string, in this process and in any other; two over different databases must not.

Used to scope schema subscription channels, so instances of one database (another tab,
a worker) see each other's change notifications and unrelated databases holding the
same schema do not.

Required rather than optional on purpose. An absent value used to fall back to scoping
by schema alone, which shares one channel across every database holding that schema —
the exact cross-talk this prevents, arrived at by omission. Requiring it also makes a
wrapper that forgets to forward it a compile error rather than a silent regression.

Derive it, never generate it: a random value is unique per PROCESS, not per database,
so another tab would never match one and cross-context notifications would stop.

Must not contain credentials — it becomes part of a channel key, so build it from
host/port/database rather than returning a connection string.

#### Implementation of

[`IDbPlugin`](../interfaces/IDbPlugin.md).[`databaseName`](../interfaces/IDbPlugin.md#databasename)

## Methods

### query()

> **query**\<`TRoot`, `TShape`\>(`event`, `done`): `void`

Defined in: [core/src/plugins/RetryDbPlugin.ts:86](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/RetryDbPlugin.ts#L86)

Executes a query operation on the database.

#### Type Parameters

##### TRoot

`TRoot` *extends* `object`

##### TShape

`TShape` *extends* `unknown` = `TRoot`

#### Parameters

##### event

[`DbPluginQueryEvent`](../type-aliases/DbPluginQueryEvent.md)\<`TRoot`, `TShape`\>

The query event containing schema, parent, and query operation.

##### done

[`PluginEventCallbackResult`](../type-aliases/PluginEventCallbackResult.md)\<[`ITranslatedValue`](../interfaces/ITranslatedValue.md)\<`TShape`\>\>

Callback with the result or error.

#### Returns

`void`

#### Implementation of

[`IDbPlugin`](../interfaces/IDbPlugin.md).[`query`](../interfaces/IDbPlugin.md#query)

***

### bulkPersist()

> **bulkPersist**(`event`, `done`): `void`

Defined in: [core/src/plugins/RetryDbPlugin.ts:131](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/RetryDbPlugin.ts#L131)

Executes bulk operations (add, update, remove) on the database.

#### Parameters

##### event

[`DbPluginBulkPersistEvent`](../type-aliases/DbPluginBulkPersistEvent.md)

The bulk operations event containing schema, parent, and changes.

##### done

[`PluginEventCallbackPartialResult`](../type-aliases/PluginEventCallbackPartialResult.md)\<[`BulkPersistResult`](BulkPersistResult.md)\>

Callback with the result or error.

#### Returns

`void`

#### Implementation of

[`IDbPlugin`](../interfaces/IDbPlugin.md).[`bulkPersist`](../interfaces/IDbPlugin.md#bulkpersist)

***

### destroy()

> **destroy**(`event`, `done`): `void`

Defined in: [core/src/plugins/RetryDbPlugin.ts:140](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/RetryDbPlugin.ts#L140)

Destroys or cleans up the plugin, closing connections or freeing resources.

#### Parameters

##### event

[`DbPluginEvent`](../type-aliases/DbPluginEvent.md)

##### done

[`PluginEventCallbackResult`](../type-aliases/PluginEventCallbackResult.md)\<`never`\>

Callback with an optional error.

#### Returns

`void`

#### Implementation of

[`IDbPlugin`](../interfaces/IDbPlugin.md).[`destroy`](../interfaces/IDbPlugin.md#destroy)
