# @routier/mongodb-plugin

<p align="center">
  <img src="https://routier.dev/routier.svg" alt="Routier" width="140" height="140" />
</p>

MQL generation for Routier. `toMql` turns a core expression tree into a MongoDB filter
document.

This package is the translator only. It does not implement `IDbPlugin`, open a connection,
or write anything. It is the MongoDB counterpart of `toSql` in `@routier/sql-plugin-core`.

```ts
import { toMql } from '@routier/mongodb-plugin';

toMql(expression);
// { $and: [ { name: { $eq: 'James' } }, { price: { $gt: 10 } } ] }
```

## What it emits

| Filter | MQL |
| --- | --- |
| `x.name === 'James'` | `{ name: { $eq: 'James' } }` |
| `x.price > 10` | `{ price: { $gt: 10 } }` |
| `!(x.price > 10)` | `{ price: { $lte: 10 } }` |
| `10 > x.price` | `{ price: { $lt: 10 } }` |
| `x.deletedAt == null` | `{ deletedAt: { $eq: null } }` |
| `x.name.startsWith('Ad')` | `{ name: { $regex: '^Ad' } }` |
| `!x.name.startsWith('Ad')` | `{ name: { $not: /^Ad/ } }` |
| `x.label === 'hello'` (renamed `wire_label`) | `{ wire_label: { $eq: 'hello' } }` |
| `x.payload.inner.value === 'deep'` | `{ 'payload.inner.value': { $eq: 'deep' } }` |
| `x.tags.includes('x')` (array property) | `{ tags: 'x' }` |
| `['a','b'].includes(x.status)` | `{ status: { $in: ['a','b'] } }` |
| `x.tags.length === 2` | `{ $expr: { $eq: [{ $size: '$tags' }, { $literal: 2 }] } }` |
| `x.price > x.cost` | `{ $expr: { $gt: ['$price', '$cost'] } }` |
| `x => true` | `{}` |

## Four things worth knowing

**Operand order changes the operator.** MQL has no `{ 5: { $lt: '$price' } }` — a field has
to be a key. So `10 > x.price` becomes `{ price: { $lt: 10 } }`, with the comparator
mirrored. A translator that ignores which side the property is on emits a perfectly valid
query for the opposite range, which is the MQL form of the operand-order defect recorded
against the SQL equals path.

**Negation names the inverse operator rather than wrapping in `$not`.** `$not` on a field
predicate also matches documents where the field is missing, so `$not: { $gt: 5 }` and
`$lte: 5` are different queries. Negated comparisons use the inverse operator, which keeps
them over present values — what `!(x > 5)` means to the caller. String patterns are the
exception: a negated pattern has no inverse operator and does use `$not`, over a `RegExp`
instance, because `$not` rejects a `$regex` string.

**Nested properties use dot notation.** The SQL plugins store a nested object as a JSON
column and route filters into it to memory. Mongo addresses `payload.inner.value` directly,
so nested filtering pushes down here when it cannot elsewhere. Each path segment resolves
through `from`, so a renamed nested property addresses the stored name.

**A transformed property switches to `$expr`.** `LOWER(col) = ?` has no plain-filter
equivalent, so those comparisons become aggregation expressions (`$toLower`, `$toUpper`,
`$strLenCP`, `$size`, `$regexMatch`). `$expr` cannot use an index the way a field predicate
can, so it is reached for only where a plain predicate cannot express the comparison.

## Null

Mongo draws a distinction the SQL engines do not: `{ f: null }` matches documents where `f`
is null **and** documents where `f` is absent, whereas `col IS NULL` has no absent case
because a column always exists.

The two agree for documents Routier wrote — a schema serialises a nullable property as an
explicit null rather than omitting it. They diverge over documents written by something
else. This translator takes the Mongo-native reading rather than adding a `$type` check
that would make Routier's own rows behave differently from every other backend.

## When it throws

- A comparator with no MQL form.
- A string pattern against a null operand — `LIKE '%null%'` is never what the caller meant.
- A `not-parsable` expression. Core produces this for a filter it has no rule for, so it
  arrives in normal use. The error names the fix: evaluate the filter in memory by routing
  the query option to the memory execution target. Falling back silently would turn a
  bounded query into a full collection scan without saying so.

## Verification

`src/mql.test.ts` covers the mapping two ways: against hand-built expression trees, and
against trees the real parser produced from filters a caller would write.

Shape assertions prove what the translator emits, not what an engine does with it — the
lesson `e2e/src/dialectConformance.ts` records about the SQL builder. So the output was also
executed against MongoDB 7 over a seeded collection, asserting the matched `_id`s for 27
filters covering every row in the table above. `$not` over a `RegExp`, `$size`, `$toLower`
and `$regexMatch` were each confirmed against the server rather than assumed.

One known gap, in core rather than here: the parser returns `not-parsable` for
`x.name.toLowerCase() === 'ada'`, though it parses `x.name.toLowerCase().startsWith('ad')`
and `x.tags.length === 2` normally. The `$expr` equality path is reachable through `length`;
it is the case-transform equality that never reaches this translator.
