[**routier-collection**](/reference/api/README)

---

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / EphemeralDataPlugin

# Abstract Class: EphemeralDataPlugin

Defined in: [core/src/plugins/EphemeralDataPlugin.ts:11](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/EphemeralDataPlugin.ts#L11)

Interface for a database plugin, which provides query, destroy, and bulk operations.

## Implements

- [`IDbPlugin`](/reference/api/core/src/interfaces/IDbPlugin)

## Constructors

### Constructor

> **new EphemeralDataPlugin**(`databaseName`): `EphemeralDataPlugin`

Defined in: [core/src/plugins/EphemeralDataPlugin.ts:15](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/EphemeralDataPlugin.ts#L15)

#### Parameters

##### databaseName

`string`

#### Returns

`EphemeralDataPlugin`

## Methods

### bulkPersist()

> **bulkPersist**(`event`, `done`): `void`

Defined in: [core/src/plugins/EphemeralDataPlugin.ts:21](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/EphemeralDataPlugin.ts#L21)

Executes bulk operations (add, update, remove) on the database.

#### Parameters

##### event

[`DbPluginBulkPersistEvent`](/reference/api/core/src/type-aliases/DbPluginBulkPersistEvent)

The bulk operations event containing schema, parent, and changes.

##### done

[`PluginEventCallbackPartialResult`](/reference/api/core/src/type-aliases/PluginEventCallbackPartialResult)\<[`BulkPersistResult`](/reference/api/core/src/classes/BulkPersistResult)\>

Callback with the result or error.

#### Returns

`void`

#### Implementation of

[`IDbPlugin`](/reference/api/core/src/interfaces/IDbPlugin).[`bulkPersist`](/reference/api/core/src/interfaces/IDbPlugin#bulkpersist)

---

### query()

> **query**\<`TEntity`, `TShape`\>(`event`, `done`): `void`

Defined in: [core/src/plugins/EphemeralDataPlugin.ts:104](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/EphemeralDataPlugin.ts#L104)

Executes a query operation on the database.

#### Type Parameters

##### TEntity

`TEntity` _extends_ `object`

##### TShape

`TShape` _extends_ `unknown` = `TEntity`

#### Parameters

##### event

[`DbPluginQueryEvent`](/reference/api/core/src/type-aliases/DbPluginQueryEvent)\<`TEntity`, `TShape`\>

The query event containing schema, parent, and query operation.

##### done

[`PluginEventCallbackResult`](/reference/api/core/src/type-aliases/PluginEventCallbackResult)\<`ITranslatedValue`\<`TShape`\>\>

Callback with the result or error. The result must be wrapped in an `ITranslatedValue` to allow the datastore to iterate over results (for grouped queries) and determine if change tracking should be enabled.

#### Returns

`void`

#### Implementation of

[`IDbPlugin`](/reference/api/core/src/interfaces/IDbPlugin).[`query`](/reference/api/core/src/interfaces/IDbPlugin#query)

---

### destroy()

> `abstract` **destroy**(`event`, `done`): `void`

Defined in: [core/src/plugins/EphemeralDataPlugin.ts:132](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/EphemeralDataPlugin.ts#L132)

Destroys or cleans up the plugin, closing connections or freeing resources.

#### Parameters

##### event

[`DbPluginEvent`](/reference/api/core/src/type-aliases/DbPluginEvent)

##### done

[`PluginEventCallbackResult`](/reference/api/core/src/type-aliases/PluginEventCallbackResult)\<`never`\>

Callback with an optional error.

#### Returns

`void`

#### Implementation of

[`IDbPlugin`](/reference/api/core/src/interfaces/IDbPlugin).[`destroy`](/reference/api/core/src/interfaces/IDbPlugin#destroy)
