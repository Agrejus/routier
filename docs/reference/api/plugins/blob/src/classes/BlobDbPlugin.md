[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/blob/src](../README.md) / BlobDbPlugin

# Class: BlobDbPlugin\<TFiles\>

Defined in: [plugins/blob/src/BlobDbPlugin.ts:49](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/BlobDbPlugin.ts#L49)

## Extended by

- [`DirectUploadPlugin`](DirectUploadPlugin.md)

## Type Parameters

### TFiles

`TFiles` *extends* [`FileUploader`](../type-aliases/FileUploader.md) = [`Files`](../type-aliases/Files.md)

## Implements

- `IDbPlugin`

## Constructors

### Constructor

> **new BlobDbPlugin**\<`TFiles`\>(`plugin`, `files`): `BlobDbPlugin`\<`TFiles`\>

Defined in: [plugins/blob/src/BlobDbPlugin.ts:51](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/BlobDbPlugin.ts#L51)

#### Parameters

##### plugin

`IDbPlugin`

##### files

`TFiles`

#### Returns

`BlobDbPlugin`\<`TFiles`\>

## Properties

### files

> `readonly` **files**: `TFiles`

Defined in: [plugins/blob/src/BlobDbPlugin.ts:53](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/BlobDbPlugin.ts#L53)

## Accessors

### databaseName

#### Get Signature

> **get** **databaseName**(): `string`

Defined in: [plugins/blob/src/BlobDbPlugin.ts:56](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/BlobDbPlugin.ts#L56)

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

#### Implementation of

`IDbPlugin.databaseName`

## Methods

### query()

> **query**\<`TRoot`, `TShape`\>(`event`, `done`): `void`

Defined in: [plugins/blob/src/BlobDbPlugin.ts:60](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/BlobDbPlugin.ts#L60)

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

### destroy()

> **destroy**(`event`, `done`): `void`

Defined in: [plugins/blob/src/BlobDbPlugin.ts:69](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/BlobDbPlugin.ts#L69)

Destroys or cleans up the plugin, closing connections or freeing resources.

#### Parameters

##### event

`DbPluginEvent`

##### done

`PluginEventCallbackResult`\<`never`\>

Callback with an optional error.

#### Returns

`void`

#### Implementation of

`IDbPlugin.destroy`

***

### bulkPersist()

> **bulkPersist**(`event`, `done`): `void`

Defined in: [plugins/blob/src/BlobDbPlugin.ts:76](https://github.com/Agrejus/routier/blob/main/plugins/blob/src/BlobDbPlugin.ts#L76)

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
