[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SelectedValue

# Type Alias: SelectedValue

> **SelectedValue** = `object`

Defined in: [core/src/expressions/parser.ts:2653](https://github.com/Agrejus/routier/blob/main/core/src/expressions/parser.ts#L2653)

What one value a sort, map, group or `nearest` selector returns is read from.

## Properties

### property

> **property**: [`PropertyInfo`](../classes/PropertyInfo.md)\<`any`\> \| `null`

Defined in: [core/src/expressions/parser.ts:2655](https://github.com/Agrejus/routier/blob/main/core/src/expressions/parser.ts#L2655)

The schema property the value is read from, when it reads exactly one.

***

### reads

> **reads**: [`PropertyInfo`](../classes/PropertyInfo.md)\<`any`\>[]

Defined in: [core/src/expressions/parser.ts:2657](https://github.com/Agrejus/routier/blob/main/core/src/expressions/parser.ts#L2657)

Every schema property the value is read from, at any depth of the schema.

***

### isDirectProperty

> **isDirectProperty**: `boolean`

Defined in: [core/src/expressions/parser.ts:2662](https://github.com/Agrejus/routier/blob/main/core/src/expressions/parser.ts#L2662)

Whether the value is `property` itself. `false` for anything computed from it: a call, arithmetic,
`.length`, or a member of a value that is not a property.
