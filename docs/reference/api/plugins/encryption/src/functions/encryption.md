[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/encryption/src](../README.md) / encryption

# Function: encryption()

> **encryption**(`keyring`, `options`): `PropertyTransform`\<`any`\>

Defined in: [plugins/encryption/src/transform.ts:43](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/encryption/src/transform.ts#L43)

AES-GCM encryption as a transform you hand to a schema.

```ts
const cipher = encryption(keyring);

const userSchema = s.define('users', {
    id:    s.string().key().identity(),
    email: s.string(),
    notes: s.string(),
}).modify(x => ({
    email: x.transform(encryption(keyring, { searchable: true })),
    notes: x.transform(cipher),
})).compile();
```

This package is not a plugin and installs nothing. It returns `{ to, from }` and the schema
carries it; your database plugin never learns that encryption happened. Nothing here is
privileged — a transform of your own with the same two functions works identically, and
that is the point.

`stores` and `comparable` are set here rather than by the caller: a ciphertext is always
text, and only the deterministic mode can be compared. A schema that uses this says
`x.transform(cipher)` and nothing else.

## Parameters

### keyring

[`Keyring`](../type-aliases/Keyring.md)

### options

[`EncryptionOptions`](../type-aliases/EncryptionOptions.md) = `{}`

## Returns

`PropertyTransform`\<`any`\>
