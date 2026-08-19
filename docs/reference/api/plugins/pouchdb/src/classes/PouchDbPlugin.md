[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/pouchdb/src](../README.md) / PouchDbPlugin

# Class: PouchDbPlugin

Defined in: [plugins/pouchdb/src/PouchDbPlugin.ts:56](https://github.com/Agrejus/routier/blob/main/plugins/pouchdb/src/PouchDbPlugin.ts#L56)

## Implements

- `IDbPlugin`

## Constructors

### Constructor

> **new PouchDbPlugin**(`name`, `options?`): `PouchDbPlugin`

Defined in: [plugins/pouchdb/src/PouchDbPlugin.ts:104](https://github.com/Agrejus/routier/blob/main/plugins/pouchdb/src/PouchDbPlugin.ts#L104)

#### Parameters

##### name

`string`

##### options?

`PouchDBPluginOptions`

#### Returns

`PouchDbPlugin`

## Accessors

### databaseName

#### Get Signature

> **get** **databaseName**(): `string`

Defined in: [plugins/pouchdb/src/PouchDbPlugin.ts:115](https://github.com/Agrejus/routier/blob/main/plugins/pouchdb/src/PouchDbPlugin.ts#L115)

See `IDbPlugin.databaseName`. The local database name — the same value two contexts
opening one PouchDB database supply, so they share subscription channels. Remote sync
targets are deliberately not part of it: two local databases replicating to one remote
are still two databases.

##### Returns

`string`

#### Implementation of

`IDbPlugin.databaseName`

## Methods

### sync()

> **sync**(`schemas`): `Sync`\<\{ \}\>

Defined in: [plugins/pouchdb/src/PouchDbPlugin.ts:119](https://github.com/Agrejus/routier/blob/main/plugins/pouchdb/src/PouchDbPlugin.ts#L119)

#### Parameters

##### schemas

`ReadonlySchemaCollection`

#### Returns

`Sync`\<\{ \}\>

***

### destroy()

> **destroy**(`_event`, `done`): `void`

Defined in: [plugins/pouchdb/src/PouchDbPlugin.ts:836](https://github.com/Agrejus/routier/blob/main/plugins/pouchdb/src/PouchDbPlugin.ts#L836)

Destroys or cleans up the plugin, closing connections or freeing resources.

#### Parameters

##### \_event

`DbPluginEvent`

##### done

(`error?`) => `void`

Callback with an optional error.

#### Returns

`void`

#### Implementation of

`IDbPlugin.destroy`

***

### bulkPersist()

> **bulkPersist**(`event`, `done`): `void`

Defined in: [plugins/pouchdb/src/PouchDbPlugin.ts:872](https://github.com/Agrejus/routier/blob/main/plugins/pouchdb/src/PouchDbPlugin.ts#L872)

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

### query()

> **query**\<`TRoot`, `TShape`\>(`event`, `done`): `void`

Defined in: [plugins/pouchdb/src/PouchDbPlugin.ts:884](https://github.com/Agrejus/routier/blob/main/plugins/pouchdb/src/PouchDbPlugin.ts#L884)

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

### extractEqualityValueForProperty()

> **extractEqualityValueForProperty**(`expression`, `prop`): `any`

Defined in: [plugins/pouchdb/src/PouchDbPlugin.ts:911](https://github.com/Agrejus/routier/blob/main/plugins/pouchdb/src/PouchDbPlugin.ts#L911)

#### Parameters

##### expression

`Expression`

##### prop

`PropertyInfo`\<`any`\>

#### Returns

`any`
