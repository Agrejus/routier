[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / FileReferenceValue

# Type Alias: FileReferenceValue

> **FileReferenceValue** = `object`

Defined in: [core/src/schema/types.ts:55](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/types.ts#L55)

What a file property gives back: where the bytes are and what they are.

Declared in core so `InferType` can name it. Core never reads or writes the bytes — it only
carries this shape — and `@routier/blob-plugin` is what puts one here.

## Properties

### key

> **key**: `string`

Defined in: [core/src/schema/types.ts:57](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/types.ts#L57)

Where the bytes live, content-addressed by the blob plugin.

***

### size

> **size**: `number`

Defined in: [core/src/schema/types.ts:59](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/types.ts#L59)

Byte length.

***

### contentType

> **contentType**: `string`

Defined in: [core/src/schema/types.ts:61](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/types.ts#L61)

Media type as supplied at upload.

***

### checksum

> **checksum**: `string`

Defined in: [core/src/schema/types.ts:63](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/types.ts#L63)

SHA-256 of the bytes, lowercase hex.

***

### fileName

> **fileName**: `string`

Defined in: [core/src/schema/types.ts:65](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/schema/types.ts#L65)

The name to show a user. Not part of the key.
