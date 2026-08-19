[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/blob/src](../README.md) / FileReference

# Type Alias: FileReference

> **FileReference** = `FileReferenceValue`

Defined in: [plugins/blob/src/schema.ts:9](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/blob/src/schema.ts#L9)

The stored shape of a file: where the bytes are and what they are.

Declared by `s.file()` in core, which is what a schema uses. This alias exists so the blob
plugin's own signatures can name the shape without importing from a subpath everywhere.
