[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / logger

# Variable: logger

> `const` **logger**: `object`

Defined in: [core/src/utilities/logger.ts:140](https://github.com/Agrejus/routier/blob/ac734e8213cf35552317a2c803f52af627038ec9/core/src/utilities/logger.ts#L140)

## Type Declaration

### log()

> **log**: (...`args`) => `void`

General-purpose output. Carried at `info`, since `log` names a console method, not a level.

#### Parameters

##### args

...`unknown`[]

#### Returns

`void`

### info()

> **info**: (...`args`) => `void`

#### Parameters

##### args

...`unknown`[]

#### Returns

`void`

### warn()

> **warn**: (...`args`) => `void`

#### Parameters

##### args

...`unknown`[]

#### Returns

`void`

### error()

> **error**: (...`args`) => `void`

#### Parameters

##### args

...`unknown`[]

#### Returns

`void`

### debug()

> **debug**: (...`args`) => `void`

#### Parameters

##### args

...`unknown`[]

#### Returns

`void`

### table()

> **table**: (...`args`) => `void`

Diagnostic tabular output; verbose by nature, so it sits at `debug`.

#### Parameters

##### args

...`unknown`[]

#### Returns

`void`
