[**routier-collection**](../../../README.md)

***

[routier-collection](../../../README.md) / [core/src](../README.md) / CallSource

# Type Alias: CallSource

> **CallSource** = \{ `form`: `"method"`; `name`: `string`; \} \| \{ `form`: `"property"`; `name`: `string`; \} \| \{ `form`: `"function"`; `name`: `string`; \} \| \{ `form`: `"operator"`; `symbol`: `string`; \} \| \{ `form`: `"prefix"`; `keyword`: `string`; \} \| \{ `form`: `"conditional"`; \} \| \{ `form`: `"regex-test"`; \}

Defined in: [core/src/expressions/callSource.ts:9](https://github.com/Agrejus/routier/blob/main/core/src/expressions/callSource.ts#L9)

How a [Call](Call.md) is spelled in JavaScript, and where its operand goes.

`length` is a property, `Math.abs` is a function, `+` is an operator and `typeof` is a prefix — so
a name alone is not enough to render one.

## Type Declaration

\{ `form`: `"method"`; `name`: `string`; \}

### form

> **form**: `"method"`

### name

> **name**: `string`

\{ `form`: `"property"`; `name`: `string`; \}

### form

> **form**: `"property"`

### name

> **name**: `string`

\{ `form`: `"function"`; `name`: `string`; \}

### form

> **form**: `"function"`

### name

> **name**: `string`

\{ `form`: `"operator"`; `symbol`: `string`; \}

### form

> **form**: `"operator"`

### symbol

> **symbol**: `string`

\{ `form`: `"prefix"`; `keyword`: `string`; \}

### form

> **form**: `"prefix"`

### keyword

> **keyword**: `string`

\{ `form`: `"conditional"`; \}

### form

> **form**: `"conditional"`

\{ `form`: `"regex-test"`; \}

### form

> **form**: `"regex-test"`

The argument is the receiver in source: `/^a/.test(x.name)`, not `x.name.test(/^a/)`.
