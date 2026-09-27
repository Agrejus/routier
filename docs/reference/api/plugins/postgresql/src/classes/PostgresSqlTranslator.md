[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/postgresql/src](../README.md) / PostgresSqlTranslator

# Class: PostgresSqlTranslator\<TRoot, TShape\>

Defined in: plugins/postgres-core/dist/PostgresSqlTranslator.d.ts:19

## Extends

- `SqlTranslator`\<`TRoot`, `TShape`\>

## Type Parameters

### TRoot

`TRoot` *extends* `object`

### TShape

`TShape`

## Constructors

### Constructor

> **new PostgresSqlTranslator**\<`TRoot`, `TShape`\>(`query`, `pushedDown?`): `PostgresSqlTranslator`\<`TRoot`, `TShape`\>

Defined in: plugins/postgres-core/dist/PostgresSqlTranslator.d.ts:27

#### Parameters

##### query

`IQuery`\<`TRoot`, `TShape`\>

##### pushedDown?

[`PostgresPushdown`](../type-aliases/PostgresPushdown.md)

What the statement that produced these rows actually contained. Supplied
by the plugin because only the query builder knows: pgvector may be missing, a window may
have made a pushdown unsafe, an inner join filter may have had no column to compare against.
`nearest` is Postgres-specific; `join` is handled by the base class.

#### Returns

`PostgresSqlTranslator`\<`TRoot`, `TShape`\>

#### Overrides

`SqlTranslator<TRoot, TShape>.constructor`

## Methods

### translate()

> **translate**(`data`): `ITranslatedValue`\<`TShape`\>

Defined in: core/dist/plugins/translators/SqlTranslator.d.ts:33

Dates back as Dates, before the caller's selectors run over the rows.

A `group` key and a `map` are the caller's lambdas, run here over rows as the engine returned them.
SQLite, D1 and libSQL hand a date back as the TEXT it was stored as, which has no `getFullYear()`
and groups apart from the Date the entity holds. Revived at storage paths and in place, which the
datastore's deserialization still reads, and after `decodeJsonColumns`, so a date inside a JSON
column is revived too. Only a string is converted, so an engine that returns a Date (PostgreSQL,
PGlite, MySQL) is left alone, and so is a row already revived.

Not a joined statement's rows, which are tuples, each half already deserialized. Nor rows whose
`group` or `map` was handed back, which the datastore runs after deserializing them.

#### Parameters

##### data

`unknown`

#### Returns

`ITranslatedValue`\<`TShape`\>

#### Inherited from

`SqlTranslator.translate`

***

### min()

> **min**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: core/dist/plugins/translators/SqlTranslator.d.ts:35

#### Type Parameters

##### TResult

`TResult` *extends* `string` \| `number` \| `Date`

#### Parameters

##### data

`unknown`

##### \_

`QueryOption`\<`TShape`, `"min"`\>

#### Returns

`TResult`

#### Inherited from

`SqlTranslator.min`

***

### max()

> **max**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: core/dist/plugins/translators/SqlTranslator.d.ts:36

#### Type Parameters

##### TResult

`TResult` *extends* `string` \| `number` \| `Date`

#### Parameters

##### data

`unknown`

##### \_

`QueryOption`\<`TShape`, `"max"`\>

#### Returns

`TResult`

#### Inherited from

`SqlTranslator.max`

***

### sum()

> **sum**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: core/dist/plugins/translators/SqlTranslator.d.ts:37

#### Type Parameters

##### TResult

`TResult` *extends* `number`

#### Parameters

##### data

`unknown`

##### \_

`QueryOption`\<`TShape`, `"sum"`\>

#### Returns

`TResult`

#### Inherited from

`SqlTranslator.sum`

***

### distinct()

> **distinct**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: core/dist/plugins/translators/SqlTranslator.d.ts:39

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### \_

`QueryOption`\<`TShape`, `"distinct"`\>

#### Returns

`TResult`

#### Inherited from

`SqlTranslator.distinct`

***

