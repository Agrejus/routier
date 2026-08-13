[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / DbPluginEvent

# Type Alias: DbPluginEvent

> **DbPluginEvent** = `object`

Defined in: [core/src/plugins/types.ts:65](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/types.ts#L65)

Base event for all plugin operations, containing the schema and parent.

## Properties

### schemas

> **schemas**: [`SchemaCollection`](../classes/SchemaCollection.md)

Defined in: [core/src/plugins/types.ts:67](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/types.ts#L67)

The compiled schema for the entity.

***

### id

> **id**: `string`

Defined in: [core/src/plugins/types.ts:70](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/types.ts#L70)

Unique id of the event.

***

### source

> **source**: `string`

Defined in: [core/src/plugins/types.ts:73](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/types.ts#L73)

The class/component that triggered this event

***

### action

> **action**: `"query"` \| `"persist"` \| `"destroy"`

Defined in: [core/src/plugins/types.ts:76](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/types.ts#L76)

The action/operation type being performed

***

### reason?

> `optional` **reason**: `string`

Defined in: [core/src/plugins/types.ts:79](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/types.ts#L79)

Optional context about why this operation is happening
