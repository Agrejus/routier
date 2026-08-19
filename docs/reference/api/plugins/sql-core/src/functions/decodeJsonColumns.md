[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/sql-core/src](../README.md) / decodeJsonColumns

# Function: decodeJsonColumns()

> **decodeJsonColumns**\<`T`\>(`rows`, `schema`): `unknown`

Defined in: [plugins/sql-core/src/columns.ts:195](https://github.com/Agrejus/routier/blob/main/plugins/sql-core/src/columns.ts#L195)

Reverses `toColumnAssignments` on the way back out of the database.

Without this, writing a nested value as JSON is a one-way trip: the column holds
`'{"inner":{"value":"y"}}'` and the entity gets handed a string where an object belongs.

**Only properties with no `valueDeserializer` are touched.** That is the mirror of the
encode rule and it is load-bearing, not defensive. A schema carrying
`.deserialize(x => JSON.parse(String(x)))` will parse the column itself; parsing it here
first would hand that deserializer an object, and `JSON.parse(String({}))` is
`JSON.parse("[object Object]")` — a throw, from a schema that was previously working.

Unlike encoding there is no dialect hook. Encoding legitimately varies (a driver may
prefer binding a JS object straight to `jsonb`), but a JSON string decodes the same way
everywhere, and drivers that already return parsed objects are handled by the shape check
rather than by configuration.

## Type Parameters

### T

`T` *extends* `object`

## Parameters

### rows

`unknown`

### schema

`CompiledSchema`\<`T`\>

## Returns

`unknown`