### filter()

> **filter**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: core/dist/plugins/translators/SqlTranslator.d.ts:40

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### \_

`QueryOption`\<`TShape`, `"filter"`\>

#### Returns

`TResult`

#### Inherited from

`SqlTranslator.filter`

***

### skip()

> **skip**(`data`, `_`): `TShape`

Defined in: core/dist/plugins/translators/SqlTranslator.d.ts:41

#### Parameters

##### data

`unknown`

##### \_

`QueryOption`\<`TShape`, `"skip"`\>

#### Returns

`TShape`

#### Inherited from

`SqlTranslator.skip`

***

### take()

> **take**(`data`, `_`): `TShape`

Defined in: core/dist/plugins/translators/SqlTranslator.d.ts:42

#### Parameters

##### data

`unknown`

##### \_

`QueryOption`\<`TShape`, `"take"`\>

#### Returns

`TShape`

#### Inherited from

`SqlTranslator.take`

***

### sort()

> **sort**(`data`, `_`): `TShape`

Defined in: core/dist/plugins/translators/SqlTranslator.d.ts:43

#### Parameters

##### data

`unknown`

##### \_

`QueryOption`\<`TShape`, `"sort"`\>

#### Returns

`TShape`

#### Inherited from

`SqlTranslator.sort`

***

### join()

> **join**(`data`, `option`): `TShape`

Defined in: core/dist/plugins/translators/SqlTranslator.d.ts:73

Passes through only when the statement really did contain the `JOIN`, and refuses otherwise.

The pass-throughs above are safe unconditionally because the SQL that produced these rows
contained the corresponding clause. A join is not like that: if the plugin did not emit one,
these rows are the outer side alone, and passing them through hands the caller entities
where the contract says tuples — every `([outer, inner]) => ...` lambda downstream then
destructures the wrong object, and nothing errors.

So the plugin has to say, and the default is to refuse. A plugin that DID emit the join has
already split each flat row into its two deserialized halves (`splitJoinRows` in
`@routier/sql-plugin-core`), so by the time the option is walked the work is done.

#### Parameters

##### data

`unknown`

##### option

`QueryOption`\<`TShape`, `"join"`\>

#### Returns

`TShape`

#### Inherited from

`SqlTranslator.join`

***

### group()

> **group**\<`T`\>(`data`, `option`): `T`

Defined in: core/dist/plugins/translators/SqlTranslator.d.ts:74

#### Type Parameters

##### T

`T`

#### Parameters

##### data

`unknown`

##### option

`QueryOption`\<`T`, `"group"`\>

#### Returns

`T`

#### Inherited from

`SqlTranslator.group`

***

### map()

> **map**(`data`, `option`): `TShape`

Defined in: core/dist/plugins/translators/SqlTranslator.d.ts:75

#### Parameters

##### data

`unknown`

##### option

`QueryOption`\<`TShape`, `"map"`\>

#### Returns

`TShape`

#### Inherited from

`SqlTranslator.map`

***

### nearest()

> **nearest**(`data`, `option`): `TShape`

Defined in: plugins/postgres-core/dist/PostgresSqlTranslator.d.ts:35

Passes through only when PostgreSQL actually did the search.

Rescoring pushed-down rows would be wasted work but not wrong; the dangerous direction
is the other one, so the default is to score. `nearestPushedDown` says a `<=>` ordering
and its `LIMIT` are in the SQL, and nothing else may claim that.

#### Parameters

##### data

`unknown`

##### option

`QueryOption`\<`TShape`, `"nearest"`\>

#### Returns

`TShape`

#### Overrides

`SqlTranslator.nearest`

***

### count()

> **count**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: plugins/postgres-core/dist/PostgresSqlTranslator.d.ts:36

#### Type Parameters

##### TResult

`TResult` *extends* `number`

#### Parameters

##### data

`unknown`

##### option

`QueryOption`\<`TShape`, `"count"`\>

#### Returns

`TResult`

#### Overrides

`SqlTranslator.count`
