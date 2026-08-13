[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/mongodb/src](../README.md) / MongoScope

# Interface: MongoScope

Defined in: [plugins/mongodb/src/driver.ts:47](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mongodb/src/driver.ts#L47)

Collections bound to one atomic unit of work.

A collection taken from here carries the session; one taken from the driver does not, and
would run outside the transaction while looking identical at the call site. That is the
easiest bug to write here, which is why the scope is a separate object rather than a flag.

## Methods

### collection()

> **collection**(`name`): `Promise`\<[`MongoCollection`](MongoCollection.md)\>

Defined in: [plugins/mongodb/src/driver.ts:48](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/mongodb/src/driver.ts#L48)

#### Parameters

##### name

`string`

#### Returns

`Promise`\<[`MongoCollection`](MongoCollection.md)\>
