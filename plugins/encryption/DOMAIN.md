# Encryption — a transform, not a plugin

<!-- Generated from architecture/src/domains.ts. Edit the manifest, then run
     `npm run domains:write`. A hand-edit here fails architecture's test suite. -->

## Responsible for

Supplies a two-way property transform that encrypts on the way out and decrypts on the way back.

## Rules

- This implements no IDbPlugin and stores nothing. It lives under plugins/ for packaging reasons only.
- It was a wrapper plugin and is not one any more. Encryption is declared as .modify(x => x.transform({ to, from })) and runs in the datastore, which is why it needs no plugin at all — see datastore/src/transforms.
- Core ships no transform of its own. What runs here is supplied by the caller, including the keyring.

## May import

`@routier/core`

## Covers

- `plugins/encryption`
