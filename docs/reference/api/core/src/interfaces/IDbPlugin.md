[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / IDbPlugin

# Interface: IDbPlugin

Defined in: [core/src/plugins/types.ts:11](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L11)

Interface for a database plugin, which provides query, destroy, and bulk operations.

## Properties

### databaseName

> `readonly` **databaseName**: `string`

Defined in: [core/src/plugins/types.ts:33](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L33)

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

## Methods

### query()

> **query**\<`TRoot`, `TShape`\>(`event`, `done`): `void`

Defined in: [core/src/plugins/types.ts:39](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L39)

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

[`PluginEventCallbackResult`](../type-aliases/PluginEventCallbackResult.md)\<[`ITranslatedValue`](ITranslatedValue.md)\<`TShape`\>\>

Callback with the result or error.

#### Returns

`void`

***

### destroy()

> **destroy**(`event`, `done`): `void`

Defined in: [core/src/plugins/types.ts:44](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L44)

Destroys or cleans up the plugin, closing connections or freeing resources.

#### Parameters

##### event

[`DbPluginEvent`](../type-aliases/DbPluginEvent.md)

##### done

[`PluginEventCallbackResult`](../type-aliases/PluginEventCallbackResult.md)\<`never`\>

Callback with an optional error.

#### Returns

`void`

***

### bulkPersist()

> **bulkPersist**(`event`, `done`): `void`

Defined in: [core/src/plugins/types.ts:50](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L50)

Executes bulk operations (add, update, remove) on the database.

#### Parameters

##### event

[`DbPluginBulkPersistEvent`](../type-aliases/DbPluginBulkPersistEvent.md)

The bulk operations event containing schema, parent, and changes.

##### done

[`PluginEventCallbackPartialResult`](../type-aliases/PluginEventCallbackPartialResult.md)\<[`BulkPersistResult`](../classes/BulkPersistResult.md)\>

Callback with the result or error.

#### Returns

`void`
