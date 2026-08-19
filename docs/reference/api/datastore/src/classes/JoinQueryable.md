[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [datastore/src](../README.md) / JoinQueryable

# Class: JoinQueryable\<TOuter, Shape, E\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:30](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/JoinQueryable.ts#L30)

## Extends

- `QueryableExecutor`\<`TOuter`, `Shape`\>

## Type Parameters

### TOuter

`TOuter` *extends* `object`

### Shape

`Shape`

### E

`E` *extends* `boolean` = `false`

## Constructors

### Constructor

> **new JoinQueryable**\<`TOuter`, `Shape`, `E`\>(`dependencies`, `request`): `JoinQueryable`\<`TOuter`, `Shape`, `E`\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:32](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/JoinQueryable.ts#L32)

#### Parameters

##### dependencies

`CollectionDependencies`\<`TOuter`\>

##### request

`RequestContext`\<`TOuter`\>

#### Returns

`JoinQueryable`\<`TOuter`, `Shape`, `E`\>

#### Overrides

`QueryableExecutor<TOuter, Shape>.constructor`

## Methods

### where()

#### Call Signature

> **where**(`expression`): `JoinQueryable`\<`TOuter`, `Shape`, `E`\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:59](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/JoinQueryable.ts#L59)

Filters the pairs.

Runs AFTER the join, over the tuples, so a condition spanning both sides
(`([p, m]) => p.rank > m.rank`) is expressible here and nowhere else. Correct on every
backend; accelerated only where the query builder can split a single-side conjunct off and
push it down.

##### Parameters

###### expression

`Filter`\<`Shape`\>

##### Returns

`JoinQueryable`\<`TOuter`, `Shape`, `E`\>

#### Call Signature

> **where**\<`P`\>(`selector`, `params`): `JoinQueryable`\<`TOuter`, `Shape`, `E`\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:60](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/JoinQueryable.ts#L60)

Filters the pairs.

Runs AFTER the join, over the tuples, so a condition spanning both sides
(`([p, m]) => p.rank > m.rank`) is expressible here and nowhere else. Correct on every
backend; accelerated only where the query builder can split a single-side conjunct off and
push it down.

##### Type Parameters

###### P

`P` *extends* `object`

##### Parameters

###### selector

`ParamsFilter`\<`Shape`, `P`\>

###### params

`P`

##### Returns

`JoinQueryable`\<`TOuter`, `Shape`, `E`\>

***

### map()

> **map**\<`R`\>(`selector`): `JoinQueryable`\<`TOuter`, `R`, `E`\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:90](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/JoinQueryable.ts#L90)

Projects each pair into a shape of your own.

Recorded with NO fields, unlike `Queryable.map`. Fields are property paths on one schema,
resolved so a backend can select columns and a translator can deserialize them; a tuple
has neither a schema nor columns, and both halves are already deserialized by the time
this runs. An invented field list would name properties on a two-element array.

#### Type Parameters

##### R

`R`

#### Parameters

##### selector

`GenericFunction`\<`Shape`, `R`\>

#### Returns

`JoinQueryable`\<`TOuter`, `R`, `E`\>

***

### sort()

> **sort**(`selector`): `JoinQueryable`\<`TOuter`, `Shape`, `E`\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:103](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/JoinQueryable.ts#L103)

Orders the pairs.

Worth stating plainly: without this, pair ORDER IS UNDEFINED. It differs between a native
SQL join and an in-memory hash join, and that is the one difference between
interpretations a caller can observe.

#### Parameters

##### selector

`GenericFunction`\<`Shape`, `unknown`\>

#### Returns

`JoinQueryable`\<`TOuter`, `Shape`, `E`\>

***

### sortDescending()

> **sortDescending**(`selector`): `JoinQueryable`\<`TOuter`, `Shape`, `E`\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:108](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/JoinQueryable.ts#L108)

#### Parameters

##### selector

`GenericFunction`\<`Shape`, `unknown`\>

#### Returns

`JoinQueryable`\<`TOuter`, `Shape`, `E`\>

***

### skip()

> **skip**(`amount`): `JoinQueryable`\<`TOuter`, `Shape`, `E`\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:126](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/JoinQueryable.ts#L126)

#### Parameters

##### amount

`number`

#### Returns

`JoinQueryable`\<`TOuter`, `Shape`, `E`\>

***

### take()

> **take**(`amount`): `JoinQueryable`\<`TOuter`, `Shape`, `E`\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:131](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/JoinQueryable.ts#L131)

#### Parameters

##### amount

`number`

#### Returns

`JoinQueryable`\<`TOuter`, `Shape`, `E`\>

***

### explain()

> **explain**(): `JoinQueryable`\<`TOuter`, `Shape`, `true`\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:137](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/JoinQueryable.ts#L137)

See `QueryableAsync.explain`. Terminals after this deliver `{ data, explanation }`.

#### Returns

`JoinQueryable`\<`TOuter`, `Shape`, `true`\>

***

### toArray()

> **toArray**(`done`): `void`

Defined in: [datastore/src/queryable/JoinQueryable.ts:141](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/JoinQueryable.ts#L141)

#### Parameters

##### done

`CallbackResult`\<`Explainable`\<`E`, `Shape`[]\>\>

#### Returns

`void`

***

### toArrayAsync()

> **toArrayAsync**(): `Promise`\<`Explainable`\<`E`, `Shape`[]\>\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:145](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/JoinQueryable.ts#L145)

#### Returns

`Promise`\<`Explainable`\<`E`, `Shape`[]\>\>

***

### first()

> **first**(`done`): `void`

Defined in: [datastore/src/queryable/JoinQueryable.ts:149](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/JoinQueryable.ts#L149)

#### Parameters

##### done

`CallbackResult`\<`Explainable`\<`E`, `Shape`\>\>

#### Returns

`void`

***

### firstAsync()

> **firstAsync**(): `Promise`\<`Explainable`\<`E`, `Shape`\>\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:167](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/JoinQueryable.ts#L167)

#### Returns

`Promise`\<`Explainable`\<`E`, `Shape`\>\>

***

### firstOrUndefined()

> **firstOrUndefined**(`done`): `void`

Defined in: [datastore/src/queryable/JoinQueryable.ts:171](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/JoinQueryable.ts#L171)

#### Parameters

##### done

`CallbackResult`\<`Explainable`\<`E`, `Shape`\>\>

#### Returns

`void`

***

### firstOrUndefinedAsync()

> **firstOrUndefinedAsync**(): `Promise`\<`Explainable`\<`E`, `Shape`\>\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:195](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/JoinQueryable.ts#L195)

#### Returns

`Promise`\<`Explainable`\<`E`, `Shape`\>\>

***

### count()

> **count**(`done`): `void`

Defined in: [datastore/src/queryable/JoinQueryable.ts:199](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/JoinQueryable.ts#L199)

#### Parameters

##### done

`CallbackResult`\<`Explainable`\<`E`, `number`\>\>

#### Returns

`void`

***

### countAsync()

> **countAsync**(): `Promise`\<`Explainable`\<`E`, `number`\>\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:208](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/datastore/src/queryable/JoinQueryable.ts#L208)

#### Returns

`Promise`\<`Explainable`\<`E`, `number`\>\>
