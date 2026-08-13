[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [datastore/src](../README.md) / JoinQueryable

# Class: JoinQueryable\<TOuter, Shape\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:29](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/JoinQueryable.ts#L29)

## Extends

- `QueryableExecutor`\<`TOuter`, `Shape`\>

## Type Parameters

### TOuter

`TOuter` *extends* `object`

### Shape

`Shape`

## Constructors

### Constructor

> **new JoinQueryable**\<`TOuter`, `Shape`\>(`dependencies`, `request`): `JoinQueryable`\<`TOuter`, `Shape`\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:31](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/JoinQueryable.ts#L31)

#### Parameters

##### dependencies

`CollectionDependencies`\<`TOuter`\>

##### request

`RequestContext`\<`TOuter`\>

#### Returns

`JoinQueryable`\<`TOuter`, `Shape`\>

#### Overrides

`QueryableExecutor<TOuter, Shape>.constructor`

## Methods

### where()

#### Call Signature

> **where**(`expression`): `JoinQueryable`\<`TOuter`, `Shape`\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:58](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/JoinQueryable.ts#L58)

Filters the pairs.

Runs AFTER the join, over the tuples, so a condition spanning both sides
(`([p, m]) => p.rank > m.rank`) is expressible here and nowhere else. Correct on every
backend; accelerated only where the query builder can split a single-side conjunct off and
push it down.

##### Parameters

###### expression

`Filter`\<`Shape`\>

##### Returns

`JoinQueryable`\<`TOuter`, `Shape`\>

#### Call Signature

> **where**\<`P`\>(`selector`, `params`): `JoinQueryable`\<`TOuter`, `Shape`\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:59](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/JoinQueryable.ts#L59)

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

`JoinQueryable`\<`TOuter`, `Shape`\>

***

### map()

> **map**\<`R`\>(`selector`): `JoinQueryable`\<`TOuter`, `R`\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:89](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/JoinQueryable.ts#L89)

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

`JoinQueryable`\<`TOuter`, `R`\>

***

### sort()

> **sort**(`selector`): `JoinQueryable`\<`TOuter`, `Shape`\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:102](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/JoinQueryable.ts#L102)

Orders the pairs.

Worth stating plainly: without this, pair ORDER IS UNDEFINED. It differs between a native
SQL join and an in-memory hash join, and that is the one difference between
interpretations a caller can observe.

#### Parameters

##### selector

`GenericFunction`\<`Shape`, `unknown`\>

#### Returns

`JoinQueryable`\<`TOuter`, `Shape`\>

***

### sortDescending()

> **sortDescending**(`selector`): `JoinQueryable`\<`TOuter`, `Shape`\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:107](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/JoinQueryable.ts#L107)

#### Parameters

##### selector

`GenericFunction`\<`Shape`, `unknown`\>

#### Returns

`JoinQueryable`\<`TOuter`, `Shape`\>

***

### skip()

> **skip**(`amount`): `JoinQueryable`\<`TOuter`, `Shape`\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:125](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/JoinQueryable.ts#L125)

#### Parameters

##### amount

`number`

#### Returns

`JoinQueryable`\<`TOuter`, `Shape`\>

***

### take()

> **take**(`amount`): `JoinQueryable`\<`TOuter`, `Shape`\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:130](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/JoinQueryable.ts#L130)

#### Parameters

##### amount

`number`

#### Returns

`JoinQueryable`\<`TOuter`, `Shape`\>

***

### toArray()

> **toArray**(`done`): `void`

Defined in: [datastore/src/queryable/JoinQueryable.ts:135](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/JoinQueryable.ts#L135)

#### Parameters

##### done

`CallbackResult`\<`Shape`[]\>

#### Returns

`void`

***

### toArrayAsync()

> **toArrayAsync**(): `Promise`\<`Shape`[]\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:139](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/JoinQueryable.ts#L139)

#### Returns

`Promise`\<`Shape`[]\>

***

### first()

> **first**(`done`): `void`

Defined in: [datastore/src/queryable/JoinQueryable.ts:143](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/JoinQueryable.ts#L143)

#### Parameters

##### done

`CallbackResult`\<`Shape`\>

#### Returns

`void`

***

### firstAsync()

> **firstAsync**(): `Promise`\<`Shape`\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:159](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/JoinQueryable.ts#L159)

#### Returns

`Promise`\<`Shape`\>

***

### firstOrUndefined()

> **firstOrUndefined**(`done`): `void`

Defined in: [datastore/src/queryable/JoinQueryable.ts:163](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/JoinQueryable.ts#L163)

#### Parameters

##### done

`CallbackResult`\<`Shape`\>

#### Returns

`void`

***

### firstOrUndefinedAsync()

> **firstOrUndefinedAsync**(): `Promise`\<`Shape`\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:182](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/JoinQueryable.ts#L182)

#### Returns

`Promise`\<`Shape`\>

***

### count()

> **count**(`done`): `void`

Defined in: [datastore/src/queryable/JoinQueryable.ts:186](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/JoinQueryable.ts#L186)

#### Parameters

##### done

`CallbackResult`\<`number`\>

#### Returns

`void`

***

### countAsync()

> **countAsync**(): `Promise`\<`number`\>

Defined in: [datastore/src/queryable/JoinQueryable.ts:195](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/datastore/src/queryable/JoinQueryable.ts#L195)

#### Returns

`Promise`\<`number`\>
