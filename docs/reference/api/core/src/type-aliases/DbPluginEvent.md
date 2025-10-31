[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / DbPluginEvent

# Type Alias: DbPluginEvent

> **DbPluginEvent** = `object`

Defined in: [core/src/plugins/types.ts:42](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/types.ts#L42)

Base event for all plugin operations, containing the schema and parent.

## Properties

### schemas

> **schemas**: [`SchemaCollection`](../classes/SchemaCollection.md)

Defined in: [core/src/plugins/types.ts:44](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/types.ts#L44)

The compiled schema for the entity.

***

### id

> **id**: `string`

Defined in: [core/src/plugins/types.ts:47](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/types.ts#L47)

Unique id of the event.

***

### source

> **source**: `"data-store"` \| `"collection"` \| `"view"`

Defined in: [core/src/plugins/types.ts:50](https://github.com/Agrejus/routier/blob/ae307d61bf9883ec014a438be7cbd96d2060d092/core/src/plugins/types.ts#L50)

Source of the request
