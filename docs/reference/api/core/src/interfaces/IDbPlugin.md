[**routier-collection**](/reference/api/README)

---

[routier-collection](/reference/api/README) / [core/src](/reference/api/core/src/README) / IDbPlugin

# Interface: IDbPlugin

Defined in: [core/src/plugins/types.ts:9](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/types.ts#L9)

Interface for a database plugin, which provides query, destroy, and bulk operations.

## Methods

### query()

> **query**\<`TRoot`, `TShape`\>(`event`, `done`): `void`

Defined in: [core/src/plugins/types.ts:15](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/types.ts#L15)

Executes a query operation on the database.

#### Type Parameters

##### TRoot

`TRoot` _extends_ `object`

##### TShape

`TShape` _extends_ `unknown` = `TRoot`

#### Parameters

##### event

[`DbPluginQueryEvent`](/reference/api/core/src/type-aliases/DbPluginQueryEvent)\<`TRoot`, `TShape`\>

The query event containing schema, parent, and query operation.

##### done

[`PluginEventCallbackResult`](/reference/api/core/src/type-aliases/PluginEventCallbackResult)\<`ITranslatedValue`\<`TShape`\>\>

Callback with the result or error. The result must be wrapped in an `ITranslatedValue` to allow the datastore to iterate over results (for grouped queries) and determine if change tracking should be enabled.

#### Returns

`void`

---

### destroy()

> **destroy**(`event`, `done`): `void`

Defined in: [core/src/plugins/types.ts:20](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/types.ts#L20)

Destroys or cleans up the plugin, closing connections or freeing resources.

#### Parameters

##### event

[`DbPluginEvent`](/reference/api/core/src/type-aliases/DbPluginEvent)

##### done

[`PluginEventCallbackResult`](/reference/api/core/src/type-aliases/PluginEventCallbackResult)\<`never`\>

Callback with an optional error.

#### Returns

`void`

---

### bulkPersist()

> **bulkPersist**(`event`, `done`): `void`

Defined in: [core/src/plugins/types.ts:26](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/types.ts#L26)

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
