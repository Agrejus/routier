[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / parseFragment

# Function: parseFragment()

> **parseFragment**(`schema`, `body`, `rootName`): [`Expression`](../classes/Expression.md)

Defined in: [core/src/expressions/parser.ts:1278](https://github.com/Agrejus/routier/blob/main/core/src/expressions/parser.ts#L1278)

Parses an expression SOURCE FRAGMENT against one schema and one root name.

`toExpression` starts from a function and works out its own roots. This starts from text, which
is what a caller has when it has split a larger predicate apart — `p.rank > 10` lifted out of
`([p, m]) => p.rank > 10 && m.won === true`.

**A fragment naming anything other than `rootName` returns `NOT_PARSABLE`, and that is the
point.** It is how a caller discovers which side of a join a conjunct belongs to: parse it
against each side in turn, and exactly one succeeds for a single-side condition. A condition
spanning both fails against both, which is the correct answer — it cannot be pushed to either.

No params: a fragment carrying a params reference has no bag to resolve it against here, so it
fails rather than binding to nothing.

Deliberately NOT cached. The cache is keyed by function source, and a fragment is not a function
— two different lambdas can contain the same fragment text against different schemas.

## Parameters

### schema

[`CompiledSchema`](../type-aliases/CompiledSchema.md)\<`any`\>

### body

`string`

### rootName

`string`

## Returns

[`Expression`](../classes/Expression.md)
