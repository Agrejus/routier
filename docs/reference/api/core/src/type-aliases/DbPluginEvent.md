[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / DbPluginEvent

# Type Alias: DbPluginEvent

> **DbPluginEvent** = `object`

Defined in: [core/src/plugins/types.ts:107](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L107)

Base event for all plugin operations, containing the schema and parent.

## Properties

### schemas

> **schemas**: [`SchemaCollection`](../classes/SchemaCollection.md)

Defined in: [core/src/plugins/types.ts:109](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L109)

The compiled schema for the entity.

***

### id

> **id**: `string`

Defined in: [core/src/plugins/types.ts:112](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L112)

Unique id of the event.

***

### source

> **source**: `string`

Defined in: [core/src/plugins/types.ts:115](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L115)

The class/component that triggered this event

***

### action

> **action**: `"query"` \| `"persist"` \| `"destroy"`

Defined in: [core/src/plugins/types.ts:118](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L118)

The action/operation type being performed

***

### reason?

> `optional` **reason**: `string`

Defined in: [core/src/plugins/types.ts:121](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L121)

Optional context about why this operation is happening
