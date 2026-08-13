[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/blob/src](../README.md) / blobKey

# Function: blobKey()

> **blobKey**(`digest`): `string`

Defined in: [plugins/blob/src/content.ts:107](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/blob/src/content.ts#L107)

The key for a given checksum.

Content-addressed, and that decision earns three things. An upload is idempotent, so a retry
cannot create a second object. Identical bytes uploaded from anywhere land on one object, so
a file attached to a thousand records is stored once. And a key cannot be wrong about what
it holds, because the key *is* what it holds.

It also has one consequence that must not be forgotten: **two records can reference the same
key**, so deleting a record must never delete its object. See `sweepOrphans`.

## Parameters

### digest

`string`

## Returns

`string`
