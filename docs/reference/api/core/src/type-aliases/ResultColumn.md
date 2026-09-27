[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / ResultColumn

# Type Alias: ResultColumn

> **ResultColumn** = `object`

Defined in: [core/src/plugins/resultShape.ts:17](https://github.com/Agrejus/routier/blob/main/core/src/plugins/resultShape.ts#L17)

What a statement or command RETURNS, described before it runs.

A plugin's builder knows this and nothing else knows it: the shape of a result comes from the
projection, the join aliases, or the `RETURNING` list, none of which survive into the SQL as
anything a reader could recover. So the builder states it, once, beside the statement it built.

Deliberately says nothing about what anyone does with the result. It is a description, not an
instruction — the same description serves a driver that transfers rows across a worker
boundary, one that hands them straight back, and one that only wants to know the column order.
A consumer that needs more turns this into whatever it needs: `buildTransferPlan` in
`@routier/core/transfer` is one such consumer, and it is not privileged.

## Properties

### name

> `readonly` **name**: `string`

Defined in: [core/src/plugins/resultShape.ts:19](https://github.com/Agrejus/routier/blob/main/core/src/plugins/resultShape.ts#L19)

Exact name the engine will return, including any projection or join alias.

***

### property

> `readonly` **property**: [`PropertyInfo`](../classes/PropertyInfo.md)\<`any`\> \| `null`

Defined in: [core/src/plugins/resultShape.ts:27](https://github.com/Agrejus/routier/blob/main/core/src/plugins/resultShape.ts#L27)

The schema property behind the column, or `null`.

`null` for an expression — a computed value, an aggregate, anything with no declared type
to reason from. A consumer that wants to treat the value specially needs the property; one
that only wants names does not.
