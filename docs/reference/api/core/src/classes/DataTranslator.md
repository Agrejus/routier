[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / DataTranslator

# Abstract Class: DataTranslator\<TRoot, TShape\>

Defined in: [core/src/plugins/translators/DataTranslator.ts:8](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/DataTranslator.ts#L8)

## Extended by

- [`JsonTranslator`](JsonTranslator.md)
- [`SqlTranslator`](SqlTranslator.md)
- [`TupleTranslator`](TupleTranslator.md)

## Type Parameters

### TRoot

`TRoot` *extends* `object`

### TShape

`TShape`

## Constructors

### Constructor

> **new DataTranslator**\<`TRoot`, `TShape`\>(`query`): `DataTranslator`\<`TRoot`, `TShape`\>

Defined in: [core/src/plugins/translators/DataTranslator.ts:27](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/DataTranslator.ts#L27)

#### Parameters

##### query

[`IQuery`](../type-aliases/IQuery.md)\<`TRoot`, `TShape`\>

#### Returns

`DataTranslator`\<`TRoot`, `TShape`\>

## Methods

### count()

> `abstract` **count**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/DataTranslator.ts:32](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/DataTranslator.ts#L32)

#### Type Parameters

##### TResult

`TResult` *extends* `number`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"count"`\>

#### Returns

`TResult`

***

### min()

> `abstract` **min**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/DataTranslator.ts:33](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/DataTranslator.ts#L33)

#### Type Parameters

##### TResult

`TResult` *extends* `string` \| `number` \| `Date`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"min"`\>

#### Returns

`TResult`

***

### max()

> `abstract` **max**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/DataTranslator.ts:34](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/DataTranslator.ts#L34)

#### Type Parameters

##### TResult

`TResult` *extends* `string` \| `number` \| `Date`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"max"`\>

#### Returns

`TResult`

***

### sum()

> `abstract` **sum**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/DataTranslator.ts:35](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/DataTranslator.ts#L35)

#### Type Parameters

##### TResult

`TResult` *extends* `number`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"sum"`\>

#### Returns

`TResult`

***

### distinct()

> `abstract` **distinct**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/DataTranslator.ts:36](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/DataTranslator.ts#L36)

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"distinct"`\>

#### Returns

`TResult`

***

### filter()

> `abstract` **filter**\<`TResult`\>(`data`, `option`): `TResult`

Defined in: [core/src/plugins/translators/DataTranslator.ts:39](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/DataTranslator.ts#L39)

#### Type Parameters

##### TResult

`TResult`

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"filter"`\>

#### Returns

`TResult`

***

### skip()

> `abstract` **skip**(`data`, `option`): `TShape`

Defined in: [core/src/plugins/translators/DataTranslator.ts:40](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/DataTranslator.ts#L40)

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"skip"`\>

#### Returns

`TShape`

***

### take()

> `abstract` **take**(`data`, `option`): `TShape`

Defined in: [core/src/plugins/translators/DataTranslator.ts:41](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/DataTranslator.ts#L41)

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"take"`\>

#### Returns

`TShape`

***

### sort()

> `abstract` **sort**(`data`, `option`): `TShape`

Defined in: [core/src/plugins/translators/DataTranslator.ts:42](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/DataTranslator.ts#L42)

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"sort"`\>

#### Returns

`TShape`

***

### map()

> `abstract` **map**(`data`, `option`): `TShape`

Defined in: [core/src/plugins/translators/DataTranslator.ts:43](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/DataTranslator.ts#L43)

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"map"`\>

#### Returns

`TShape`

***

### group()

> `abstract` **group**(`data`, `option`): `TShape`

Defined in: [core/src/plugins/translators/DataTranslator.ts:44](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/DataTranslator.ts#L44)

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"group"`\>

#### Returns

`TShape`

***

### nearest()

> `abstract` **nearest**(`data`, `option`): `TShape`

Defined in: [core/src/plugins/translators/DataTranslator.ts:56](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/DataTranslator.ts#L56)

Abstract on purpose, unlike the pass-throughs a storage translator can usually inherit.

Every other shaper degrades safely when a backend ignores it — an unsorted result is
still the right rows. A similarity search is not: it is the only option whose value is
ENTIRELY in the ordering and the limit, so a translator that quietly passes the data
through returns every row in insertion order and calls it the ten nearest.

Requiring an answer here means a new translator cannot be written without deciding
whether its backend performed the search, and the compiler asks the question.

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"nearest"`\>

#### Returns

`TShape`

***

### join()

> `abstract` **join**(`data`, `option`): `TShape`

Defined in: [core/src/plugins/translators/DataTranslator.ts:73](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/DataTranslator.ts#L73)

Abstract for the same reason as `nearest`, one step further.

A translator that quietly passed a join through would not return an unsorted or unlimited
result — it would return the OUTER rows, one object each where the contract says tuples,
and every `([outer, inner]) => ...` lambda downstream would destructure the outer entity
instead. Nothing errors; the answer is simply a different query's answer.

So the compiler asks the question. Every translator must state how its backend joins:
natively (pass through the rows the SQL already paired), in memory (the shared hash join
over rows the plugin supplies), or not at all (throw, loudly, naming the backend).

The output contract, whichever answer: an array of `[outer, inner]` tuples, each half
fully deserialized into its OWN schema's entity shape.

#### Parameters

##### data

`unknown`

##### option

[`QueryOption`](../type-aliases/QueryOption.md)\<`TShape`, `"join"`\>

#### Returns

`TShape`

***

### translate()

> **translate**(`data`): [`ITranslatedValue`](../interfaces/ITranslatedValue.md)\<`TShape`\>

Defined in: [core/src/plugins/translators/DataTranslator.ts:75](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/plugins/translators/DataTranslator.ts#L75)

#### Parameters

##### data

`unknown`

#### Returns

[`ITranslatedValue`](../interfaces/ITranslatedValue.md)\<`TShape`\>
