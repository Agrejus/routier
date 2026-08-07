# @routier/encryption-plugin

Field-level encryption for Routier. Marked properties are encrypted before they reach the
database and decrypted on the way back. **The backend never sees a plaintext value.**

```ts
import { DataStore } from "@routier/datastore";
import { s } from "@routier/core/schema";
import { EncryptionDbPlugin, createKeyring, encrypted } from "@routier/encryption-plugin";

const userSchema = s.define("users", {
  id: s.string().key().identity(),
  tenant: s.string().index(),
  email: encrypted(s.string(), { searchable: true }),
  notes: encrypted(s.string()),
}).compile();

const keyring = await createKeyring({
  activeKeyId: "k1",
  keys: { k1: myKeyBytes },
});

class AppStore extends DataStore {
  users = this.collection(userSchema).proxy().create();
  constructor() { super(new EncryptionDbPlugin(new SqliteDbPlugin("app.db"), keyring)); }
}
```

Your application sees plain strings. Only storage changes.

## It is a wrapper, and works with every backend

The inner plugin is unaware. It stores strings, builds its own DDL, and runs its own
transactions, and it needs no changes. One implementation covers memory, dexie, sqlite,
postgresql, mysql, pouchdb, file-system and browser-storage.

This cannot be a `.serialize()` on the property: `crypto.subtle` is asynchronous and a
property serializer is not.

## `searchable` is the whole decision

| | Without `searchable` | With `searchable` |
| --- | --- | --- |
| IV | fresh per write | derived from the value |
| Same value written twice | two unrelated ciphertexts | identical ciphertext |
| What storage reveals | nothing | which rows share a value |
| Equality filter | rejected | runs in the database, on an index |

Use it for a lookup key such as an email. **Do not** use it for a diagnosis, a salary, or a
low-cardinality column such as a status — for those, seeing which rows match each other is
close to reading the values, and frequency analysis needs no key at all.

The unsafe option is the one you have to ask for.

## What it refuses to do

A filter on a randomised property throws. It does not load the table and filter in memory: a
query that quietly becomes a full scan passes review, passes staging, and is found in
production.

A filter on a searchable property runs **for equality only**. Ordering, ranges and `LIKE` are
rejected, because a ciphertext does not sort like the value it hides and a comparison that ran
would return rows that look correct and are not.

```ts
// works — the filter value is encrypted and compared against the stored ciphertext
.where(([u, p]) => u.email === p.email, { email: "ada@example.com" })

// throws — 'notes' is randomised
.where(([u, p]) => u.notes === p.notes, { notes: "secret" })

// throws — ordering a ciphertext is meaningless
.where(([u, p]) => u.email > p.email, { email: "a" })
```

## Keys and rotation

Every encrypted value records the id of the key that wrote it, so a rotation adds a key rather
than replacing one:

```ts
const keyring = await createKeyring({
  activeKeyId: "k2",              // new writes use this
  keys: { k1: oldSecret, k2: newSecret },   // k1 still reads old rows
});
```

Keep a retired key until nothing references it. Removing it early does not fail a write. It
fails a **read**, later, on whichever rows still carry that id — and the error says which key
is missing.

Key material must be at least 32 bytes of real entropy. Use `crypto.getRandomValues`, not a
password; if you must start from a password, run it through a KDF first. The plugin refuses a
short key rather than accepting a weak one.

Each secret is expanded with HKDF into two independent keys: one for AES-GCM, one for deriving
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

The prefix is what distinguishes an encrypted value from a plaintext one that happens to look
like base64, which is what makes a partial migration readable in both directions.

## Contracts

### What an attacker with the database gets

Nothing, for a randomised property. For a searchable one: which rows share a value, and how
often each distinct value occurs. Never the value itself, and never anything without the key.

### Tampering

AES-GCM authenticates as well as encrypts. Someone with write access to the database cannot
alter a stored field and have it read back as anything at all — decryption fails loudly rather
than returning altered data.

### Durability, concurrency, transactions

Unchanged. Everything is the inner plugin's, and encryption adds no round trip: it is CPU work
between the change tracker and the plugin.

### Failure semantics

- A missing key names the id that is missing.
- A wrong key, or an altered value, fails to decrypt rather than returning rubbish.
- A filter that cannot be answered correctly throws, naming the property and the reason.

## Limitations

- **Strings only.** A ciphertext is text, so an encrypted number would have to live in a column
  its own schema calls numeric. Declare the property as a string if it must be encrypted.
- **Root properties only.** A nested object is stored whole; encrypting one of its children
  would mean rewriting the parent's JSON.
- **No re-encryption pass.** Rotation makes new writes use the new key and leaves old rows
  readable. Rewriting them is your job, and a query-and-save loop does it.
- **A value used against both an encrypted and a plain property in one filter** throws. Params
  are matched by value, so that case is genuinely ambiguous; split them.
- **Sorting and indexing** on an encrypted property do not work, by construction.

## Supported versions

Node 18 or later, and any modern browser. `crypto.subtle` provides HKDF, AES-GCM and HMAC in
both, so there is one implementation rather than two that can disagree.

## See also

- `specs/plugin-roadmap.md` — where this sits, and what is next
- `core/src/plugins/ConcurrencyDbPlugin.ts` — the other wrapper that augments storage
