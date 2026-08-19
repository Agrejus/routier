[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/encryption/src](../README.md) / EncryptionOptions

# Type Alias: EncryptionOptions

> **EncryptionOptions** = `object`

Defined in: [plugins/encryption/src/transform.ts:6](https://github.com/Agrejus/routier/blob/main/plugins/encryption/src/transform.ts#L6)

## Properties

### searchable?

> `optional` **searchable**: `boolean`

Defined in: [plugins/encryption/src/transform.ts:15](https://github.com/Agrejus/routier/blob/main/plugins/encryption/src/transform.ts#L15)

Keeps equality filters working, by deriving the initialisation vector from the value so
the ciphertext is stable.

The cost is that rows holding the same value are visibly equal in storage. Use it for a
lookup key such as an email. Do not use it for a diagnosis, a salary, or any
low-cardinality column, where seeing which rows match is close to reading them.
