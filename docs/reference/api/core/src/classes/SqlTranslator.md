[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SqlTranslator

# Class: SqlTranslator\<TRoot, TShape\>

Defined in: [core/src/plugins/translators/SqlTranslator.ts:48](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/SqlTranslator.ts#L48)

## Extends

- [`DataTranslator`](DataTranslator.md)\<`TRoot`, `TShape`\>

## Type Parameters

### TRoot

`TRoot` *extends* `object`

### TShape

`TShape`

## Constructors

### Constructor

> **new SqlTranslator**\<`TRoot`, `TShape`\>(`query`, `pushedDown`): `SqlTranslator`\<`TRoot`, `TShape`\>

Defined in: [core/src/plugins/translators/SqlTranslator.ts:52](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/SqlTranslator.ts#L52)

#### Parameters

##### query

[`IQuery`](../type-aliases/IQuery.md)\<`TRoot`, `TShape`\>

##### pushedDown

[`SqlPushdown`](../type-aliases/SqlPushdown.md) = `{}`

#### Returns

`SqlTranslator`\<`TRoot`, `TShape`\>

#### Overrides

[`DataTranslator`](DataTranslator.md).[`constructor`](DataTranslator.md#constructor)

## Methods

### translate()

> **translate**(`data`): [`ITranslatedValue`](../interfaces/ITranslatedValue.md)\<`TShape`\>

Defined in: [core/src/plugins/translators/DataTranslator.ts:75](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/DataTranslator.ts#L75)

#### Parameters

##### data

`unknown`

#### Returns

[`ITranslatedValue`](../interfaces/ITranslatedValue.md)\<`TShape`\>

#### Inherited from

[`DataTranslator`](DataTranslator.md).[`translate`](DataTranslator.md#translate)

***

### count()

> **count**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: [core/src/plugins/translators/SqlTranslator.ts:57](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/SqlTranslator.ts#L57)

#### Type Parameters

##### TResult

`TResult` *extends* `number`

#### Parameters

##### data

`unknown`

##### \_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"count"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`count`](DataTranslator.md#count)

***

### min()

> **min**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: [core/src/plugins/translators/SqlTranslator.ts:72](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/SqlTranslator.ts#L72)

#### Type Parameters

##### TResult

`TResult` *extends* `string` \| `number` \| `Date`

#### Parameters

##### data

`unknown`

##### \_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"min"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`min`](DataTranslator.md#min)

***

### max()

> **max**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: [core/src/plugins/translators/SqlTranslator.ts:76](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/SqlTranslator.ts#L76)

#### Type Parameters

##### TResult

`TResult` *extends* `string` \| `number` \| `Date`

#### Parameters

##### data

`unknown`

##### \_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"max"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`max`](DataTranslator.md#max)

***

### sum()

> **sum**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: [core/src/plugins/translators/SqlTranslator.ts:80](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/SqlTranslator.ts#L80)

#### Type Parameters

##### TResult

`TResult` *extends* `number`

#### Parameters

##### data

`unknown`

##### \_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"sum"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`sum`](DataTranslator.md#sum)

***

### distinct()

> **distinct**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: [core/src/plugins/translators/SqlTranslator.ts:93](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/SqlTranslator.ts#L93)

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### \_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"distinct"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`distinct`](DataTranslator.md#distinct)

***

### filter()

> **filter**\<`TResult`\>(`data`, `_`): `TResult`

Defined in: [core/src/plugins/translators/SqlTranslator.ts:97](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/SqlTranslator.ts#L97)

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### \_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"filter"`\>

#### Returns

`TResult`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`filter`](DataTranslator.md#filter)

***

### skip()

> **skip**(`data`, `_`): `TShape`

Defined in: [core/src/plugins/translators/SqlTranslator.ts:101](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/SqlTranslator.ts#L101)

#### Parameters

##### data

`unknown`

##### \_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"skip"`\>

#### Returns

`TShape`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`skip`](DataTranslator.md#skip)

***

### take()

> **take**(`data`, `_`): `TShape`

Defined in: [core/src/plugins/translators/SqlTranslator.ts:105](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/SqlTranslator.ts#L105)

#### Parameters

##### data

`unknown`

##### \_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"take"`\>

#### Returns

`TShape`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`take`](DataTranslator.md#take)

***

### sort()

> **sort**(`data`, `_`): `TShape`

Defined in: [core/src/plugins/translators/SqlTranslator.ts:109](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/SqlTranslator.ts#L109)

#### Parameters

##### data

`unknown`

##### \_

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"sort"`\>

#### Returns

`TShape`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`sort`](DataTranslator.md#sort)

***

### nearest()

> **nearest**(`data`, `option`): `TShape`

Defined in: [core/src/plugins/translators/SqlTranslator.ts:128](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/SqlTranslator.ts#L128)

Scores in memory, unlike every other shaper here.

The pass-throughs above are safe because the SQL that produced these rows contained the
corresponding clause. No `sql-core` statement contains a similarity ordering — engines
that can express one are the exception, not the rule — so passing the data through
would return whatever order the engine happened to produce.

A plugin whose engine DID push the search down overrides this with a pass-through,
gated on `option.target`. Postgres is the only one today.

Rows arrive keyed by storage column name and are read that way rather than through the
option's selector, because the selector is written against the entity shape and these
rows have not been deserialized into it yet.

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"nearest"`\>

#### Returns

`TShape`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`nearest`](DataTranslator.md#nearest)

***

### join()

> **join**(`data`, `option`): `TShape`

Defined in: [core/src/plugins/translators/SqlTranslator.ts:153](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/SqlTranslator.ts#L153)

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

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"join"`\>

#### Returns

`TShape`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`join`](DataTranslator.md#join)

***

### group()

> **group**\<`T`\>(`data`, `option`): `T`

Defined in: [core/src/plugins/translators/SqlTranslator.ts:165](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/SqlTranslator.ts#L165)

#### Type Parameters

##### T

`T`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`T`, `"group"`\>

#### Returns

`T`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`group`](DataTranslator.md#group)

***

### map()

> **map**(`data`, `option`): `TShape`

Defined in: [core/src/plugins/translators/SqlTranslator.ts:201](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/SqlTranslator.ts#L201)

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"map"`\>

#### Returns

`TShape`

#### Overrides

[`DataTranslator`](DataTranslator.md).[`map`](DataTranslator.md#map)
