[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [datastore/src](../README.md) / Queryable

# Class: Queryable\<Root, Shape, U, TStore\>

Defined in: [datastore/src/queryable/Queryable.ts:11](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/Queryable.ts#L11)

## Extends

- `SelectionQueryable`\<`Root`, `Shape`, `U`\>

## Type Parameters

### Root

`Root` *extends* `object`

### Shape

`Shape`

### U

`U`

### TStore

`TStore` = `unknown`

## Constructors

### Constructor

> **new Queryable**\<`Root`, `Shape`, `U`, `TStore`\>(`dependencies`, `request`): `Queryable`\<`Root`, `Shape`, `U`, `TStore`\>

Defined in: [datastore/src/queryable/Queryable.ts:13](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/Queryable.ts#L13)

#### Parameters

##### dependencies

`CollectionDependencies`\<`Root`\>

##### request

`RequestContext`\<`Root`\>

#### Returns

`Queryable`\<`Root`, `Shape`, `U`, `TStore`\>

#### Overrides

`SelectionQueryable<Root, Shape, U>.constructor`

## Methods

### compose()

> `static` **compose**\<`TEntity`\>(`schema`): `QueryableComposer`\<`TEntity`, `InferType`\<`TEntity`\>, `void`\>

Defined in: [datastore/src/queryable/Queryable.ts:25](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/Queryable.ts#L25)

#### Type Parameters

##### TEntity

`TEntity` *extends* `object`

#### Parameters

##### schema

`CompiledSchema`\<`TEntity`\>

#### Returns

`QueryableComposer`\<`TEntity`, `InferType`\<`TEntity`\>, `void`\>

***

### where()

#### Call Signature

> **where**(`expression`): `Queryable`\<`Root`, `Shape`, `U`, `TStore`\>

Defined in: [datastore/src/queryable/Queryable.ts:31](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/Queryable.ts#L31)

##### Parameters

###### expression

`Filter`\<`Shape`\>

##### Returns

`Queryable`\<`Root`, `Shape`, `U`, `TStore`\>

#### Call Signature

> **where**\<`P`\>(`selector`, `params`): `Queryable`\<`Root`, `Shape`, `U`, `TStore`\>

Defined in: [datastore/src/queryable/Queryable.ts:32](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/Queryable.ts#L32)

##### Type Parameters

###### P

`P` *extends* `object`

##### Parameters

###### selector

`ParamsFilter`\<`Shape`, `P`\>

###### params

`P`

##### Returns

`Queryable`\<`Root`, `Shape`, `U`, `TStore`\>

***

### map()

> **map**\<`R`\>(`expression`): `Queryable`\<`Root`, `R`, `U`, `TStore`\>

Defined in: [datastore/src/queryable/Queryable.ts:40](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/Queryable.ts#L40)

#### Type Parameters

##### R

`R`

#### Parameters

##### expression

`GenericFunction`\<`Shape`, `R`\>

#### Returns

`Queryable`\<`Root`, `R`, `U`, `TStore`\>

***

### skip()

> **skip**(`amount`): `Queryable`\<`Root`, `Shape`, `U`, `TStore`\>

Defined in: [datastore/src/queryable/Queryable.ts:46](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/Queryable.ts#L46)

#### Parameters

##### amount

`number`

#### Returns

`Queryable`\<`Root`, `Shape`, `U`, `TStore`\>

***

### take()

> **take**(`amount`): `Queryable`\<`Root`, `Shape`, `U`, `TStore`\>

Defined in: [datastore/src/queryable/Queryable.ts:51](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/Queryable.ts#L51)

#### Parameters

##### amount

`number`

#### Returns

`Queryable`\<`Root`, `Shape`, `U`, `TStore`\>

***

### sort()

> **sort**(`expression`): `Queryable`\<`Root`, `Shape`, `U`, `TStore`\>

Defined in: [datastore/src/queryable/Queryable.ts:56](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/Queryable.ts#L56)

#### Parameters

##### expression

`GenericFunction`\<`Shape`, `Shape`\[keyof `Shape`\]\>

#### Returns

`Queryable`\<`Root`, `Shape`, `U`, `TStore`\>

***

### sortDescending()

> **sortDescending**(`expression`): `Queryable`\<`Root`, `Shape`, `U`, `TStore`\>

Defined in: [datastore/src/queryable/Queryable.ts:61](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/Queryable.ts#L61)

#### Parameters

##### expression

`GenericFunction`\<`Shape`, `Shape`\[keyof `Shape`\]\>

#### Returns

`Queryable`\<`Root`, `Shape`, `U`, `TStore`\>

***

### nearest()

> **nearest**(`expression`, `vector`, `count`): `Queryable`\<`Root`, `Shape`, `U`, `TStore`\>

Defined in: [datastore/src/queryable/Queryable.ts:78](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/Queryable.ts#L78)

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

`Queryable`\<`Root`, `Shape`, `U`, `TStore`\>

***

### join()

> **join**\<`TInner`, `TKey`\>(`inner`, `outerKey`, `innerKey`): [`JoinQueryable`](JoinQueryable.md)\<`Root`, [`JoinTuple`](../type-aliases/JoinTuple.md)\<`Shape`, `InferType`\<`TInner`\>\>\>

Defined in: [datastore/src/queryable/Queryable.ts:91](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/Queryable.ts#L91)

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

[`JoinQueryable`](JoinQueryable.md)\<`Root`, [`JoinTuple`](../type-aliases/JoinTuple.md)\<`Shape`, `InferType`\<`TInner`\>\>\>

***

### leftJoin()

> **leftJoin**\<`TInner`, `TKey`\>(`inner`, `outerKey`, `innerKey`): [`JoinQueryable`](JoinQueryable.md)\<`Root`, [`JoinTuple`](../type-aliases/JoinTuple.md)\<`Shape`, `InferType`\<`TInner`\>\>\>

Defined in: [datastore/src/queryable/Queryable.ts:102](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/Queryable.ts#L102)

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

[`JoinQueryable`](JoinQueryable.md)\<`Root`, [`JoinTuple`](../type-aliases/JoinTuple.md)\<`Shape`, `InferType`\<`TInner`\>\>\>

***

### subscribe()

> **subscribe**(): `SubscribedQueryable`\<`Root`, `Shape`, () => `void`\>

Defined in: [datastore/src/queryable/Queryable.ts:112](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/Queryable.ts#L112)

#### Returns

`SubscribedQueryable`\<`Root`, `Shape`, () => `void`\>

***

### remove()

#### Call Signature

> **remove**(`expression`, `done`): `void`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:26](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/SelectionQueryable.ts#L26)

##### Parameters

###### expression

`Filter`\<`Shape`\>

###### done

`CallbackResult`\<`Shape`[]\>

##### Returns

`void`

##### Inherited from

`SelectionQueryable.remove`

#### Call Signature

> **remove**\<`P`\>(`expression`, `params`, `done`): `void`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:27](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/SelectionQueryable.ts#L27)

##### Type Parameters

###### P

`P` *extends* `object`

##### Parameters

###### expression

`ParamsFilter`\<`Shape`, `P`\>

###### params

`P`

###### done

`CallbackResult`\<`Shape`[]\>

##### Returns

`void`

##### Inherited from

`SelectionQueryable.remove`

#### Call Signature

> **remove**(`done`): `void`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:28](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/SelectionQueryable.ts#L28)

##### Parameters

###### done

`CallbackResult`\<`Shape`[]\>

##### Returns

`void`

##### Inherited from

`SelectionQueryable.remove`

***

### toArray()

> **toArray**(`done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:59](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/SelectionQueryable.ts#L59)

#### Parameters

##### done

`CallbackResult`\<`Shape`[]\>

#### Returns

`U`

#### Inherited from

`SelectionQueryable.toArray`

***

### first()

#### Call Signature

> **first**(`expression`, `done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:64](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/SelectionQueryable.ts#L64)

##### Parameters

###### expression

`Filter`\<`Shape`\>

###### done

`CallbackResult`\<`Shape`\>

##### Returns

`U`

##### Inherited from

`SelectionQueryable.first`

#### Call Signature

> **first**\<`P`\>(`expression`, `params`, `done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:65](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/SelectionQueryable.ts#L65)

##### Type Parameters

###### P

`P` *extends* `object`

##### Parameters

###### expression

`ParamsFilter`\<`Shape`, `P`\>

###### params

`P`

###### done

`CallbackResult`\<`Shape`\>

##### Returns

`U`

##### Inherited from

`SelectionQueryable.first`

#### Call Signature

> **first**(`done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:66](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/SelectionQueryable.ts#L66)

##### Parameters

###### done

`CallbackResult`\<`Shape`\>

##### Returns

`U`

##### Inherited from

`SelectionQueryable.first`

***

### firstOrUndefined()

#### Call Signature

> **firstOrUndefined**(`expression`, `done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:126](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/SelectionQueryable.ts#L126)

##### Parameters

###### expression

`Filter`\<`Shape`\>

###### done

`CallbackResult`\<`Shape`\>

##### Returns

`U`

##### Inherited from

`SelectionQueryable.firstOrUndefined`

#### Call Signature

> **firstOrUndefined**\<`P`\>(`expression`, `params`, `done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:127](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/SelectionQueryable.ts#L127)

##### Type Parameters

###### P

`P` *extends* `object`

##### Parameters

###### expression

`ParamsFilter`\<`Shape`, `P`\>

###### params

`P`

###### done

`CallbackResult`\<`Shape`\>

##### Returns

`U`

##### Inherited from

`SelectionQueryable.firstOrUndefined`

#### Call Signature

> **firstOrUndefined**(`done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:128](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/SelectionQueryable.ts#L128)

##### Parameters

###### done

`CallbackResult`\<`Shape`\>

##### Returns

`U`

##### Inherited from

`SelectionQueryable.firstOrUndefined`

***

### some()

#### Call Signature

> **some**(`expression`, `done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:181](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/SelectionQueryable.ts#L181)

##### Parameters

###### expression

`Filter`\<`Shape`\>

###### done

`CallbackResult`\<`boolean`\>

##### Returns

`U`

##### Inherited from

`SelectionQueryable.some`

#### Call Signature

> **some**\<`P`\>(`expression`, `params`, `done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:182](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/SelectionQueryable.ts#L182)

##### Type Parameters

###### P

`P` *extends* `object`

##### Parameters

###### expression

`ParamsFilter`\<`Shape`, `P`\>

###### params

`P`

###### done

`CallbackResult`\<`boolean`\>

##### Returns

`U`

##### Inherited from

`SelectionQueryable.some`

#### Call Signature

> **some**(`done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:183](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/SelectionQueryable.ts#L183)

##### Parameters

###### done

`CallbackResult`\<`boolean`\>

##### Returns

`U`

##### Inherited from

`SelectionQueryable.some`

***

### every()

#### Call Signature

> **every**(`expression`, `done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:220](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/SelectionQueryable.ts#L220)

##### Parameters

###### expression

`Filter`\<`Shape`\>

###### done

`CallbackResult`\<`boolean`\>

##### Returns

`U`

##### Inherited from

`SelectionQueryable.every`

#### Call Signature

> **every**\<`P`\>(`expression`, `params`, `done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:221](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/SelectionQueryable.ts#L221)

##### Type Parameters

###### P

`P` *extends* `object`

##### Parameters

###### expression

`ParamsFilter`\<`Shape`, `P`\>

###### params

`P`

###### done

`CallbackResult`\<`boolean`\>

##### Returns

`U`

##### Inherited from

`SelectionQueryable.every`

***

### min()

> **min**(`selector`, `done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:254](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/SelectionQueryable.ts#L254)

#### Parameters

##### selector

`GenericFunction`\<`Shape`, `number`\>

##### done

`CallbackResult`\<`number`\>

#### Returns

`U`

#### Inherited from

`SelectionQueryable.min`

***

### max()

> **max**(`selector`, `done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:258](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/SelectionQueryable.ts#L258)

#### Parameters

##### selector

`GenericFunction`\<`Shape`, `number`\>

##### done

`CallbackResult`\<`number`\>

#### Returns

`U`

#### Inherited from

`SelectionQueryable.max`

***

### sum()

> **sum**(`selector`, `done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:262](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/SelectionQueryable.ts#L262)

#### Parameters

##### selector

`GenericFunction`\<`Shape`, `number`\>

##### done

`CallbackResult`\<`number`\>

#### Returns

`U`

#### Inherited from

`SelectionQueryable.sum`

***

### count()

> **count**(`done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:266](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/SelectionQueryable.ts#L266)

#### Parameters

##### done

`CallbackResult`\<`number`\>

#### Returns

`U`

#### Inherited from

`SelectionQueryable.count`

***

### distinct()

> **distinct**(`done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:279](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/SelectionQueryable.ts#L279)

#### Parameters

##### done

`CallbackResult`\<`Shape`[]\>

#### Returns

`U`

#### Inherited from

`SelectionQueryable.distinct`

***

### toGroup()

> **toGroup**\<`R`\>(`selector`, `done`): `U`

Defined in: [datastore/src/queryable/SelectionQueryable.ts:291](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/SelectionQueryable.ts#L291)

#### Type Parameters

##### R

`R` *extends* `string` \| `number`

#### Parameters

##### selector

`GenericFunction`\<`Shape`, `R`\>

##### done

`CallbackResult`\<`Record`\<`R`, `Shape`[]\>\>

#### Returns

`U`

#### Inherited from

`SelectionQueryable.toGroup`
