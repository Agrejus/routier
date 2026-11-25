[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SelectedValue

# Type Alias: SelectedValue

> **SelectedValue** = `object`

Defined in: [core/src/expressions/parser.ts:2670](https://github.com/Agrejus/routier/blob/main/core/src/expressions/parser.ts#L2670)

What one value a sort, map, group or `nearest` selector returns is read from.

## Properties

### property

> **property**: [`PropertyInfo`](../classes/PropertyInfo.md)\<`any`\> \| `null`

Defined in: [core/src/expressions/parser.ts:2672](https://github.com/Agrejus/routier/blob/main/core/src/expressions/parser.ts#L2672)

The schema property the value is read from, when it reads exactly one.

***

### reads

> **reads**: [`PropertyInfo`](../classes/PropertyInfo.md)\<`any`\>[]

Defined in: [core/src/expressions/parser.ts:2674](https://github.com/Agrejus/routier/blob/main/core/src/expressions/parser.ts#L2674)

Every schema property the value is read from, at any depth of the schema.

***

### isDirectProperty

> **isDirectProperty**: `boolean`

Defined in: [core/src/expressions/parser.ts:2679](https://github.com/Agrejus/routier/blob/main/core/src/expressions/parser.ts#L2679)

Whether the value is `property` itself. `false` for anything computed from it: a call, arithmetic,
`.length`, or a member of a value that is not a property.
