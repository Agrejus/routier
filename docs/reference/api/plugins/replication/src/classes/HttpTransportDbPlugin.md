[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/replication/src](../README.md) / HttpTransportDbPlugin

# Class: HttpTransportDbPlugin

Defined in: [plugins/replication/src/HttpTransportDbPlugin.ts:103](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/HttpTransportDbPlugin.ts#L103)

## Implements

- `IDbPlugin`

## Constructors

### Constructor

> **new HttpTransportDbPlugin**(`options`): `HttpTransportDbPlugin`

Defined in: [plugins/replication/src/HttpTransportDbPlugin.ts:110](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/HttpTransportDbPlugin.ts#L110)

#### Parameters

##### options

[`HttpTransportDbPluginOptions`](../type-aliases/HttpTransportDbPluginOptions.md)

#### Returns

`HttpTransportDbPlugin`

## Properties

### databaseName

> `readonly` **databaseName**: `string`

Defined in: [plugins/replication/src/HttpTransportDbPlugin.ts:105](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/HttpTransportDbPlugin.ts#L105)

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

`IDbPlugin.databaseName`

## Methods

### query()

> **query**\<`TRoot`, `TShape`\>(`event`, `done`): `void`

Defined in: [plugins/replication/src/HttpTransportDbPlugin.ts:161](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/HttpTransportDbPlugin.ts#L161)

Executes a query operation on the database.

#### Type Parameters

##### TRoot

`TRoot` *extends* `object`

##### TShape

`TShape` *extends* `unknown` = `TRoot`

#### Parameters

##### event

`DbPluginQueryEvent`\<`TRoot`, `TShape`\>

The query event containing schema, parent, and query operation.

##### done

`PluginEventCallbackResult`\<`ITranslatedValue`\<`TShape`\>\>

Callback with the result or error.

#### Returns

`void`

#### Implementation of

`IDbPlugin.query`

***

### bulkPersist()

> **bulkPersist**(`event`, `done`): `void`

Defined in: [plugins/replication/src/HttpTransportDbPlugin.ts:226](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/HttpTransportDbPlugin.ts#L226)

Executes bulk operations (add, update, remove) on the database.

#### Parameters

##### event

`DbPluginBulkPersistEvent`

The bulk operations event containing schema, parent, and changes.

##### done

`PluginEventCallbackPartialResult`\<`BulkPersistResult`\>

Callback with the result or error.

#### Returns

`void`

#### Implementation of

`IDbPlugin.bulkPersist`

***

### destroy()

> **destroy**(`event`, `done`): `void`

Defined in: [plugins/replication/src/HttpTransportDbPlugin.ts:272](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/replication/src/HttpTransportDbPlugin.ts#L272)

Does NOT destroy the remote database.

`destroy` means "release what this plugin holds", and this plugin holds a URL. Forwarding it
would let any client drop the server's database, which is not a decision a transport gets to
make — and `DataStore.destroy` is called in ordinary teardown, including by tests.

#### Parameters

##### event

`DbPluginEvent`

##### done

`PluginEventCallbackResult`\<`never`\>

#### Returns

`void`

#### Implementation of

`IDbPlugin.destroy`
