# @routier/encryption

<p align="center">
  <img src="https://routier.dev/routier.svg" alt="Routier" width="140" height="140" />
</p>

AES-GCM encryption as a Routier **schema transform**. Not a plugin, and it installs nothing:
your database plugin never learns that encryption happened.

```ts
import { s } from "@routier/core/schema";
import { createKeyring, encryption } from "@routier/encryption";

const keyring = await createKeyring({ activeKeyId: "k1", keys: { k1: myKeyBytes } });
const cipher = encryption(keyring);

const userSchema = s.define("users", {
  id:    s.string().key().identity(),
  email: s.string(),
  notes: s.string(),
}).modify(x => ({
  email: x.transform(encryption(keyring, { searchable: true })),
  notes: x.transform(cipher),
})).compile();
```

That is the whole integration. The store is built as it always was:

```ts
class AppStore extends DataStore {
  users = this.collection(userSchema).proxy().create();
  constructor() { super(new SqliteDbPlugin("app.db")); }
}
```

## Nothing here is privileged

A transform is `{ to, from }`. This package returns one; so can you:

```ts
const rot13 = { to: v => rot(v), from: v => rot(v) };

.modify(x => ({ value: x.transform(rot13) }))
```

Use this cipher, wrap your own KMS, or write four lines yourself. The schema does not care, and
neither does core.

## `searchable` is the whole decision

| | `encryption(keyring)` | `encryption(keyring, { searchable: true })` |
| --- | --- | --- |
| IV | fresh per write | derived from the value |
| Same value written twice | two unrelated ciphertexts | identical ciphertext |
| What storage reveals | nothing | which rows share a value |
| Equality filter | rejected | runs in the database, on an index |

Use it for a lookup key such as an email. **Do not** use it for a diagnosis, a salary, or a
low-cardinality column such as a status — there, seeing which rows match each other is close to
reading the values, and frequency analysis needs no key at all.

The unsafe option is the one you have to ask for.

## What the cipher declares, so you do not have to

`stores: String`, because a ciphertext is always text — that is what lets an encrypted *number*
land in a TEXT column without any plugin knowing why.

`comparable`, which is `equality` only in searchable mode. A randomised ciphertext cannot be
matched in a database, and saying so is what stops a filter silently returning nothing.

Your schema writes `x.transform(cipher)` and nothing else.

## Any property type

Numbers, booleans, dates and objects encrypt as readily as strings and come back as themselves.
The value is tagged before encryption and untagged after, so a `0` stays a `0` and a `false`
stays a `false`.

## Keys and rotation

Every encrypted value records the id of the key that wrote it, so a rotation adds a key rather
than replacing one:

```ts
const keyring = await createKeyring({
  activeKeyId: "k2",
  keys: { k1: oldSecret, k2: newSecret },   // k1 still reads old rows
});
```

Keep a retired key until nothing references it. Removing it early does not fail a write — it
fails a **read**, later, on the rows still carrying that id, and the error names the key.

Key material must be at least 32 bytes of real entropy. Use `crypto.getRandomValues`, not a
password. Each secret is expanded with HKDF into two independent keys: one for AES-GCM, one for
the synthetic IV that makes `searchable` deterministic. The secret itself is never used
directly.

## The stored format

```
renc1.k2.qX7f…iv….yTn2…ciphertext…
│     │  │         └── AES-GCM output, including its authentication tag
│     │  └── initialisation vector
│     └── which key wrote this
└── format version
```

The prefix distinguishes an encrypted value from a plaintext one that happens to look like
base64, which is what makes a partial migration readable in both directions — `from` passes a
non-envelope through untouched.

## Contracts

**What an attacker with the database gets.** Nothing, for a randomised property. For a
searchable one: which rows share a value, and how often each distinct value occurs. Never the
value, and never anything without the key.

**Tampering.** AES-GCM authenticates as well as encrypts. A field altered in the database fails
to decrypt rather than reading back as something.

**Durability, concurrency, transactions.** Unchanged, and not this package's business.

## Supported versions

Node 18 or later, and any modern browser. `crypto.subtle` provides HKDF, AES-GCM and HMAC in
both.
