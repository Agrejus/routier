[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/blob/src](../README.md) / FileReference

# Type Alias: FileReference

> **FileReference** = `FileReferenceValue`

Defined in: [plugins/blob/src/schema.ts:9](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/plugins/blob/src/schema.ts#L9)

The stored shape of a file: where the bytes are and what they are.

Declared by `s.file()` in core, which is what a schema uses. This alias exists so the blob
plugin's own signatures can name the shape without importing from a subpath everywhere.
