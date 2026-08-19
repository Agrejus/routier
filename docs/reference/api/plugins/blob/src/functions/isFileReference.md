[**routier-collection**](../../../../README.md)

***

[routier-collection](../../../../README.md) / [plugins/blob/src](../README.md) / isFileReference

# Function: isFileReference()

> **isFileReference**(`value`): `value is FileReferenceValue`

Defined in: [plugins/blob/src/BlobDbPlugin.ts:138](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/plugins/blob/src/BlobDbPlugin.ts#L138)

Whether a value is already a stored reference rather than content waiting to be uploaded.

Checked structurally on `key` and `checksum` together. A `Blob` has neither; a reference
read back from the database has both. Testing one alone would misread any object that
happens to carry a `key`.

## Parameters

### value

`unknown`

## Returns

`value is FileReferenceValue`
