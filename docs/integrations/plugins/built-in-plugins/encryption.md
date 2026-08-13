---
title: Encryption
---

# Encryption

`@routier/encryption` provides AES-GCM encryption as a schema transform. It is not a database plugin and has no relationship to file storage: it transforms selected property values before any `IDbPlugin` stores them.

## Setup

```bash
npm install @routier/encryption
```

```ts
import { createKeyring, encryption } from "@routier/encryption";

const keyring = await createKeyring({
  activeKeyId: "k2",
  keys: { k1: oldSecret, k2: currentSecret },
});

const userSchema = s.define("users", {
  id: s.string().key(),
  email: s.string(),
  notes: s.string(),
}).modify(x => ({
  email: x.transform(encryption(keyring, { searchable: true })),
  notes: x.transform(encryption(keyring)),
})).compile();
```

Use the resulting schema with memory, SQLite, PostgreSQL, MySQL, MongoDB, Dexie, replication, or another plugin as usual.

## Randomized versus searchable

| Mode | Stored equality leaks? | Database equality filters? |
| --- | --- | --- |
| `encryption(keyring)` | No; a fresh IV produces different ciphertext for equal values | No |
| `encryption(keyring, { searchable: true })` | Yes; equal values produce equal ciphertext | Yes, equality only |

Deterministic searchable encryption reveals which rows share a value and how often it occurs. Use it only for high-cardinality lookup values such as email. Do not use it for salary, diagnosis, status, or other low-cardinality/sensitive values where frequency is revealing.

## Keys and rotation

Secrets must contain at least 32 bytes of entropy. Every envelope records the key ID. Rotate by adding a new active key while retaining old keys until all old rows have been rewritten:

```ts
const keyring = await createKeyring({
  activeKeyId: "k3",
  keys: { k1: oldest, k2: previous, k3: current },
});
```

Removing a key that stored rows still reference makes those rows fail on read. `isEnvelope(value)` identifies this package's stored format.

## Supported property values

Strings, numbers, booleans, dates, and objects are encoded with their type and restored after decryption. The database sees ciphertext text; your application receives the original type.

## Custom transforms

Encryption is one use of the general transform API. Compression, redaction, and custom codecs use the same boundary:

```ts
.modify(x => ({
  payload: x.transform({
    stores: SchemaTypes.String,
    to: value => compress(value),
    from: stored => decompress(stored),
  }),
}))
```

Transforms may be async. They replace an existing property, preserve its application type, and declare the storage type.

## Related

- [Schema API: transforms](/concepts/schema/schema-api#derived-and-transformed-properties)
- [Files and Blob Storage](/integrations/plugins/built-in-plugins/files)
- [Plugin Catalog](/integrations/plugins/built-in-plugins/)
- [Encryption API](/reference/api/plugins/encryption/src/README)
