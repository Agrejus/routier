[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/encryption/src](../README.md) / Keyring

# Type Alias: Keyring

> **Keyring** = `object`

Defined in: [plugins/encryption/src/keyring.ts:50](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/encryption/src/keyring.ts#L50)

## Properties

### keyIds

> `readonly` **keyIds**: `string`[]

Defined in: [plugins/encryption/src/keyring.ts:56](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/encryption/src/keyring.ts#L56)

Every id the keyring can read, for a re-encryption pass to reason about.

***

### activeKeyId

> `readonly` **activeKeyId**: `string`

Defined in: [plugins/encryption/src/keyring.ts:58](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/encryption/src/keyring.ts#L58)

The id new writes use.

## Methods

### active()

> **active**(): `Promise`\<`DerivedKey`\>

Defined in: [plugins/encryption/src/keyring.ts:52](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/encryption/src/keyring.ts#L52)

The key new writes use.

#### Returns

`Promise`\<`DerivedKey`\>

***

### get()

> **get**(`keyId`): `Promise`\<`DerivedKey`\>

Defined in: [plugins/encryption/src/keyring.ts:54](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/encryption/src/keyring.ts#L54)

A key by id, for reading a value written earlier.

#### Parameters

##### keyId

`string`

#### Returns

`Promise`\<`DerivedKey`\>
