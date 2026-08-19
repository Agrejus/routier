[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / SchemaTypes

# Enumeration: SchemaTypes

Defined in: [core/src/schema/types.ts:21](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/types.ts#L21)

## Enumeration Members

### Array

> **Array**: `"Array"`

Defined in: [core/src/schema/types.ts:22](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/types.ts#L22)

***

### Boolean

> **Boolean**: `"Boolean"`

Defined in: [core/src/schema/types.ts:23](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/types.ts#L23)

***

### Date

> **Date**: `"Date"`

Defined in: [core/src/schema/types.ts:24](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/types.ts#L24)

***

### Number

> **Number**: `"Number"`

Defined in: [core/src/schema/types.ts:25](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/types.ts#L25)

***

### Object

> **Object**: `"Object"`

Defined in: [core/src/schema/types.ts:26](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/types.ts#L26)

***

### String

> **String**: `"String"`

Defined in: [core/src/schema/types.ts:27](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/types.ts#L27)

***

### Definition

> **Definition**: `"Definition"`

Defined in: [core/src/schema/types.ts:28](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/types.ts#L28)

***

### Function

> **Function**: `"Function"`

Defined in: [core/src/schema/types.ts:29](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/types.ts#L29)

***

### Computed

> **Computed**: `"Computed"`

Defined in: [core/src/schema/types.ts:30](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/types.ts#L30)

***

### File

> **File**: `"File"`

Defined in: [core/src/schema/types.ts:35](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/types.ts#L35)

Content in, reference out. The only type whose write shape differs from its stored
shape, and a leaf on purpose — see `SchemaFile`.

***

### Vector

> **Vector**: `"Vector"`

Defined in: [core/src/schema/types.ts:43](https://github.com/Agrejus/routier/blob/2d0e42a9b099264b175f71d2bfb8e465ace0de7e/core/src/schema/types.ts#L43)

A fixed-length list of numbers, carrying its dimension count — see `SchemaVector`.

Value-shaped exactly like `s.array(s.number())`, which is why every array codegen
handler accepts it. It is a distinct type only so a backend can recognise it and store
it natively; nothing else needs to tell the two apart.
