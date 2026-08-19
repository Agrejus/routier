[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / FileContentValue

# Type Alias: FileContentValue

> **FileContentValue** = [`FileReferenceValue`](FileReferenceValue.md) \| `Uint8Array` \| `ArrayBuffer` \| `Blob` \| `string`

Defined in: [core/src/schema/types.ts:74](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/types.ts#L74)

What a file property ACCEPTS: content, or a reference you already have.

`Blob` covers `File`, which is what an `<input type="file">` yields. A reference is accepted
too, so re-saving an entity that was read from the database does not have to re-upload it.
