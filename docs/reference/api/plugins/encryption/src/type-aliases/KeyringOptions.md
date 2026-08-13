[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/encryption/src](../README.md) / KeyringOptions

# Type Alias: KeyringOptions

> **KeyringOptions** = `object`

Defined in: [plugins/encryption/src/keyring.ts:23](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/encryption/src/keyring.ts#L23)

## Properties

### activeKeyId

> **activeKeyId**: `string`

Defined in: [plugins/encryption/src/keyring.ts:25](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/encryption/src/keyring.ts#L25)

The key new writes use. Must be present in `keys`.

***

### keys

> **keys**: `Record`\<`string`, [`KeySecret`](KeySecret.md)\>

Defined in: [plugins/encryption/src/keyring.ts:33](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/encryption/src/keyring.ts#L33)

Every key that might have produced a stored value, by id.

Keep a retired key here until nothing references it. Removing it early does not fail a
write; it fails a READ, later, on whichever rows still carry that id.
