[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/mongodb/src](../README.md) / MongoCollection

# Interface: MongoCollection

Defined in: [plugins/mongodb/src/driver.ts:32](https://github.com/Agrejus/routier/blob/main/plugins/mongodb/src/driver.ts#L32)

## Methods

### find()

> **find**(`filter`, `options?`): `Promise`\<`Record`\<`string`, `unknown`\>[]\>

Defined in: [plugins/mongodb/src/driver.ts:33](https://github.com/Agrejus/routier/blob/main/plugins/mongodb/src/driver.ts#L33)

#### Parameters

##### filter

[`MqlFilter`](../type-aliases/MqlFilter.md)

##### options?

[`MongoFindOptions`](../type-aliases/MongoFindOptions.md)

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>[]\>

***

### insertMany()

> **insertMany**(`documents`): `Promise`\<`void`\>

Defined in: [plugins/mongodb/src/driver.ts:34](https://github.com/Agrejus/routier/blob/main/plugins/mongodb/src/driver.ts#L34)

#### Parameters

##### documents

`Record`\<`string`, `unknown`\>[]

#### Returns

`Promise`\<`void`\>

***

### updateMany()

> **updateMany**(`updates`): `Promise`\<`number`[]\>

Defined in: [plugins/mongodb/src/driver.ts:36](https://github.com/Agrejus/routier/blob/main/plugins/mongodb/src/driver.ts#L36)

Returns how many documents each update matched, in the order given.

#### Parameters

##### updates

readonly [`MongoUpdate`](../type-aliases/MongoUpdate.md)[]

#### Returns

`Promise`\<`number`[]\>

***

### deleteMany()

> **deleteMany**(`filter`): `Promise`\<`void`\>

Defined in: [plugins/mongodb/src/driver.ts:37](https://github.com/Agrejus/routier/blob/main/plugins/mongodb/src/driver.ts#L37)

#### Parameters

##### filter

[`MqlFilter`](../type-aliases/MqlFilter.md)

#### Returns

`Promise`\<`void`\>
