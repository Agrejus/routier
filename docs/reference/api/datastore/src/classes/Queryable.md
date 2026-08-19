[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [datastore/src](../README.md) / Queryable

# Class: Queryable\<Root, Shape, U, TStore, E\>

Defined in: [datastore/src/queryable/Queryable.ts:11](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/Queryable.ts#L11)

## Extends

- `SelectionQueryable`\<`Root`, `Shape`, `U`, `E`\>

## Type Parameters

### Root

`Root` *extends* `object`

### Shape

`Shape`

### U

`U`

### TStore

`TStore` = `unknown`

### E

`E` *extends* `boolean` = `false`

## Constructors

### Constructor

> **new Queryable**\<`Root`, `Shape`, `U`, `TStore`, `E`\>(`dependencies`, `request`): `Queryable`\<`Root`, `Shape`, `U`, `TStore`, `E`\>

Defined in: [datastore/src/queryable/Queryable.ts:13](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/Queryable.ts#L13)

#### Parameters

##### dependencies

`CollectionDependencies`\<`Root`\>

##### request

`RequestContext`\<`Root`\>

#### Returns

`Queryable`\<`Root`, `Shape`, `U`, `TStore`, `E`\>

#### Overrides

`SelectionQueryable<Root, Shape, U, E>.constructor`

## Methods

### compose()

> `static` **compose**\<`TEntity`\>(`schema`): `QueryableComposer`\<`TEntity`, `InferType`\<`TEntity`\>, `void`\>

Defined in: [datastore/src/queryable/Queryable.ts:25](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/Queryable.ts#L25)

#### Type Parameters

##### TEntity

`TEntity` *extends* `object`

#### Parameters

##### schema

`CompiledSchema`\<`TEntity`\>

#### Returns

`QueryableComposer`\<`TEntity`, `InferType`\<`TEntity`\>, `void`\>

***

### explain()

> **explain**(): `Queryable`\<`Root`, `Shape`, `U`, `TStore`, `true`\>

Defined in: [datastore/src/queryable/Queryable.ts:37](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/Queryable.ts#L37)

Reports where each query option ran — the database or memory — alongside the results.

See `QueryableAsync.explain`. The query still executes; terminals after this deliver
`{ data, explanation }`.

#### Returns

`Queryable`\<`Root`, `Shape`, `U`, `TStore`, `true`\>

***

### where()

#### Call Signature

> **where**(`expression`): `Queryable`\<`Root`, `Shape`, `U`, `TStore`, `E`\>

Defined in: [datastore/src/queryable/Queryable.ts:41](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/Queryable.ts#L41)

##### Parameters

###### expression

`Filter`\<`Shape`\>

##### Returns

`Queryable`\<`Root`, `Shape`, `U`, `TStore`, `E`\>

#### Call Signature

> **where**\<`P`\>(`selector`, `params`): `Queryable`\<`Root`, `Shape`, `U`, `TStore`, `E`\>

Defined in: [datastore/src/queryable/Queryable.ts:42](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/Queryable.ts#L42)

##### Type Parameters

###### P

`P` *extends* `object`

##### Parameters

###### selector

`ParamsFilter`\<`Shape`, `P`\>

###### params

`P`

##### Returns

`Queryable`\<`Root`, `Shape`, `U`, `TStore`, `E`\>

***

### map()

> **map**\<`R`\>(`expression`): `Queryable`\<`Root`, `R`, `U`, `TStore`, `E`\>

Defined in: [datastore/src/queryable/Queryable.ts:50](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/Queryable.ts#L50)

#### Type Parameters

##### R

`R`

#### Parameters

##### expression

`GenericFunction`\<`Shape`, `R`\>

#### Returns

`Queryable`\<`Root`, `R`, `U`, `TStore`, `E`\>

***

### skip()

> **skip**(`amount`): `Queryable`\<`Root`, `Shape`, `U`, `TStore`, `E`\>

Defined in: [datastore/src/queryable/Queryable.ts:56](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/Queryable.ts#L56)

#### Parameters

##### amount

`number`

#### Returns

`Queryable`\<`Root`, `Shape`, `U`, `TStore`, `E`\>

***

### take()

> **take**(`amount`): `Queryable`\<`Root`, `Shape`, `U`, `TStore`, `E`\>

Defined in: [datastore/src/queryable/Queryable.ts:61](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/Queryable.ts#L61)

#### Parameters

##### amount

`number`

#### Returns

`Queryable`\<`Root`, `Shape`, `U`, `TStore`, `E`\>

***

### sort()

> **sort**(`expression`): `Queryable`\<`Root`, `Shape`, `U`, `TStore`, `E`\>

Defined in: [datastore/src/queryable/Queryable.ts:66](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/Queryable.ts#L66)

#### Parameters

##### expression

`GenericFunction`\<`Shape`, `Shape`\[keyof `Shape`\]\>

#### Returns

`Queryable`\<`Root`, `Shape`, `U`, `TStore`, `E`\>

***

### sortDescending()

> **sortDescending**(`expression`): `Queryable`\<`Root`, `Shape`, `U`, `TStore`, `E`\>

Defined in: [datastore/src/queryable/Queryable.ts:71](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/Queryable.ts#L71)

#### Parameters

##### expression

`GenericFunction`\<`Shape`, `Shape`\[keyof `Shape`\]\>

#### Returns

`Queryable`\<`Root`, `Shape`, `U`, `TStore`, `E`\>

***

### nearest()

> **nearest**(`expression`, `vector`, `count`): `Queryable`\<`Root`, `Shape`, `U`, `TStore`, `E`\>

Defined in: [datastore/src/queryable/Queryable.ts:88](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/Queryable.ts#L88)

The `count` rows whose vector is most similar to `vector`, nearest first.

An ordering and a limit, not a filter — it returns the closest rows rather than the
matching ones, so it is always worth pairing with `.where()` when the search should be
scoped. Similarity is cosine distance, and the distance itself is not returned.

Works on every backend. One with a native vector index does the search there; the rest
read the rows this query selects and score them in memory, which returns the same
answer over more data — so a `.where()` in front of it is a real saving, not a
formality.

#### Parameters

##### expression

`GenericFunction`\<`Shape`, `Shape`\[keyof `Shape`\]\>

##### vector

`number`[]

##### count

`number`

#### Returns

`Queryable`\<`Root`, `Shape`, `U`, `TStore`, `E`\>

***

### join()

> **join**\<`TInner`, `TKey`\>(`inner`, `outerKey`, `innerKey`): [`JoinQueryable`](JoinQueryable.md)\<`Root`, [`JoinTuple`](../type-aliases/JoinTuple.md)\<`Shape`, `InferType`\<`TInner`\>\>, `E`\>

Defined in: [datastore/src/queryable/Queryable.ts:101](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/Queryable.ts#L101)

Pairs each row with every matching row of `inner` — an inner equi-join. See
`QueryableExecutor.setJoinQueryOption`.

Subscriptions do not survive a join (v1): a join subscription has to listen to both
schemas, and `DataBridge.subscribe` is single-schema. The returned queryable has no
`subscribe`.

#### Type Parameters

##### TInner

`TInner` *extends* `object`

##### TKey

`TKey` *extends* `string` \| `number`

#### Parameters

##### inner

`JoinTarget`\<`TStore`, `TInner`\>

##### outerKey

(`outer`) => `TKey`

##### innerKey

(`inner`) => `TKey`

#### Returns

[`JoinQueryable`](JoinQueryable.md)\<`Root`, [`JoinTuple`](../type-aliases/JoinTuple.md)\<`Shape`, `InferType`\<`TInner`\>\>, `E`\>

***

### leftJoin()

> **leftJoin**\<`TInner`, `TKey`\>(`inner`, `outerKey`, `innerKey`): [`JoinQueryable`](JoinQueryable.md)\<`Root`, [`JoinTuple`](../type-aliases/JoinTuple.md)\<`Shape`, `InferType`\<`TInner`\>\>, `E`\>

Defined in: [datastore/src/queryable/Queryable.ts:112](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/Queryable.ts#L112)

Like `join`, but unmatched rows appear paired with `undefined`.

#### Type Parameters

##### TInner

`TInner` *extends* `object`

##### TKey

`TKey` *extends* `string` \| `number`

#### Parameters

##### inner

`JoinTarget`\<`TStore`, `TInner`\>

##### outerKey

(`outer`) => `TKey`

##### innerKey

(`inner`) => `TKey`

#### Returns

[`JoinQueryable`](JoinQueryable.md)\<`Root`, [`JoinTuple`](../type-aliases/JoinTuple.md)\<`Shape`, `InferType`\<`TInner`\>\>, `E`\>

***

### subscribe()

> **subscribe**(): `SubscribedQueryable`\<`Root`, `Shape`, () => `void`\>

Defined in: [datastore/src/queryable/Queryable.ts:122](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/Queryable.ts#L122)

#### Returns

`SubscribedQueryable`\<`Root`, `Shape`, () => `void`\>

***

### remove()

#### Call Signature

> **remove**(`expression`, `done`): `void`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:27](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/SelectionQueryable.ts#L27)

##### Parameters

###### expression

`Filter`\<`Shape`\>

###### done

`CallbackResult`\<`Explainable`\<`E`, `Shape`[]\>\>

##### Returns

`void`

##### Inherited from

`SelectionQueryable.remove`

#### Call Signature

> **remove**\<`P`\>(`expression`, `params`, `done`): `void`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:28](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/SelectionQueryable.ts#L28)

##### Type Parameters

###### P

`P` *extends* `object`

##### Parameters

###### expression

`ParamsFilter`\<`Shape`, `P`\>

###### params

`P`

###### done

`CallbackResult`\<`Explainable`\<`E`, `Shape`[]\>\>

##### Returns

`void`

##### Inherited from

`SelectionQueryable.remove`

#### Call Signature

> **remove**(`done`): `void`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:29](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/SelectionQueryable.ts#L29)

##### Parameters

###### done

`CallbackResult`\<`Explainable`\<`E`, `Shape`[]\>\>

##### Returns

`void`

##### Inherited from

`SelectionQueryable.remove`

***

### toArray()

> **toArray**(`done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:60](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/SelectionQueryable.ts#L60)

#### Parameters

##### done

`CallbackResult`\<`Explainable`\<`E`, `Shape`[]\>\>

#### Returns

`U`

#### Inherited from

`SelectionQueryable.toArray`

***

### first()

#### Call Signature

> **first**(`expression`, `done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:67](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/SelectionQueryable.ts#L67)

##### Parameters

###### expression

`Filter`\<`Shape`\>

###### done

`CallbackResult`\<`Explainable`\<`E`, `Shape`\>\>

##### Returns

`U`

##### Inherited from

`SelectionQueryable.first`

#### Call Signature

> **first**\<`P`\>(`expression`, `params`, `done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:68](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/SelectionQueryable.ts#L68)

##### Type Parameters

###### P

`P` *extends* `object`

##### Parameters

###### expression

`ParamsFilter`\<`Shape`, `P`\>

###### params

`P`

###### done

`CallbackResult`\<`Explainable`\<`E`, `Shape`\>\>

##### Returns

`U`

##### Inherited from

`SelectionQueryable.first`

#### Call Signature

> **first**(`done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:69](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/SelectionQueryable.ts#L69)

##### Parameters

###### done

`CallbackResult`\<`Explainable`\<`E`, `Shape`\>\>

##### Returns

`U`

##### Inherited from

`SelectionQueryable.first`

***

### firstOrUndefined()

#### Call Signature

> **firstOrUndefined**(`expression`, `done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:129](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/SelectionQueryable.ts#L129)

##### Parameters

###### expression

`Filter`\<`Shape`\>

###### done

`CallbackResult`\<`Explainable`\<`E`, `Shape`\>\>

##### Returns

`U`

##### Inherited from

`SelectionQueryable.firstOrUndefined`

#### Call Signature

> **firstOrUndefined**\<`P`\>(`expression`, `params`, `done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:130](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/SelectionQueryable.ts#L130)

##### Type Parameters

###### P

`P` *extends* `object`

##### Parameters

###### expression

`ParamsFilter`\<`Shape`, `P`\>

###### params

`P`

###### done

`CallbackResult`\<`Explainable`\<`E`, `Shape`\>\>

##### Returns

`U`

##### Inherited from

`SelectionQueryable.firstOrUndefined`

#### Call Signature

> **firstOrUndefined**(`done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:131](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/SelectionQueryable.ts#L131)

##### Parameters

###### done

`CallbackResult`\<`Explainable`\<`E`, `Shape`\>\>

##### Returns

`U`

##### Inherited from

`SelectionQueryable.firstOrUndefined`

***

### some()

#### Call Signature

> **some**(`expression`, `done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:184](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/SelectionQueryable.ts#L184)

##### Parameters

###### expression

`Filter`\<`Shape`\>

###### done

`CallbackResult`\<`Explainable`\<`E`, `boolean`\>\>

##### Returns

`U`

##### Inherited from

`SelectionQueryable.some`

#### Call Signature

> **some**\<`P`\>(`expression`, `params`, `done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:185](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/SelectionQueryable.ts#L185)

##### Type Parameters

###### P

`P` *extends* `object`

##### Parameters

###### expression

`ParamsFilter`\<`Shape`, `P`\>

###### params

`P`

###### done

`CallbackResult`\<`Explainable`\<`E`, `boolean`\>\>

##### Returns

`U`

##### Inherited from

`SelectionQueryable.some`

#### Call Signature

> **some**(`done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:186](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/SelectionQueryable.ts#L186)

##### Parameters

###### done

`CallbackResult`\<`Explainable`\<`E`, `boolean`\>\>

##### Returns

`U`

##### Inherited from

`SelectionQueryable.some`

***

### every()

#### Call Signature

> **every**(`expression`, `done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:223](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/SelectionQueryable.ts#L223)

##### Parameters

###### expression

`Filter`\<`Shape`\>

###### done

`CallbackResult`\<`Explainable`\<`E`, `boolean`\>\>

##### Returns

`U`

##### Inherited from

`SelectionQueryable.every`

#### Call Signature

> **every**\<`P`\>(`expression`, `params`, `done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:224](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/SelectionQueryable.ts#L224)

##### Type Parameters

###### P

`P` *extends* `object`

##### Parameters

###### expression

`ParamsFilter`\<`Shape`, `P`\>

###### params

`P`

###### done

`CallbackResult`\<`Explainable`\<`E`, `boolean`\>\>

##### Returns

`U`

##### Inherited from

`SelectionQueryable.every`

***

### min()

> **min**(`selector`, `done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:257](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/SelectionQueryable.ts#L257)

#### Parameters

##### selector

`GenericFunction`\<`Shape`, `number`\>

##### done

`CallbackResult`\<`Explainable`\<`E`, `number`\>\>

#### Returns

`U`

#### Inherited from

`SelectionQueryable.min`

***

### max()

> **max**(`selector`, `done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:261](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/SelectionQueryable.ts#L261)

#### Parameters

##### selector

`GenericFunction`\<`Shape`, `number`\>

##### done

`CallbackResult`\<`Explainable`\<`E`, `number`\>\>

#### Returns

`U`

#### Inherited from

`SelectionQueryable.max`

***

### sum()

> **sum**(`selector`, `done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:265](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/SelectionQueryable.ts#L265)

#### Parameters

##### selector

`GenericFunction`\<`Shape`, `number`\>

##### done

`CallbackResult`\<`Explainable`\<`E`, `number`\>\>

#### Returns

`U`

#### Inherited from

`SelectionQueryable.sum`

***

### count()

> **count**(`done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:269](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/SelectionQueryable.ts#L269)

#### Parameters

##### done

`CallbackResult`\<`Explainable`\<`E`, `number`\>\>

#### Returns

`U`

#### Inherited from

`SelectionQueryable.count`

***

### distinct()

> **distinct**(`done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:284](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/SelectionQueryable.ts#L284)

#### Parameters

##### done

`CallbackResult`\<`Explainable`\<`E`, `Shape`[]\>\>

#### Returns

`U`

#### Inherited from

`SelectionQueryable.distinct`

***

### toGroup()

> **toGroup**\<`R`\>(`selector`, `done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:298](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/SelectionQueryable.ts#L298)

#### Type Parameters

##### R

`R` *extends* `string` \| `number`

#### Parameters

##### selector

`GenericFunction`\<`Shape`, `R`\>

##### done

`CallbackResult`\<`Explainable`\<`E`, `Record`\<`R`, `Shape`[]\>\>\>

#### Returns

`U`

#### Inherited from

`SelectionQueryable.toGroup`
