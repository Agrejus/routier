[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / EvaluationResult

# Type Alias: EvaluationResult

> **EvaluationResult** = `boolean` \| `undefined`

Defined in: [core/src/expressions/evaluate.ts:31](https://github.com/Agrejus/routier/blob/main/core/src/expressions/evaluate.ts#L31)

Runs a parsed expression against a row.

The counterpart to `toSql` and `toMql`: those turn a tree into a backend's language, and this
turns it into an answer. Needed wherever a tree exists but the closure that produced it does
not — a filter split out of a larger predicate, an option rebuilt from a serialized query.

## It fails OPEN, and that is the whole safety argument

`undefined` means "this tree cannot be evaluated here" — an unknown node, a transformer with no
implementation, a comparison between shapes that do not compare. Callers must read that as KEEP
THE ROW, never as exclude it.

The reason is asymmetric cost. Every caller today uses this to NARROW something that a
subsequent, authoritative predicate will check again: a semi-join prefilter, a split conjunct.
Keeping a row this cannot judge costs one wasted comparison downstream. Dropping one loses data
from a query result and nothing anywhere reports it. So every uncertain path returns `undefined`,
and no path guesses `false`.

## Why not just reuse the caller's closure

Because there often isn't one. A conjunct pulled out of `([p, m]) => p.a === 1 && m.b === 2` is
source TEXT; turning it back into a callable needs `new Function`, which a
Content-Security-Policy blocks — the same constraint that makes `softDeleteScope` build its tree
by hand. The tree is the only representation that survives.
