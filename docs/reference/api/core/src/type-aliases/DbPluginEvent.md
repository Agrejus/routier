[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / DbPluginEvent

# Type Alias: DbPluginEvent

> **DbPluginEvent** = `object`

Defined in: [core/src/plugins/types.ts:109](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L109)

Base event for all plugin operations, containing the schema and parent.

## Properties

### schemas

> **schemas**: [`SchemaCollection`](../classes/SchemaCollection.md)

Defined in: [core/src/plugins/types.ts:111](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L111)

The compiled schema for the entity.

***

### id

> **id**: `string`

Defined in: [core/src/plugins/types.ts:114](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L114)

Unique id of the event.

***

### source

> **source**: `string`

Defined in: [core/src/plugins/types.ts:117](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L117)

The class/component that triggered this event

***

### action

> **action**: `"query"` \| `"persist"` \| `"destroy"`

Defined in: [core/src/plugins/types.ts:120](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L120)

The action/operation type being performed

***

### reason?

> `optional` **reason**: `string`

Defined in: [core/src/plugins/types.ts:123](https://github.com/Agrejus/routier/blob/main/core/src/plugins/types.ts#L123)

Optional context about why this operation is happening
